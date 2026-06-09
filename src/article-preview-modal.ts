import { App, Modal, TFile } from "obsidian";
import {
  parseArticleDocument,
  type ArticleAsset,
  type ArticleBlock,
  type ArticleDocument,
  type InlineContent
} from "./document-model";

export class ArticlePreviewModal extends Modal {
  constructor(
    app: App,
    private readonly fileName: string,
    private readonly sourcePath: string,
    private readonly markdown: string
  ) {
    super(app);
  }

  onOpen(): void {
    const document = parseArticleDocument(this.markdown);
    this.modalEl.addClass("obsidian-publish-preview-modal");
    this.setTitle(`发布预览 · ${this.fileName}`);

    const workspace = this.contentEl.createDiv("obsidian-publish-preview-workspace");
    this.renderChecklist(workspace.createDiv("obsidian-publish-preview-sidebar"), document);
    this.renderArticle(workspace.createEl("article", { cls: "obsidian-publish-article-preview" }), document);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderChecklist(container: HTMLElement, document: ArticleDocument): void {
    container.createEl("span", { cls: "obsidian-publish-eyebrow", text: "PUBLISH CHECK" });
    container.createEl("h2", { text: "发布准备情况" });
    container.createEl("p", {
      cls: "obsidian-publish-muted",
      text: "当前预览基于平台无关文章结构生成。"
    });

    const score = readinessScore(document);
    const scoreCard = container.createDiv("obsidian-publish-score");
    scoreCard.createEl("strong", { text: String(score) });
    scoreCard.createEl("span", { text: "/ 100" });
    scoreCard.createEl("p", { text: readinessLabel(score) });

    const metrics = container.createDiv("obsidian-publish-preview-metrics");
    this.addMetric(metrics, "结构节点", document.blocks.length);
    this.addMetric(metrics, "图片资源", document.stats.images);
    this.addMetric(metrics, "代码与表格", document.stats.codeBlocks + document.stats.tables);
    this.addMetric(metrics, "待处理项", document.stats.warnings);

    container.createEl("h3", { text: "检查清单" });
    const checks = container.createDiv("obsidian-publish-checks");
    this.addCheck(checks, Boolean(document.title), "文章标题", document.title || "缺少标题");
    this.addCheck(checks, document.stats.warnings === 0, "资源与格式", warningSummary(document));
    this.addCheck(checks, document.blocks.length >= 3, "长内容结构", `${document.blocks.length} 个顶层节点`);
    this.addCheck(checks, true, "内容留在本地", "未上传到 VaultRelay 服务器");

    if (document.warnings.length) {
      container.createEl("h3", { text: "需要处理" });
      const list = container.createEl("ul", { cls: "obsidian-publish-preview-warning-list" });
      document.warnings.forEach((warning) => list.createEl("li", { text: warning.message }));
    }
  }

  private renderArticle(container: HTMLElement, document: ArticleDocument): void {
    const header = container.createEl("header");
    header.createEl("span", { cls: "obsidian-publish-eyebrow", text: "LOCAL-FIRST ARTICLE PREVIEW" });
    if (document.title) header.createEl("h1", { text: document.title });
    header.createEl("p", {
      cls: "obsidian-publish-article-meta",
      text: `${document.stats.paragraphs} 个段落 · ${document.stats.images} 张图片 · ${document.stats.codeBlocks} 个代码块`
    });

    const body = container.createDiv("obsidian-publish-article-body");
    document.blocks.forEach((block) => this.renderBlock(body, block, document));
  }

  private renderBlock(container: HTMLElement, block: ArticleBlock, document: ArticleDocument): void {
    switch (block.type) {
      case "heading": {
        const depth = Math.min(block.depth + 1, 6) as 2 | 3 | 4 | 5 | 6;
        this.renderInline(container.createEl(`h${depth}`), block.content, document);
        return;
      }
      case "paragraph":
        this.renderInline(container.createEl("p"), block.content, document);
        return;
      case "list": {
        const list = block.ordered ? container.createEl("ol") : container.createEl("ul");
        if (block.ordered) list.setAttr("start", String(block.start));
        block.items.forEach((item) => {
          const li = list.createEl("li");
          item.forEach((child) => this.renderBlock(li, child, document));
        });
        return;
      }
      case "quote": {
        const quote = container.createEl("blockquote");
        block.blocks.forEach((child) => this.renderBlock(quote, child, document));
        return;
      }
      case "callout": {
        const callout = container.createDiv("obsidian-publish-callout");
        callout.createEl("strong", { text: block.title || block.calloutType.toUpperCase() });
        block.blocks.forEach((child) => this.renderBlock(callout, child, document));
        return;
      }
      case "code": {
        const figure = container.createEl("figure", { cls: "obsidian-publish-code" });
        figure.createEl("figcaption", { text: block.language || "CODE" });
        figure.createEl("pre").createEl("code", { text: block.value });
        return;
      }
      case "table": {
        const wrapper = container.createDiv("obsidian-publish-table-wrapper");
        const table = wrapper.createEl("table");
        block.rows.forEach((row, rowIndex) => {
          const tr = table.createEl("tr");
          row.forEach((cell) => tr.createEl(rowIndex === 0 ? "th" : "td", { text: cell }));
        });
        return;
      }
      case "image":
        this.renderImage(container, findAsset(document, block.assetId), block.alt);
        return;
      case "thematicBreak":
        container.createEl("hr");
        return;
    }
  }

  private renderInline(container: HTMLElement, content: InlineContent[], document: ArticleDocument): void {
    content.forEach((node) => {
      switch (node.type) {
        case "text":
          container.appendText(node.value);
          return;
        case "strong":
          this.renderInline(container.createEl("strong"), node.content, document);
          return;
        case "emphasis":
          this.renderInline(container.createEl("em"), node.content, document);
          return;
        case "delete":
          this.renderInline(container.createEl("del"), node.content, document);
          return;
        case "inlineCode":
          container.createEl("code", { text: node.value });
          return;
        case "link":
          this.renderInline(container.createEl("a", { href: node.url }), node.content, document);
          return;
        case "image":
          this.renderImage(container, findAsset(document, node.assetId), node.alt);
          return;
        case "break":
          container.createEl("br");
          return;
      }
    });
  }

  private renderImage(container: HTMLElement, asset: ArticleAsset | undefined, alt: string): void {
    const figure = container.createEl("figure", { cls: "obsidian-publish-image" });
    const source = asset ? this.resolveAssetSource(asset) : "";
    if (source) {
      figure.createEl("img", { attr: { src: source, alt } });
    } else {
      figure.createDiv({ cls: "obsidian-publish-image-placeholder", text: "本地图片将在发布前解析" });
    }
    if (alt) figure.createEl("figcaption", { text: alt });
  }

  private resolveAssetSource(asset: ArticleAsset): string {
    if (asset.kind === "remote") return asset.source;
    const file = this.app.metadataCache.getFirstLinkpathDest(asset.source, this.sourcePath);
    return file instanceof TFile ? this.app.vault.getResourcePath(file) : "";
  }

  private addMetric(container: HTMLElement, label: string, value: number): void {
    const metric = container.createDiv("obsidian-publish-preview-metric");
    metric.createEl("strong", { text: String(value) });
    metric.createEl("span", { text: label });
  }

  private addCheck(container: HTMLElement, passed: boolean, title: string, detail: string): void {
    const check = container.createDiv("obsidian-publish-check");
    check.createSpan({ cls: passed ? "is-passed" : "is-warning", text: passed ? "✓" : "!" });
    const copy = check.createDiv();
    copy.createEl("strong", { text: title });
    copy.createEl("p", { text: detail });
  }
}

function findAsset(document: ArticleDocument, id: string): ArticleAsset | undefined {
  return document.assets.find((asset) => asset.id === id);
}

function readinessScore(document: ArticleDocument): number {
  let score = 100;
  if (!document.title) score -= 20;
  score -= Math.min(document.warnings.length * 12, 48);
  if (document.blocks.length < 3) score -= 10;
  return Math.max(score, 0);
}

function readinessLabel(score: number): string {
  if (score >= 90) return "适合进入平台输出阶段";
  if (score >= 70) return "建议处理警告后输出";
  return "发布前需要调整";
}

function warningSummary(document: ArticleDocument): string {
  return document.warnings.length ? `${document.warnings.length} 个待处理项` : "未发现阻塞问题";
}
