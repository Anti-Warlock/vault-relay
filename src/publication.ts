import { parseArticleDocument, type ArticleBlock, type ArticleDocument, type InlineContent } from "./document-model";

export const PUBLICATION_TASK_PREFIX = "VAULT_RELAY_DRAFT_V2\n";

export type PublicationPlatform = "x" | "zhihu" | "wechat" | "xiaohongshu";

export interface PublicationImage {
  kind: "remote" | "local";
  source: string;
  alt: string;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface ThreadItem {
  text: string;
  weightedLength: number;
  images: PublicationImage[];
}

export interface XArticleBlock {
  key: string;
  text: string;
  type: string;
  data: Record<string, unknown>;
  entity_ranges: Array<{ key: number; offset: number; length: number }>;
  inline_style_ranges: Array<{ offset: number; length: number; style: string }>;
}

export interface XArticleEntity {
  key: number;
  value: {
    type: string;
    mutability: string;
    data: Record<string, unknown>;
  };
}

export interface XArticleContentState {
  blocks: XArticleBlock[];
  entity_map: XArticleEntity[];
}

export interface PublicationIssue {
  severity: "warning" | "error";
  code: string;
  message: string;
}

export interface PublicationTask {
  version: 2;
  generatorVersion: string;
  id: string;
  platform: PublicationPlatform;
  title: string;
  sourcePath: string;
  createdAt: string;
  editorUrl: string;
  issues: PublicationIssue[];
  content: {
    plainText: string;
    richHtml?: string;
    items?: ThreadItem[];
    xArticle?: XArticleContentState;
    images: PublicationImage[];
    coverImage?: PublicationImage;
    mode?: "image-note" | "article" | "x-article";
  };
}

export interface PlatformDefinition {
  id: PublicationPlatform;
  name: string;
  description: string;
  output: string;
  availability: "available" | "testing" | "coming-soon";
}

export const PLATFORM_DEFINITIONS: PlatformDefinition[] = [
  { id: "x", name: "X", description: "为 X Premium 创作者生成 Article 草稿，保留文章结构和图片顺序。", output: "Article 草稿", availability: "available" },
  { id: "zhihu", name: "知乎", description: "生成标题、富文本正文、封面和按原文排序的图片。", output: "文章草稿", availability: "available" },
  { id: "wechat", name: "微信公众号", description: "生成公众号图文草稿，填入标题、富文本正文、图片，并使用正文首图作为封面。", output: "图文草稿", availability: "available" },
  { id: "xiaohongshu", name: "小红书", description: "短内容生成图文笔记，长内容自动切换文章模式并保留结构。", output: "图文/长文草稿", availability: "available" }
];

export function createPublicationTask(
  platform: PublicationPlatform,
  markdown: string,
  title: string,
  sourcePath: string,
  generatorVersion: string
): PublicationTask {
  const document = parseArticleDocument(markdown);
  const plainText = articleDocumentToPlainText(document);
  const images = document.assets.map((asset) => ({
    kind: asset.kind,
    source: asset.source,
    alt: asset.alt
  } satisfies PublicationImage));
  const base = {
    version: 2 as const,
    generatorVersion,
    id: createTaskId(),
    platform,
    title: document.title || title,
    sourcePath,
    createdAt: new Date().toISOString(),
    issues: [
      ...document.warnings.map((warning) => ({
        severity: "warning" as const,
        code: warning.code,
        message: warning.message
      })),
      ...platformSupportIssues(platform)
    ]
  };

  if (platform === "x") {
    return {
      ...base,
      editorUrl: "https://x.com/compose/articles",
      issues: [
        ...base.issues,
        {
          severity: "warning" as const,
          code: "x-premium-required",
          message: "X Articles 需要 X Premium、Premium+ 或 Business 账号。"
        }
      ],
      content: {
        plainText,
        images,
        mode: "x-article",
        xArticle: createXArticleContentState(document)
      }
    };
  }

  if (platform === "xiaohongshu") {
    const titleText = document.title || title;
    const titleLimit = 20;
    const bodyLimit = 1000;
    const useArticleMode = Array.from(plainText).length > bodyLimit;
    if (useArticleMode) {
      return {
        ...base,
        title: titleText,
        editorUrl: "https://creator.xiaohongshu.com/publish/publish?from=homepage&target=article",
        issues: [
          ...base.issues,
          {
            severity: "warning" as const,
            code: "xiaohongshu-article-mode",
            message: "正文超过图文笔记长度，已自动切换为小红书长文模式，请发布前检查平台排版。"
          }
        ],
        content: {
          plainText,
          richHtml: renderArticleHtml(document, "zhihu"),
          images,
          mode: "article"
        }
      };
    }
    return {
      ...base,
      title: truncateText(titleText, titleLimit),
      editorUrl: "https://creator.xiaohongshu.com/publish/publish?from=homepage&target=image",
      issues: [
        ...base.issues,
        ...(Array.from(titleText).length > titleLimit ? [{
          severity: "warning" as const,
          code: "xiaohongshu-title-truncated",
          message: `小红书标题超过 ${titleLimit} 字，已生成精简标题，请发布前检查。`
        }] : []),
        ...(images.length > 18 ? [{
          severity: "error" as const,
          code: "xiaohongshu-too-many-images",
          message: `小红书图文草稿包含 ${images.length} 张图片，超过当前适配器支持的 18 张。`
        }] : [])
      ],
      content: {
        plainText,
        images,
        mode: "image-note"
      }
    };
  }

  return {
    ...base,
    editorUrl: platform === "zhihu" ? "https://zhuanlan.zhihu.com/write" : "https://mp.weixin.qq.com/",
    issues: [
      ...base.issues,
      ...(images.some((image) => image.kind === "remote") ? [{
        severity: "warning" as const,
        code: "remote-images-require-download",
        message: "富文本包含远程图片，Companion Pro 将先下载图片再填入；请检查平台是否完成托管。"
      }] : [])
    ],
    content: {
      plainText,
      richHtml: renderArticleHtml(document, platform),
      images,
      ...((platform === "zhihu" || platform === "wechat") && images[0] ? { coverImage: images[0] } : {})
    }
  };
}

function platformSupportIssues(_platform: PublicationPlatform): PublicationIssue[] {
  return [];
}

export function serializePublicationTask(task: PublicationTask): string {
  return `${PUBLICATION_TASK_PREFIX}${JSON.stringify(task)}`;
}

export function omitUnavailableImage(task: PublicationTask, source: string, reason: string): void {
  task.content.images = task.content.images.filter((image) => image.source !== source);
  if (task.content.coverImage?.source === source) delete task.content.coverImage;
  task.content.items?.forEach((item) => {
    item.images = item.images.filter((image) => image.source !== source);
  });
  if (task.content.xArticle) {
    const removedKeys = new Set(task.content.xArticle.entity_map
      .filter((entity) => entity.value.data.source === source)
      .map((entity) => entity.key));
    task.content.xArticle.entity_map = task.content.xArticle.entity_map.filter((entity) => !removedKeys.has(entity.key));
    task.content.xArticle.blocks = task.content.xArticle.blocks.filter((block) =>
      !block.entity_ranges.some((range) => removedKeys.has(range.key))
    );
  }
  if (task.content.richHtml) {
    const encodedSource = escapeAttribute(source);
    const sourcePattern = escapeRegExp(encodedSource);
    task.content.richHtml = task.content.richHtml
      .replace(new RegExp(`<p([^>]*)>\\s*<img([^>]*)src="${sourcePattern}"([^>]*)>\\s*</p>`, "gi"), "")
      .replace(new RegExp(`<img([^>]*)src="${sourcePattern}"([^>]*)>`, "gi"), "");
  }
  if (!task.issues.some((issue) => issue.code === "image-unavailable" && issue.message.includes(source))) {
    task.issues.push({
      severity: "warning",
      code: "image-unavailable",
      message: `图片无法读取，已跳过该图片但会继续填入正文：${source}（${reason}）`
    });
  }
}

function createXArticleContentState(document: ArticleDocument): XArticleContentState {
  const blocks: XArticleBlock[] = [];
  const entity_map: XArticleEntity[] = [];
  const addEntity = (type: string, mutability: string, data: Record<string, unknown>): number => {
    const key = entity_map.length;
    entity_map.push({ key, value: { type, mutability, data } });
    return key;
  };
  const addTextBlock = (
    text: string,
    type = "unstyled",
    inline_style_ranges: XArticleBlock["inline_style_ranges"] = [],
    entity_ranges: XArticleBlock["entity_ranges"] = []
  ) => {
    blocks.push({ key: randomBlockKey(), text, type, data: {}, entity_ranges, inline_style_ranges });
  };
  const addAtomicEntity = (entityKey: number) => {
    addTextBlock(" ", "atomic", [], [{ key: entityKey, offset: 0, length: 1 }]);
  };
  const renderBlockToPlainText = (block: ArticleBlock): string => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return inlineText(block.content);
      case "list":
        return block.items.map((item) => item.map(renderBlockToPlainText).join(" ")).join("\n");
      case "quote":
      case "callout":
        return block.blocks.map(renderBlockToPlainText).join("\n");
      case "code":
        return block.value;
      case "table":
        return block.rows.map((row) => row.join(" | ")).join("\n");
      case "image":
      case "thematicBreak":
        return "";
    }
  };

  document.blocks.forEach((block, index) => {
    if (index === 0 && block.type === "heading" && block.depth === 1) return;
    if (block.type === "image") {
      const asset = document.assets.find((item) => item.id === block.assetId);
      if (asset) addAtomicEntity(addEntity("MEDIA", "Immutable", { source: asset.source, alt: block.alt }));
      return;
    }
    if (block.type === "thematicBreak") {
      addAtomicEntity(addEntity("DIVIDER", "Immutable", {}));
      return;
    }
    if (block.type === "code") {
      addAtomicEntity(addEntity("MARKDOWN", "Immutable", {
        markdown: `\`\`\`${block.language ?? ""}\n${block.value}\n\`\`\``
      }));
      return;
    }
    if (block.type === "table") {
      addAtomicEntity(addEntity("MARKDOWN", "Immutable", {
        markdown: block.rows.map((row) => `| ${row.join(" | ")} |`).join("\n")
      }));
      return;
    }
    if (block.type === "list") {
      block.items.forEach((item) => {
        const paragraph = item.find((child) => child.type === "paragraph");
        if (paragraph?.type === "paragraph") {
          const compiled = compileXInline(paragraph.content, addEntity);
          addTextBlock(
            compiled.text,
            block.ordered ? "ordered-list-item" : "unordered-list-item",
            compiled.inlineStyleRanges,
            compiled.entityRanges
          );
          return;
        }
        addTextBlock(
          item.map(renderBlockToPlainText).join(" "),
          block.ordered ? "ordered-list-item" : "unordered-list-item"
        );
      });
      return;
    }
    const compiled = block.type === "heading" || block.type === "paragraph"
      ? compileXInline(block.content, addEntity)
      : null;
    const text = compiled?.text ?? renderBlockToPlainText(block);
    const type = block.type === "heading"
      ? block.depth <= 2 ? "header-one" : "header-two"
      : block.type === "quote" || block.type === "callout" ? "blockquote" : "unstyled";
    addTextBlock(text, type, compiled?.inlineStyleRanges, compiled?.entityRanges);
  });
  if (!blocks.length) addTextBlock("");
  return { blocks, entity_map };
}

function compileXInline(
  content: InlineContent[],
  addEntity: (type: string, mutability: string, data: Record<string, unknown>) => number
): {
  text: string;
  inlineStyleRanges: XArticleBlock["inline_style_ranges"];
  entityRanges: XArticleBlock["entity_ranges"];
} {
  let text = "";
  const inlineStyleRanges: XArticleBlock["inline_style_ranges"] = [];
  const entityRanges: XArticleBlock["entity_ranges"] = [];
  const length = (value: string) => Array.from(value).length;
  const append = (value: string, styles: string[] = [], entityKey?: number) => {
    const offset = length(text);
    const valueLength = length(value);
    text += value;
    styles.forEach((style) => inlineStyleRanges.push({ offset, length: valueLength, style }));
    if (entityKey !== undefined) entityRanges.push({ key: entityKey, offset, length: valueLength });
  };
  const visit = (nodes: InlineContent[], styles: string[] = [], entityKey?: number) => {
    nodes.forEach((node) => {
      if (node.type === "text") append(node.value, styles, entityKey);
      if (node.type === "inlineCode") append(node.value, [...styles, "Bold"], entityKey);
      if (node.type === "break") append("\n", styles, entityKey);
      if (node.type === "image") append(node.alt, styles, entityKey);
      if (node.type === "strong") visit(node.content, [...styles, "Bold"], entityKey);
      if (node.type === "emphasis") visit(node.content, [...styles, "Italic"], entityKey);
      if (node.type === "delete") visit(node.content, [...styles, "Strikethrough"], entityKey);
      if (node.type === "link") {
        visit(node.content, styles, addEntity("LINK", "Mutable", { url: node.url }));
      }
    });
  };
  visit(content);
  return { text, inlineStyleRanges, entityRanges };
}

function inlineText(content: InlineContent[]): string {
  return content.map((node) => {
    switch (node.type) {
      case "text":
      case "inlineCode":
        return node.value;
      case "strong":
      case "emphasis":
      case "delete":
      case "link":
        return inlineText(node.content);
      case "image":
        return "";
      case "break":
        return "\n";
    }
  }).join("");
}

function articleDocumentToPlainText(document: ArticleDocument): string {
  const blocks = document.blocks.filter((block, index) =>
    !(index === 0 && block.type === "heading" && block.depth === 1)
  );
  return blocks
    .map((block) => blockPlainText(block))
    .filter(Boolean)
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function blockPlainText(block: ArticleBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return inlineText(block.content).trim();
    case "list":
      return block.items.map((item, index) => {
        const marker = block.ordered ? `${block.start + index}.` : "•";
        return `${marker} ${item.map(blockPlainText).filter(Boolean).join(" ")}`;
      }).join("\n");
    case "quote":
      return block.blocks.map(blockPlainText).filter(Boolean).map((line) => `> ${line}`).join("\n");
    case "callout": {
      const title = block.title || block.calloutType;
      const body = block.blocks.map(blockPlainText).filter(Boolean).join("\n");
      return [title, body].filter(Boolean).join("\n");
    }
    case "code":
      return block.value.trim();
    case "table":
      return block.rows.map((row) => row.join(" | ")).join("\n");
    case "image":
    case "thematicBreak":
      return "";
  }
}

function randomBlockKey(): string {
  return Math.random().toString(36).slice(2, 7).padEnd(5, "0");
}

function renderArticleHtml(document: ArticleDocument, platform: "zhihu" | "wechat"): string {
  const blocks = document.blocks.filter((block, index) => !(index === 0 && block.type === "heading" && block.depth === 1));
  const body = blocks.map((block) => renderBlock(block, document, platform)).join("");
  return platform === "wechat"
    ? `<section style="font-size:16px;line-height:1.75;color:#242424;">${body}</section>`
    : body;
}

function renderBlock(block: ArticleBlock, document: ArticleDocument, platform: "zhihu" | "wechat"): string {
  switch (block.type) {
    case "heading": {
      const level = Math.min(block.depth, 3);
      return `<h${level}${style(platform, level === 2 ? "h2" : "h3")}>${renderInline(block.content, document)}</h${level}>`;
    }
    case "paragraph":
      return `<p${style(platform, "p")}>${renderInline(block.content, document)}</p>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}${style(platform, "list")}>${block.items.map((item) => `<li>${item.map((child) => renderBlock(child, document, platform)).join("")}</li>`).join("")}</${tag}>`;
    }
    case "quote":
      return `<blockquote${style(platform, "quote")}>${block.blocks.map((child) => renderBlock(child, document, platform)).join("")}</blockquote>`;
    case "callout":
      return `<blockquote${style(platform, "quote")}><strong>${escapeHtml(block.title || block.calloutType)}</strong>${block.blocks.map((child) => renderBlock(child, document, platform)).join("")}</blockquote>`;
    case "code":
      return `<pre${style(platform, "code")}><code>${escapeHtml(block.value)}</code></pre>`;
    case "table":
      return `<table${style(platform, "table")}>${block.rows.map((row, rowIndex) => `<tr>${row.map((cell) => `<${rowIndex === 0 ? "th" : "td"} style="border:1px solid #d9d9d9;padding:6px 8px;">${escapeHtml(cell)}</${rowIndex === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table>`;
    case "image": {
      const asset = document.assets.find((item) => item.id === block.assetId);
      return asset ? `<p${style(platform, "image")}><img src="${escapeAttribute(asset.source)}" alt="${escapeAttribute(block.alt)}" style="max-width:100%;height:auto;"></p>` : "";
    }
    case "thematicBreak":
      return "<hr>";
  }
}

function style(platform: "zhihu" | "wechat", element: "h2" | "h3" | "p" | "list" | "quote" | "code" | "table" | "image"): string {
  if (platform !== "wechat") return "";
  const styles = {
    h2: "font-size:22px;line-height:1.4;margin:28px 0 12px;font-weight:700;color:#171717;",
    h3: "font-size:18px;line-height:1.5;margin:22px 0 10px;font-weight:700;color:#333;",
    p: "margin:12px 0;line-height:1.75;",
    list: "margin:12px 0;padding-left:24px;",
    quote: "margin:16px 0;padding:10px 14px;border-left:4px solid #7357ff;background:#f7f5ff;color:#555;",
    code: "margin:16px 0;padding:12px;overflow:auto;background:#17191d;color:#f1f1f1;border-radius:6px;white-space:pre-wrap;",
    table: "width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;",
    image: "margin:18px 0;text-align:center;"
  };
  return ` style="${styles[element]}"`;
}

function renderInline(content: InlineContent[], document: ArticleDocument): string {
  return content.map((node) => {
    switch (node.type) {
      case "text":
        return escapeHtml(node.value);
      case "strong":
        return `<strong>${renderInline(node.content, document)}</strong>`;
      case "emphasis":
        return `<em>${renderInline(node.content, document)}</em>`;
      case "delete":
        return `<del>${renderInline(node.content, document)}</del>`;
      case "inlineCode":
        return `<code>${escapeHtml(node.value)}</code>`;
      case "link":
        return `<a href="${escapeAttribute(node.url)}">${renderInline(node.content, document)}</a>`;
      case "image": {
        const asset = document.assets.find((item) => item.id === node.assetId);
        return asset ? `<img src="${escapeAttribute(asset.source)}" alt="${escapeAttribute(node.alt)}">` : "";
      }
      case "break":
        return "<br>";
    }
  }).join("");
}

function truncateText(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createTaskId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `vault-relay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
