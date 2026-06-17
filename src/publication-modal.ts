import { App, Modal, Notice, requestUrl, TFile } from "obsidian";
import { arrayBufferToBase64, mimeTypeFromName, resolvedRemoteImage } from "./publication-assets";
import {
  createPublicationTask,
  omitUnavailableImage,
  PLATFORM_DEFINITIONS,
  serializePublicationTask,
  type PublicationImage,
  type PublicationPlatform,
  type PublicationTask
} from "./publication";

export class PublicationModal extends Modal {
  constructor(
    app: App,
    private readonly fileName: string,
    private readonly sourcePath: string,
    private readonly markdown: string,
    private readonly generatorVersion: string,
    private readonly sendToCompanion: (task: PublicationTask) => Promise<void>,
    private readonly enabledPlatforms: Record<PublicationPlatform, boolean>,
    private readonly saveEnabledPlatforms: (enabled: Record<PublicationPlatform, boolean>) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("vault-relay-publication-modal");
    this.modalEl.addEventListener("click", this.closeFallbackMenusOnOutsideClick);
    this.setTitle("VaultRelay 发布工作室");
    const hero = this.contentEl.createDiv("vault-relay-publication-hero");
    const heroCopy = hero.createDiv("vault-relay-publication-hero-copy");
    heroCopy.createEl("span", { cls: "vault-relay-publication-kicker", text: "PUBLISH EVERYWHERE" });
    heroCopy.createEl("h2", { text: "一次编辑，多处发布" });
    heroCopy.createEl("p", {
      cls: "vault-relay-publication-intro",
      text: "选择目标平台，VaultRelay 会整理格式、图片和草稿。你只需在浏览器完成最后确认。"
    });
    const toolbar = hero.createDiv("vault-relay-publication-toolbar");
    const toolbarCopy = toolbar.createDiv("vault-relay-publication-toolbar-copy");
    toolbarCopy.createEl("strong", { text: "本次发布" });
    const summary = toolbarCopy.createEl("span");
    const batch = toolbar.createEl("button", { cls: "mod-cta vault-relay-batch-button", text: "推送到已启用平台" });
    const updateSummary = () => {
      const enabled = PLATFORM_DEFINITIONS.filter((platform) =>
        platform.availability !== "coming-soon" && this.enabledPlatforms[platform.id]
      );
      summary.setText(enabled.length
        ? `${enabled.length} 个平台 · ${enabled.map((platform) => platform.name).join(" · ")}`
        : "尚未选择平台");
      batch.disabled = enabled.length === 0;
    };
    batch.addEventListener("click", () => void this.pushEnabledPlatforms(batch));
    updateSummary();

    const platformSection = this.contentEl.createDiv("vault-relay-platform-section");
    const sectionHeading = platformSection.createDiv("vault-relay-platform-section-heading");
    sectionHeading.createEl("strong", { text: "发布渠道" });
    sectionHeading.createEl("span", { text: "关闭暂时不需要的平台" });
    const grid = platformSection.createDiv("vault-relay-platform-grid");
    PLATFORM_DEFINITIONS.forEach((platform) => {
      const card = grid.createDiv("vault-relay-platform-card vault-relay-platform-card-compact");
      card.addClass(`is-platform-${platform.id}`);
      if (platform.availability === "coming-soon") card.addClass("is-coming-soon");
      const identity = card.createDiv("vault-relay-platform-identity");
      identity.createEl("span", { cls: "vault-relay-platform-mark", text: platformMark(platform.id) });
      const identityCopy = identity.createDiv();
      const titleRow = identityCopy.createDiv("vault-relay-platform-title-row");
      titleRow.createEl("h3", { text: platform.name });
      identityCopy.createEl("span", { cls: "vault-relay-platform-output", text: platform.output });
      const actions = card.createDiv("vault-relay-platform-actions");
      const toggleLabel = actions.createEl("label", { cls: "vault-relay-platform-toggle" });
      const toggle = toggleLabel.createEl("input", { type: "checkbox" });
      toggle.checked = this.enabledPlatforms[platform.id];
      toggle.disabled = platform.availability === "coming-soon";
      toggleLabel.createEl("span", { cls: "vault-relay-platform-toggle-track" });
      toggle.addEventListener("change", () => {
        this.enabledPlatforms[platform.id] = toggle.checked;
        void this.saveEnabledPlatforms({ ...this.enabledPlatforms });
        updateSummary();
      });
      if (platform.availability === "coming-soon") {
        titleRow.createEl("span", { cls: "vault-relay-platform-tip", text: "开发中" });
        const button = actions.createEl("button", { text: "即将支持" });
        button.disabled = true;
        return;
      }

      const companionLabel = "推送";
      const companion = actions.createEl("button", { cls: "vault-relay-primary-action", text: companionLabel });
      companion.addEventListener("click", () => void this.sendCompanionTask(platform.id, companion));
      const fallbackDetails = actions.createEl("details", { cls: "vault-relay-fallback-details" });
      if (platform.id === "xiaohongshu") fallbackDetails.addClass("opens-upward");
      fallbackDetails.addEventListener("toggle", () => {
        card.toggleClass("has-open-menu", fallbackDetails.open);
        if (!fallbackDetails.open) return;
        this.contentEl.querySelectorAll<HTMLDetailsElement>(".vault-relay-fallback-details[open]").forEach((details) => {
          if (details !== fallbackDetails) details.open = false;
        });
      });
      fallbackDetails.createEl("summary", { text: "备用复制" });
      const fallback = fallbackDetails.createDiv("vault-relay-fallback-actions");
      const copyText = fallback.createEl("button", { text: "复制文本" });
      copyText.addEventListener("click", () => void this.copyPlainText(platform.id));
      if (platform.id === "zhihu" || platform.id === "wechat") {
        const copyRich = fallback.createEl("button", { text: "复制富文本" });
        copyRich.addEventListener("click", () => void this.copyRichText(platform.id));
      }
    });
  }

  onClose(): void {
    this.modalEl.removeEventListener("click", this.closeFallbackMenusOnOutsideClick);
    this.contentEl.empty();
  }

  private readonly closeFallbackMenusOnOutsideClick = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest(".vault-relay-fallback-details")) return;
    this.contentEl.querySelectorAll<HTMLDetailsElement>(".vault-relay-fallback-details[open]")
      .forEach((details) => { details.open = false; });
  };

  private createTask(platform: PublicationPlatform): PublicationTask {
    return createPublicationTask(platform, this.markdown, this.fileName, this.sourcePath, this.generatorVersion);
  }

  async pushEnabledPlatforms(button?: HTMLButtonElement): Promise<void> {
    const platforms = PLATFORM_DEFINITIONS
      .filter((platform) => platform.availability !== "coming-soon")
      .map((platform) => platform.id)
      .filter((platform) => this.enabledPlatforms[platform])
      .sort((left, right) => batchPushPriority(left) - batchPushPriority(right));
    if (!platforms.length) {
      new Notice("请至少启用一个平台。");
      return;
    }
    if (button) {
      button.disabled = true;
      button.setText(`正在 Push 0/${platforms.length}`);
    }
    const succeeded: PublicationPlatform[] = [];
    const failed: Array<{ platform: PublicationPlatform; reason: string }> = [];
    for (let index = 0; index < platforms.length; index += 1) {
      const platform = platforms[index];
      if (button) button.setText(`正在 Push ${index + 1}/${platforms.length} · ${platformName(platform)}`);
      const task = this.createTask(platform);
      const blockingIssues = task.issues.filter((issue) => issue.severity === "error");
      if (blockingIssues.length) {
        failed.push({ platform, reason: blockingIssues.map((issue) => issue.message).join("；") });
        continue;
      }
      try {
        await this.resolveTaskImages(task);
        await this.sendToCompanion(task);
        succeeded.push(platform);
      } catch (error) {
        failed.push({ platform, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    if (button) {
      button.disabled = false;
      button.setText("推送到已启用平台");
    }
    const successText = succeeded.length ? `已打开 ${succeeded.map(platformName).join("、")}` : "没有平台成功打开";
    const failureText = failed.length
      ? `；${failed.map((item) => `${platformName(item.platform)}：${item.reason}`).join("；")}`
      : "";
    new Notice(`${successText}${failureText}。请在浏览器逐个平台检查并手动发布。`, failed.length ? 15000 : 10000);
  }

  private async copyPlainText(platform: PublicationPlatform): Promise<void> {
    const task = this.createTask(platform);
    const text = task.content.items?.map((item) => item.text).join("\n\n---\n\n") ?? task.content.plainText;
    const output = text.trimStart().startsWith(task.title) ? text : `${task.title}\n\n${text}`;
    await navigator.clipboard.writeText(output.trim());
    new Notice(`${task.title} 的 ${platform} 文本草稿已复制。`, 7000);
  }

  private async copyRichText(platform: PublicationPlatform): Promise<void> {
    const task = this.createTask(platform);
    await this.resolveLocalImages(task);
    const html = task.content.richHtml ?? "";
    if (!html) {
      new Notice("当前平台没有可复制的富文本草稿。");
      return;
    }
    if (typeof ClipboardItem === "undefined") {
      await navigator.clipboard.writeText(task.content.plainText);
      new Notice("当前环境不支持直接复制富文本，已复制纯文本。");
      return;
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([task.content.plainText], { type: "text/plain" })
      })
    ]);
    new Notice(`${task.title} 的富文本草稿已复制。`, 7000);
  }

  private async sendCompanionTask(platform: PublicationPlatform, button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    button.setText("正在准备图片...");
    const task = this.createTask(platform);
    const blockingIssues = task.issues.filter((issue) => issue.severity === "error");
    if (blockingIssues.length) {
      new Notice(`请先处理阻塞问题：${blockingIssues.map((issue) => issue.message).join("；")}`, 10000);
      button.disabled = false;
      button.setText("推送");
      return;
    }
    try {
      await this.resolveTaskImages(task);
      const unavailableImages = task.issues.filter((issue) => issue.code === "image-unavailable").length;
      await this.sendToCompanion(task);
      new Notice(
        unavailableImages
          ? `${platform} 草稿已交给 Companion Pro；${unavailableImages} 张无法读取的图片已跳过，请在发布前检查。`
          : `${platform} 草稿已交给 Companion Pro，正在打开平台编辑器。`,
        10000
      );
      button.setText("已发送");
    } catch (error) {
      await navigator.clipboard.writeText(serializePublicationTask(task));
      new Notice(`一键通道失败，已复制回退任务：${error instanceof Error ? error.message : String(error)}`, 10000);
      button.setText("已复制回退任务");
    } finally {
      button.disabled = false;
    }
  }

  private async resolveLocalImages(task: PublicationTask): Promise<void> {
    const images = uniqueImages([
      ...task.content.images,
      ...(task.content.coverImage ? [task.content.coverImage] : []),
      ...(task.content.items?.flatMap((item) => item.images) ?? [])
    ]);
    for (const image of images.filter((item) => item.kind === "local")) await this.resolveLocalImage(image, task);
  }

  private async resolveTaskImages(task: PublicationTask): Promise<void> {
    const images = uniqueImages([
      ...task.content.images,
      ...(task.content.coverImage ? [task.content.coverImage] : []),
      ...(task.content.items?.flatMap((item) => item.images) ?? [])
    ]);
    for (const image of images) {
      try {
        if (image.kind === "local") await this.resolveLocalImage(image, task);
        else await this.resolveRemoteImage(image, task);
      } catch (error) {
        omitUnavailableImage(task, image.source, error instanceof Error ? error.message : String(error));
      }
    }
  }

  private async resolveLocalImage(image: PublicationImage, task: PublicationTask): Promise<void> {
    const file = this.app.metadataCache.getFirstLinkpathDest(image.source, this.sourcePath);
    if (!(file instanceof TFile)) throw new Error(`找不到本地图片：${image.source}`);
    const bytes = new Uint8Array(await this.app.vault.readBinary(file));
    image.fileName = file.name;
    image.mimeType = mimeTypeFromName(file.name);
    image.dataUrl = `data:${image.mimeType};base64,${arrayBufferToBase64(bytes.buffer)}`;
    applyResolvedImage(task, image);
  }

  private async resolveRemoteImage(image: PublicationImage, task: PublicationTask): Promise<void> {
    const response = await requestUrl({ url: image.source, method: "GET" });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`远程图片下载失败：HTTP ${response.status} · ${image.source}`);
    }
    applyResolvedImage(task, resolvedRemoteImage(image, response.arrayBuffer, response.headers));
  }
}

function uniqueImages(images: PublicationImage[]): PublicationImage[] {
  return Array.from(new Map(images.map((image) => [image.source, image])).values());
}

function applyResolvedImage(task: PublicationTask, resolved: PublicationImage): void {
  const update = (image: PublicationImage) => {
    if (image.source === resolved.source) Object.assign(image, resolved);
  };
  task.content.images.forEach(update);
  if (task.content.coverImage) update(task.content.coverImage);
  task.content.items?.flatMap((item) => item.images).forEach(update);
  if (task.content.richHtml && resolved.dataUrl) {
    task.content.richHtml = task.content.richHtml
      .split(`src="${resolved.source}"`).join(`src="${resolved.dataUrl}"`)
      .split(`src="${escapeHtmlAttribute(resolved.source)}"`).join(`src="${resolved.dataUrl}"`);
  }
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function platformName(platform: PublicationPlatform): string {
  return PLATFORM_DEFINITIONS.find((item) => item.id === platform)?.name ?? platform;
}

function batchPushPriority(platform: PublicationPlatform): number {
  // Zhihu must retain page focus while its ProseMirror editor accepts inline image paste events.
  return platform === "zhihu" ? 1 : 0;
}

function platformMark(platform: PublicationPlatform): string {
  return ({
    x: "X",
    zhihu: "知",
    wechat: "微",
    xiaohongshu: "RED"
  } satisfies Record<PublicationPlatform, string>)[platform];
}
