const MAX_POST_LENGTH = 280;

export interface ImageReference {
  kind: "remote" | "local";
  source: string;
}

export function markdownToPost(markdown: string): string {
  const text = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\\n/g, "\n")
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/!\[\[([^\]]+)\]\]/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 $2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "• ")
    .replace(/^[ \t]*(\d+)[.)][ \t]+/gm, "$1. ")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

  return normalizeLongFormText(text);
}

export function extractRemoteImageUrls(markdown: string): string[] {
  const urls = Array.from(
    markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g),
    (match) => match[1]
  );
  return Array.from(new Set(urls));
}

export function mapRemoteImagesToPosts(markdown: string, posts: string[]): string[][] {
  return mapImageReferencesToPosts(markdown, posts).map((images) =>
    images.filter((image) => image.kind === "remote").map((image) => image.source)
  );
}

export function mapImageReferencesToPosts(markdown: string, posts: string[]): ImageReference[][] {
  if (!posts.length) return [];

  const references: ImageReference[][] = posts.map(() => []);
  const imagePattern = /(!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\))/g;
  const parts = markdown.replace(/\r\n?/g, "\n").split(imagePattern);
  let precedingText = "";

  for (const part of parts) {
    const image = parseImageReference(part);
    if (!image) {
      precedingText += part;
      continue;
    }

    const context = markdownToPost(precedingText).slice(-80);
    const index = findBestPostIndex(context, posts);
    if (!references[index].some((item) => item.source === image.source)) {
      references[index].push(image);
    }
  }

  return references;
}

function parseImageReference(value: string): ImageReference | null {
  const embed = value.match(/^!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (embed) return { kind: "local", source: embed[1] };

  const markdownImage = value.match(/^!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)$/);
  if (!markdownImage) return null;
  return {
    kind: /^https?:\/\//.test(markdownImage[1]) ? "remote" : "local",
    source: markdownImage[1]
  };
}

export function splitIntoPosts(
  text: string,
  addThreadNumbers: boolean,
  maxLength = MAX_POST_LENGTH
): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (countXWeightedCharacters(clean) <= maxLength) return [clean];

  let posts = splitWithLimit(clean, maxLength);
  if (!addThreadNumbers || posts.length === 1) return posts;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const suffixLength = `\n\n${posts.length}/${posts.length}`.length;
    const next = splitWithLimit(clean, maxLength - suffixLength);
    if (next.length === posts.length) {
      return next.map((post, index) => `${post}\n\n${index + 1}/${next.length}`);
    }
    posts = next;
  }

  return posts.map((post, index) => `${post}\n\n${index + 1}/${posts.length}`);
}

export function countCharacters(text: string): number {
  return Array.from(text).length;
}

export function countXWeightedCharacters(text: string): number {
  const normalized = text.normalize("NFC");
  const urlPattern = /https?:\/\/[^\s]+/g;
  let weight = 0;
  let cursor = 0;

  for (const match of normalized.matchAll(urlPattern)) {
    const index = match.index ?? cursor;
    weight += countWeightedGraphemes(normalized.slice(cursor, index));
    weight += 23;
    cursor = index + match[0].length;
  }

  return weight + countWeightedGraphemes(normalized.slice(cursor));
}

function splitWithLimit(text: string, limit: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const posts: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (fits(current, paragraph, limit)) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    if (current) {
      posts.push(current);
      current = "";
    }

    const pieces = splitLongText(paragraph, limit);
    posts.push(...pieces.slice(0, -1));
    current = pieces.at(-1) ?? "";
  }

  if (current) posts.push(current);
  return rebalanceShortTail(posts, limit);
}

function splitLongText(text: string, limit: number): string[] {
  const sentences = text.split(/(?<=[。！？!?；;])\s*/).filter(Boolean);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (fits(current, sentence, limit, "")) {
      current += sentence;
      continue;
    }

    if (current) {
      pieces.push(current);
      current = "";
    }

    if (countXWeightedCharacters(sentence) <= limit) {
      current = sentence;
    } else {
      const graphemes = segmentGraphemes(sentence);
      let chunk = "";
      for (const grapheme of graphemes) {
        if (chunk && countXWeightedCharacters(`${chunk}${grapheme}`) > limit) {
          pieces.push(chunk);
          chunk = "";
        }
        chunk += grapheme;
      }
      current = chunk;
    }
  }

  if (current) pieces.push(current);
  return pieces;
}

function fits(current: string, next: string, limit: number, separator = "\n\n"): boolean {
  return countXWeightedCharacters(current ? `${current}${separator}${next}` : next) <= limit;
}

function normalizeLongFormText(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => normalizeBlock(block))
    .filter(Boolean)
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBlock(block: string): string {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";

  const hasStructuredLines = lines.some((line) => /^([•-]|\d+\.)\s+/.test(line));
  if (hasStructuredLines) return lines.join("\n");

  return lines.reduce((result, line) => {
    if (!result) return line;
    return `${result}${softLineSeparator(result, line)}${line}`;
  }, "");
}

function softLineSeparator(previous: string, next: string): string {
  if (/[-/([{"'“‘]$/.test(previous)) return "";
  if (/^[,.;:!?，。！？；：、)\]}"'”’]/.test(next)) return "";
  if (/[\u4e00-\u9fff]$/.test(previous) || /^[\u4e00-\u9fff]/.test(next)) return "";
  return " ";
}

function findBestPostIndex(context: string, posts: string[]): number {
  if (!context) return 0;
  const normalizedContext = context.replace(/\s+/g, "");

  for (let index = posts.length - 1; index >= 0; index -= 1) {
    const normalizedPost = posts[index].replace(/\s+/g, "");
    if (normalizedPost.includes(normalizedContext) || normalizedContext.includes(normalizedPost.slice(-40))) {
      return index;
    }
  }

  return 0;
}

function rebalanceShortTail(posts: string[], limit: number): string[] {
  if (posts.length < 2) return posts;
  const last = posts.at(-1) ?? "";
  const previous = posts.at(-2) ?? "";
  if (countXWeightedCharacters(last) >= Math.min(80, Math.floor(limit * 0.3))) return posts;

  const separator = "\n\n";
  if (countXWeightedCharacters(`${previous}${separator}${last}`) <= limit) {
    return [...posts.slice(0, -2), `${previous}${separator}${last}`];
  }

  const sentences = previous.split(/(?<=[。！？!?；;])\s*/).filter(Boolean);
  let moved = "";
  while (sentences.length > 1) {
    const candidate = sentences.pop() ?? "";
    const nextMoved = `${candidate}${moved}`;
    if (countXWeightedCharacters(`${nextMoved}${separator}${last}`) > limit) {
      sentences.push(candidate);
      break;
    }
    moved = nextMoved;
    if (countXWeightedCharacters(`${moved}${separator}${last}`) >= Math.min(120, Math.floor(limit * 0.45))) break;
  }

  if (!moved) return posts;
  return [...posts.slice(0, -2), sentences.join(""), `${moved}${separator}${last}`];
}

function countWeightedGraphemes(text: string): number {
  return segmentGraphemes(text).reduce((total, grapheme) => total + graphemeWeight(grapheme), 0);
}

function graphemeWeight(grapheme: string): number {
  const codePoints = Array.from(grapheme, (character) => character.codePointAt(0) ?? 0);
  return codePoints.every(isSingleWeightCodePoint) ? codePoints.length : 2;
}

function isSingleWeightCodePoint(codePoint: number): boolean {
  return (
    codePoint <= 0x10ff ||
    (codePoint >= 0x2000 && codePoint <= 0x200d) ||
    (codePoint >= 0x2010 && codePoint <= 0x201f) ||
    (codePoint >= 0x2032 && codePoint <= 0x2037)
  );
}

function segmentGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}
