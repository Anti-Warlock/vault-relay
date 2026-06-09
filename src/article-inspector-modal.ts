import { App, Modal } from "obsidian";
import {
  articleBlockLabel,
  articleBlockPreview,
  parseArticleDocument,
  type ArticleBlock
} from "./document-model";

export class ArticleInspectorModal extends Modal {
  constructor(app: App, private readonly fileName: string, private readonly markdown: string) {
    super(app);
  }

  onOpen(): void {
    const document = parseArticleDocument(this.markdown);
    this.modalEl.addClass("obsidian-publish-inspector");
    this.setTitle(`文章结构检查 · ${this.fileName}`);

    const summary = this.contentEl.createDiv("obsidian-publish-inspector-summary");
    this.addMetric(summary, "标题", document.stats.headings);
    this.addMetric(summary, "段落", document.stats.paragraphs);
    this.addMetric(summary, "列表", document.stats.lists);
    this.addMetric(summary, "代码", document.stats.codeBlocks);
    this.addMetric(summary, "表格", document.stats.tables);
    this.addMetric(summary, "图片", document.stats.images);
    this.addMetric(summary, "警告", document.stats.warnings);

    if (document.warnings.length) {
      const warningSection = this.contentEl.createDiv("obsidian-publish-inspector-warnings");
      warningSection.createEl("h3", { text: "发布前警告" });
      const list = warningSection.createEl("ul");
      document.warnings.forEach((warning) => list.createEl("li", { text: warning.message }));
    }

    const blockSection = this.contentEl.createDiv("obsidian-publish-inspector-blocks");
    blockSection.createEl("h3", { text: `结构节点 · ${document.blocks.length}` });
    this.renderBlocks(blockSection, document.blocks);

    if (document.assets.length) {
      const assetSection = this.contentEl.createDiv("obsidian-publish-inspector-assets");
      assetSection.createEl("h3", { text: `资源 · ${document.assets.length}` });
      const list = assetSection.createEl("ul");
      document.assets.forEach((asset) => {
        list.createEl("li", {
          text: `${asset.kind === "remote" ? "远程" : "本地"} · ${asset.source}`
        });
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private addMetric(container: HTMLElement, label: string, value: number): void {
    const item = container.createDiv("obsidian-publish-inspector-metric");
    item.createEl("strong", { text: String(value) });
    item.createEl("span", { text: label });
  }

  private renderBlocks(container: HTMLElement, blocks: ArticleBlock[], depth = 0): void {
    for (const block of blocks) {
      const item = container.createDiv("obsidian-publish-inspector-block");
      item.style.setProperty("--inspector-depth", String(depth));
      item.createEl("strong", { text: articleBlockLabel(block) });
      item.createEl("p", { text: truncate(articleBlockPreview(block), 180) });

      if (block.type === "quote" || block.type === "callout") {
        this.renderBlocks(container, block.blocks, depth + 1);
      }
      if (block.type === "list") {
        block.items.forEach((listItem) => this.renderBlocks(container, listItem, depth + 1));
      }
    }
  }
}

function truncate(value: string, length: number): string {
  const characters = Array.from(value.trim());
  return characters.length > length ? `${characters.slice(0, length).join("")}…` : value.trim();
}

