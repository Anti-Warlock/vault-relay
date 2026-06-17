import { Notice, Plugin } from "obsidian";
import { ArticleInspectorModal } from "./article-inspector-modal";
import { ArticlePreviewModal } from "./article-preview-modal";
import { ThreadCardsModal } from "./thread-cards-modal";
import { PublicationModal } from "./publication-modal";
import { editorUrlWithRelayClaim, LocalRelay } from "./local-relay";
import { PLATFORM_DEFINITIONS, type PublicationPlatform, type PublicationTask } from "./publication";

interface VaultRelaySettings {
  enabledPlatforms: Record<PublicationPlatform, boolean>;
}

const DEFAULT_SETTINGS: VaultRelaySettings = {
  enabledPlatforms: {
    x: true,
    zhihu: true,
    wechat: false,
    xiaohongshu: true
  }
};

export default class VaultRelayPlugin extends Plugin {
  private readonly relay = new LocalRelay();
  private vaultRelaySettings: VaultRelaySettings = structuredClone(DEFAULT_SETTINGS);

  async onload(): Promise<void> {
    this.vaultRelaySettings = mergeSettings(await this.loadData());
    try {
      await this.relay.start();
    } catch (error) {
      new Notice(`VaultRelay 本地 Relay 启动失败，将使用剪贴板回退：${error instanceof Error ? error.message : String(error)}`, 10000);
    }
    this.addRibbonIcon("layout-template", "预览当前文章成品", () => {
      void this.openArticlePreview();
    });

    this.addRibbonIcon("send", "一键 Push 已启用平台", () => {
      void this.pushEnabledPlatforms();
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

    this.addCommand({
      id: "prepare-x-thread-draft",
      name: "生成 X Article 草稿",
      callback: () => {
        void this.openPublicationStudio();
      }
    });

    this.addCommand({
      id: "prepare-platform-drafts",
      name: "打开平台发布工作室",
      callback: () => {
        void this.openPublicationStudio();
      }
    });

    this.addCommand({
      id: "push-enabled-platform-drafts",
      name: "一键 Push 已启用平台",
      callback: () => {
        void this.pushEnabledPlatforms();
      }
    });
  }

  async onunload(): Promise<void> {
    await this.relay.stop();
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

  private async openPublicationStudio(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("请先打开一篇 Markdown 笔记。");
      return;
    }
    const markdown = await this.app.vault.read(file);
    this.createPublicationModal(file.basename, file.path, markdown).open();
  }

  private async pushEnabledPlatforms(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("请先打开一篇 Markdown 笔记。");
      return;
    }
    const enabled = PLATFORM_DEFINITIONS.filter((platform) =>
      platform.availability !== "coming-soon" && this.vaultRelaySettings.enabledPlatforms[platform.id]
    );
    if (!enabled.length) {
      new Notice("尚未启用发布平台，请先运行“打开平台发布工作室”配置平台开关。");
      return;
    }
    const markdown = await this.app.vault.read(file);
    await this.createPublicationModal(file.basename, file.path, markdown).pushEnabledPlatforms();
  }

  private createPublicationModal(fileName: string, sourcePath: string, markdown: string): PublicationModal {
    return new PublicationModal(
      this.app,
      fileName,
      sourcePath,
      markdown,
      this.manifest.version,
      (task) => this.sendToCompanion(task),
      { ...this.vaultRelaySettings.enabledPlatforms },
      async (enabledPlatforms) => {
        this.vaultRelaySettings.enabledPlatforms = enabledPlatforms;
        await this.saveData(this.vaultRelaySettings);
      }
    );
  }

  private async sendToCompanion(task: PublicationTask): Promise<void> {
    const claimCode = this.relay.enqueue(task);
    const { shell } = require("electron") as { shell: { openExternal(url: string): Promise<void> } };
    await shell.openExternal(editorUrlWithRelayClaim(task.editorUrl, claimCode));
    if (!await this.relay.waitForClaim(claimCode)) {
      throw new Error("Companion 未在 15 秒内领取任务，请确认扩展已安装并启用");
    }
  }
}

function mergeSettings(saved: Partial<VaultRelaySettings> | null | undefined): VaultRelaySettings {
  const merged = {
    enabledPlatforms: {
      ...DEFAULT_SETTINGS.enabledPlatforms,
      ...(saved?.enabledPlatforms ?? {})
    }
  };
  for (const platform of PLATFORM_DEFINITIONS) {
    if (platform.availability === "coming-soon") merged.enabledPlatforms[platform.id] = false;
  }
  return merged;
}
