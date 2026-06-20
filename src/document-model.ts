import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import type {
  BlockContent,
  List,
  ListItem,
  PhrasingContent,
  RootContent,
  Table
} from "mdast";

export interface ArticleDocument {
  title: string;
  frontmatter: string;
  blocks: ArticleBlock[];
  assets: ArticleAsset[];
  warnings: ArticleWarning[];
  stats: ArticleStats;
}

export interface ArticleAsset {
  id: string;
  source: string;
  alt: string;
  kind: "remote" | "local";
}

export interface ArticleWarning {
  code: "local-asset" | "unsupported-block" | "unsupported-inline" | "too-many-heading-levels";
  message: string;
}

export interface ArticleStats {
  headings: number;
  paragraphs: number;
  lists: number;
  codeBlocks: number;
  tables: number;
  images: number;
  warnings: number;
}

export type ArticleBlock =
  | { type: "heading"; depth: number; content: InlineContent[] }
  | { type: "paragraph"; content: InlineContent[] }
  | { type: "list"; ordered: boolean; start: number; items: ArticleBlock[][] }
  | { type: "quote"; blocks: ArticleBlock[] }
  | { type: "callout"; calloutType: string; title: string; blocks: ArticleBlock[] }
  | { type: "code"; language: string; value: string }
  | { type: "table"; align: Array<"left" | "right" | "center" | null>; rows: string[][] }
  | { type: "image"; assetId: string; alt: string }
  | { type: "thematicBreak" };

export type InlineContent =
  | { type: "text"; value: string }
  | { type: "strong"; content: InlineContent[] }
  | { type: "emphasis"; content: InlineContent[] }
  | { type: "delete"; content: InlineContent[] }
  | { type: "inlineCode"; value: string }
  | { type: "link"; url: string; content: InlineContent[] }
  | { type: "image"; assetId: string; alt: string }
  | { type: "break" };

interface ParseContext {
  assets: ArticleAsset[];
  warnings: ArticleWarning[];
}

export function parseArticleDocument(markdown: string): ArticleDocument {
  const context: ParseContext = { assets: [], warnings: [] };
  const prepared = prepareObsidianEmbeds(markdown);
  const tree = fromMarkdown(prepared, {
    extensions: [gfm(), frontmatter(["yaml"])],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(["yaml"])]
  });

  let frontmatterValue = "";
  const blocks: ArticleBlock[] = [];

  for (const node of tree.children) {
    if (node.type === "yaml") {
      frontmatterValue = node.value;
      continue;
    }
    const converted = convertBlock(node, context);
    if (converted) blocks.push(converted);
  }

  const title = findTitle(blocks) || readFrontmatterTitle(frontmatterValue);
  const stats = calculateStats(blocks, context);
  if (maxHeadingDepth(blocks) > 3) {
    context.warnings.push({
      code: "too-many-heading-levels",
      message: "文章使用了四级或更深标题，部分发布平台可能无法保留完整层级。"
    });
    stats.warnings = context.warnings.length;
  }

  return {
    title,
    frontmatter: frontmatterValue,
    blocks,
    assets: context.assets,
    warnings: context.warnings,
    stats
  };
}

export function articleBlockLabel(block: ArticleBlock): string {
  switch (block.type) {
    case "heading":
      return `H${block.depth} 标题`;
    case "paragraph":
      return "段落";
    case "list":
      return block.ordered ? "有序列表" : "无序列表";
    case "quote":
      return "引用";
    case "callout":
      return `Callout · ${block.calloutType}`;
    case "code":
      return `代码块${block.language ? ` · ${block.language}` : ""}`;
    case "table":
      return "表格";
    case "image":
      return "图片";
    case "thematicBreak":
      return "分隔线";
  }
}

export function articleBlockPreview(block: ArticleBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return inlineText(block.content);
    case "list":
      return block.items.map((item) => item.map(articleBlockPreview).join(" ")).join(" | ");
    case "quote":
    case "callout":
      return block.blocks.map(articleBlockPreview).join(" ");
    case "code":
      return block.value;
    case "table":
      return block.rows.map((row) => row.join(" | ")).join("\n");
    case "image":
      return block.alt || block.assetId;
    case "thematicBreak":
      return "—";
  }
}

function convertBlock(node: RootContent | BlockContent, context: ParseContext): ArticleBlock | null {
  switch (node.type) {
    case "heading":
      return { type: "heading", depth: node.depth, content: convertInline(node.children, context) };
    case "paragraph": {
      const content = convertInline(node.children, context);
      if (content.length === 1 && content[0].type === "image") {
        return { type: "image", assetId: content[0].assetId, alt: content[0].alt };
      }
      return { type: "paragraph", content };
    }
    case "list":
      return convertList(node, context);
    case "blockquote":
      return convertQuote(node.children, context);
    case "code":
      return { type: "code", language: node.lang ?? "", value: node.value };
    case "table":
      return convertTable(node);
    case "thematicBreak":
      return { type: "thematicBreak" };
    case "definition":
      return null;
    case "html":
      if (/^<!--[\s\S]*-->$/.test(node.value.trim())) return null;
      context.warnings.push({
        code: "unsupported-block",
        message: "检测到 HTML 内容，平台转换时可能被忽略。"
      });
      return { type: "paragraph", content: [{ type: "text", value: node.value }] };
    default:
      context.warnings.push({
        code: "unsupported-block",
        message: `暂不支持 Markdown 节点：${node.type}`
      });
      return null;
  }
}

function convertList(node: List, context: ParseContext): ArticleBlock {
  return {
    type: "list",
    ordered: Boolean(node.ordered),
    start: node.start ?? 1,
    items: node.children.map((item) => convertListItem(item, context))
  };
}

function convertListItem(node: ListItem, context: ParseContext): ArticleBlock[] {
  return node.children
    .map((child) => convertBlock(child, context))
    .filter((block): block is ArticleBlock => block !== null);
}

function convertQuote(children: RootContent[], context: ParseContext): ArticleBlock {
  const blocks = children
    .map((child) => convertBlock(child, context))
    .filter((block): block is ArticleBlock => block !== null);
  const first = blocks[0];
  if (first?.type === "paragraph") {
    const text = inlineText(first.content);
    const match = text.match(/^\[!([A-Za-z0-9_-]+)\][ \t]*([^\n]*)\n?([\s\S]*)$/);
    if (match) {
      const remaining = match[3]
        ? [{ type: "paragraph", content: [{ type: "text", value: match[3] }] } as ArticleBlock]
        : [];
      return {
        type: "callout",
        calloutType: match[1].toLowerCase(),
        title: match[2],
        blocks: [...remaining, ...blocks.slice(1)]
      };
    }
  }
  return { type: "quote", blocks };
}

function convertTable(node: Table): ArticleBlock {
  return {
    type: "table",
    align: node.align ?? [],
    rows: node.children.map((row) => row.children.map((cell) => phrasingPlainText(cell.children)))
  };
}

function convertInline(nodes: PhrasingContent[], context: ParseContext): InlineContent[] {
  return nodes.flatMap((node): InlineContent[] => {
    switch (node.type) {
      case "text":
        return [{ type: "text", value: node.value }];
      case "strong":
        return [{ type: "strong", content: convertInline(node.children, context) }];
      case "emphasis":
        return [{ type: "emphasis", content: convertInline(node.children, context) }];
      case "delete":
        return [{ type: "delete", content: convertInline(node.children, context) }];
      case "inlineCode":
        return [{ type: "inlineCode", value: node.value }];
      case "link":
        return [{ type: "link", url: node.url, content: convertInline(node.children, context) }];
      case "image": {
        const asset = registerAsset(node.url, node.alt ?? "", context);
        return [{ type: "image", assetId: asset.id, alt: asset.alt }];
      }
      case "break":
        return [{ type: "break" }];
      case "html":
        context.warnings.push({
          code: "unsupported-inline",
          message: "检测到行内 HTML，平台转换时可能被忽略。"
        });
        return [{ type: "text", value: node.value }];
      default:
        context.warnings.push({
          code: "unsupported-inline",
          message: `暂不支持行内 Markdown 节点：${node.type}`
        });
        return [];
    }
  });
}

function registerAsset(source: string, alt: string, context: ParseContext): ArticleAsset {
  const decodedSource = source.startsWith("obsidian-asset:") ? decodeURIComponent(source.slice(15)) : source;
  const kind = /^https?:\/\//.test(decodedSource) ? "remote" : "local";
  const existing = context.assets.find((asset) => asset.source === decodedSource);
  if (existing) return existing;

  const asset: ArticleAsset = {
    id: `asset-${context.assets.length + 1}`,
    source: decodedSource,
    alt,
    kind
  };
  context.assets.push(asset);
  if (kind === "local") {
    context.warnings.push({
      code: "local-asset",
      message: `本地图片需要在发布前解析并上传：${decodedSource}`
    });
  }
  return asset;
}

function calculateStats(blocks: ArticleBlock[], context: ParseContext): ArticleStats {
  const stats: ArticleStats = {
    headings: 0,
    paragraphs: 0,
    lists: 0,
    codeBlocks: 0,
    tables: 0,
    images: context.assets.length,
    warnings: context.warnings.length
  };

  visitBlocks(blocks, (block) => {
    if (block.type === "heading") stats.headings += 1;
    if (block.type === "paragraph") stats.paragraphs += 1;
    if (block.type === "list") stats.lists += 1;
    if (block.type === "code") stats.codeBlocks += 1;
    if (block.type === "table") stats.tables += 1;
  });
  return stats;
}

function visitBlocks(blocks: ArticleBlock[], visitor: (block: ArticleBlock) => void): void {
  for (const block of blocks) {
    visitor(block);
    if (block.type === "quote" || block.type === "callout") visitBlocks(block.blocks, visitor);
    if (block.type === "list") block.items.forEach((item) => visitBlocks(item, visitor));
  }
}

function maxHeadingDepth(blocks: ArticleBlock[]): number {
  let depth = 0;
  visitBlocks(blocks, (block) => {
    if (block.type === "heading") depth = Math.max(depth, block.depth);
  });
  return depth;
}

function findTitle(blocks: ArticleBlock[]): string {
  const heading = blocks.find((block) => block.type === "heading" && block.depth === 1);
  return heading?.type === "heading" ? inlineText(heading.content) : "";
}

function readFrontmatterTitle(value: string): string {
  return value.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? "";
}

function inlineText(content: InlineContent[]): string {
  return content.map((node) => {
    if (node.type === "text" || node.type === "inlineCode") return node.value;
    if (node.type === "break") return "\n";
    if (node.type === "image") return node.alt;
    return inlineText(node.content);
  }).join("");
}

function phrasingPlainText(content: PhrasingContent[]): string {
  return content.map((node) => {
    if ("value" in node && typeof node.value === "string") return node.value;
    if ("children" in node) return phrasingPlainText(node.children);
    if (node.type === "image") return node.alt ?? "";
    return "";
  }).join("");
}

function prepareObsidianEmbeds(markdown: string): string {
  return markdown.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, source: string, alt?: string) => {
    const label = alt ?? source;
    return `![${label}](obsidian-asset:${encodeURIComponent(source)})`;
  });
}
