import { Notice, Plugin } from "obsidian";
import { ArticleInspectorModal } from "./article-inspector-modal";
import { ArticlePreviewModal } from "./article-preview-modal";
import { ThreadCardsModal } from "./thread-cards-modal";

export default class ObsidianToXPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addRibbonIcon("layout-template", "预览当前文章成品", () => {
      void this.openArticlePreview();
    });

    this.addCommand({
      id: "inspect-current-article-structure",
      name: "检查当前文章结构",
      callback: () => {
        void this.openArticleInspector();
      }
    });

    this.addCommand({
      id: "preview-current-article",
      name: "预览当前文章成品",
      callback: () => {
        void this.openArticlePreview();
      }
    });

    this.addCommand({
      id: "generate-thread-cards",
      name: "生成长文图片卡片",
      callback: () => {
        void this.openThreadCards();
      }
    });
  }

  private async openArticleInspector(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("请先打开一篇 Markdown 笔记。");
      return;
    }
    const markdown = await this.app.vault.read(file);
    new ArticleInspectorModal(this.app, file.basename, markdown).open();
  }

  private async openArticlePreview(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("请先打开一篇 Markdown 笔记。");
      return;
    }
    const markdown = await this.app.vault.read(file);
    new ArticlePreviewModal(this.app, file.basename, file.path, markdown).open();
  }

  private async openThreadCards(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("请先打开一篇 Markdown 笔记。");
      return;
    }
    const markdown = await this.app.vault.read(file);
    new ThreadCardsModal(this.app, file.basename, file.path, markdown).open();
  }
}
