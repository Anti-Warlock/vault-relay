import { App, Modal, Notice, normalizePath, TFile } from "obsidian";
import { toPng } from "html-to-image";
import { compileArticleCards, type ArticleCard } from "./card-compiler";
import {
  parseArticleDocument,
  type ArticleAsset,
  type ArticleBlock,
  type ArticleDocument,
  type InlineContent
} from "./document-model";

export class ThreadCardsModal extends Modal {
  private cardElements: HTMLElement[] = [];
  private exportButton?: HTMLButtonElement;

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
    const cards = compileArticleCards(document);
    this.modalEl.addClass("obsidian-thread-cards-modal");
    this.setTitle(`长文图片卡片 · ${cards.length} 张`);

    const toolbar = this.contentEl.createDiv("obsidian-thread-cards-toolbar");
    toolbar.createEl("p", {
      text: `将按文章结构导出 ${cards.length} 张 1200×1500 PNG 到当前 Vault。`
    });
    this.exportButton = toolbar.createEl("button", { cls: "mod-cta", text: "导出全部 PNG" });
    this.exportButton.addEventListener("click", () => void this.exportCards());

    const gallery = this.contentEl.createDiv("obsidian-thread-cards-gallery");
    cards.forEach((card) => {
      const wrapper = gallery.createDiv("obsidian-thread-card-wrapper");
      wrapper.createEl("span", {
        cls: card.mayOverflow ? "obsidian-thread-card-status is-warning" : "obsidian-thread-card-status",
        text: card.mayOverflow ? `卡片 ${card.index + 1} · 可能过长` : `卡片 ${card.index + 1}`
      });
      const element = wrapper.createDiv("obsidian-thread-card");
      this.renderCard(element, document, card, cards.length);
      this.cardElements.push(element);
    });
  }

  onClose(): void {
    this.cardElements = [];
    this.contentEl.empty();
  }

  private renderCard(
    container: HTMLElement,
    document: ArticleDocument,
    card: ArticleCard,
    totalCards: number
  ): void {
    const header = container.createEl("header");
    header.createEl("span", { text: "OBSIDIAN PUBLISH STUDIO" });
    header.createEl("strong", { text: `${card.index + 1} / ${totalCards}` });

    const body = container.createDiv("obsidian-thread-card-body");
    if (card.index === 0 && document.title) body.createEl("h1", { text: document.title });
    card.blocks.forEach((block) => this.renderBlock(body, block, document));

    const footer = container.createEl("footer");
    footer.createEl("span", { text: "Written in Obsidian · Compiled locally" });
    footer.createEl("b", { text: "OPS" });
  }

  private renderBlock(container: HTMLElement, block: ArticleBlock, document: ArticleDocument): void {
    switch (block.type) {
      case "heading": {
        const level = Math.min(block.depth + 1, 4) as 2 | 3 | 4;
        this.renderInline(container.createEl(`h${level}`), block.content, document);
        return;
      }
      case "paragraph":
        this.renderInline(container.createEl("p"), block.content, document);
        return;
      case "list": {
        const list = block.ordered ? container.createEl("ol") : container.createEl("ul");
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
        const callout = container.createDiv("obsidian-thread-card-callout");
        callout.createEl("strong", { text: block.title || block.calloutType.toUpperCase() });
        block.blocks.forEach((child) => this.renderBlock(callout, child, document));
        return;
      }
      case "code": {
        const code = container.createEl("figure", { cls: "obsidian-thread-card-code" });
        code.createEl("figcaption", { text: block.language || "CODE" });
        code.createEl("pre").createEl("code", { text: block.value });
        return;
      }
      case "table": {
        const table = container.createEl("table");
        block.rows.forEach((row, rowIndex) => {
          const tr = table.createEl("tr");
          row.forEach((cell) => tr.createEl(rowIndex === 0 ? "th" : "td", { text: cell }));
        });
        return;
      }
      case "image": {
        const asset = document.assets.find((item) => item.id === block.assetId);
        const source = asset ? this.resolveAssetSource(asset) : "";
        const figure = container.createEl("figure", { cls: "obsidian-thread-card-image" });
        if (source) figure.createEl("img", { attr: { src: source, alt: block.alt } });
        else figure.createDiv({ text: `图片待处理 · ${block.alt || asset?.source || ""}` });
        return;
      }
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
          this.renderInline(container.createEl("span"), node.content, document);
          return;
        case "image": {
          const asset = document.assets.find((item) => item.id === node.assetId);
          const source = asset ? this.resolveAssetSource(asset) : "";
          if (source) container.createEl("img", { attr: { src: source, alt: node.alt } });
          return;
        }
        case "break":
          container.createEl("br");
          return;
      }
    });
  }

  private resolveAssetSource(asset: ArticleAsset): string {
    if (asset.kind === "remote") return asset.source;
    const file = this.app.metadataCache.getFirstLinkpathDest(asset.source, this.sourcePath);
    return file instanceof TFile ? this.app.vault.getResourcePath(file) : "";
  }

  private async exportCards(): Promise<void> {
    if (!this.exportButton) return;
    this.exportButton.disabled = true;
    this.exportButton.setText("导出中...");

    try {
      const folder = await this.ensureExportFolder();
      for (let index = 0; index < this.cardElements.length; index += 1) {
        const dataUrl = await toPng(this.cardElements[index], {
          backgroundColor: "#f6f2e9",
          cacheBust: true,
          pixelRatio: 2,
          width: 600,
          height: 750
        });
        const path = normalizePath(`${folder}/card-${String(index + 1).padStart(2, "0")}.png`);
        await this.app.vault.adapter.writeBinary(path, dataUrlToArrayBuffer(dataUrl));
      }
      new Notice(`已导出 ${this.cardElements.length} 张图片到 ${folder}`, 10000);
    } catch (error) {
      new Notice(`图片卡片导出失败：${error instanceof Error ? error.message : String(error)}`, 10000);
    } finally {
      this.exportButton.disabled = false;
      this.exportButton.setText("导出全部 PNG");
    }
  }

  private async ensureExportFolder(): Promise<string> {
    const parent = this.sourcePath.split("/").slice(0, -1).join("/");
    const folder = normalizePath(`${parent ? `${parent}/` : ""}publish-studio/${safeName(this.fileName)}`);
    const parts = folder.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!await this.app.vault.adapter.exists(current)) await this.app.vault.createFolder(current);
    }
    return folder;
  }
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "untitled";
}

