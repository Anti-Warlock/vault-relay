import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("Companion never targets a platform final-publish control", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  const popup = readFileSync(path.resolve("chrome-extension/popup.js"), "utf8");

  assert.doesNotMatch(content, /tweetButton|publishButton|submitButton|button\[type=["']submit|发布按钮|立即发布/);
  assert.doesNotMatch(popup, /tweetButton|publishButton|submitButton|button\[type=["']submit|立即发布/);
  assert.ok((content.match(/\.click\(\)/g) ?? []).length <= 6);
  assert.match(content, /添加封面\|上传封面\|选择封面/);
  assert.match(content, /normalize\("文章"\)/);
});

test("Companion requests only the customer-facing permissions it currently uses", () => {
  const manifest = JSON.parse(readFileSync(path.resolve("chrome-extension/manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["clipboardWrite", "storage", "unlimitedStorage"]);
  assert.ok(!manifest.permissions.includes("clipboardRead"));
  assert.ok(!manifest.permissions.includes("tabs"));
});

test("Obsidian keeps one-click Push primary and copy fallbacks collapsed", () => {
  const modal = readFileSync(path.resolve("src/publication-modal.ts"), "utf8");
  assert.match(modal, /复制文本/);
  assert.match(modal, /复制富文本/);
  assert.match(modal, /备用复制/);
  assert.match(modal, /推送/);
  assert.match(modal, /推送到已启用平台/);
  assert.match(modal, /启用/);
  assert.match(modal, /即将支持/);
  assert.match(modal, /pushEnabledPlatforms/);
});

test("Obsidian persists enabled platform switches and exposes a direct batch Push command", () => {
  const main = readFileSync(path.resolve("src/main.ts"), "utf8");
  const modal = readFileSync(path.resolve("src/publication-modal.ts"), "utf8");
  assert.match(main, /enabledPlatforms/);
  assert.match(main, /push-enabled-platform-drafts/);
  assert.match(main, /一键 Push 已启用平台/);
  assert.match(main, /saveData\(this\.vaultRelaySettings\)/);
  assert.match(main, /pushEnabledPlatforms\(\)/);
  assert.match(main, /platform\.availability !== "coming-soon"/);
  assert.match(modal, /sort\(\(left, right\) => batchPushPriority\(left\) - batchPushPriority\(right\)\)/);
  assert.match(modal, /return platform === "zhihu" \? 1 : 0/);
});

test("customer-facing surfaces expose WeChat as an available platform with first-image cover automation", () => {
  const publication = readFileSync(path.resolve("src/publication.ts"), "utf8");
  const modal = readFileSync(path.resolve("src/publication-modal.ts"), "utf8");
  const popup = readFileSync(path.resolve("chrome-extension/popup.html"), "utf8");
  assert.match(publication, /name: "微信公众号".*availability: "available"/);
  assert.match(publication, /使用正文首图作为封面/);
  assert.match(popup, /Creator Pro/);
  assert.doesNotMatch(popup, /任务记录|诊断工具/);
  assert.doesNotMatch(modal, /Beta|待验证|真实账号/);
  assert.doesNotMatch(popup, /Beta|待验证|真实账号|调试/);
});

test("quota exhaustion leads to a manual-contact upgrade flow without embedded payment processing", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  const popup = readFileSync(path.resolve("chrome-extension/popup.js"), "utf8");
  const html = readFileSync(path.resolve("chrome-extension/popup.html"), "utf8");
  const config = readFileSync(path.resolve("chrome-extension/commercial-config.js"), "utf8");
  assert.match(content, /VaultRelay Companion/);
  assert.match(html, /购买 Creator Pro/);
  assert.match(html, /复制购买信息/);
  assert.match(html, /id="device-id"/);
  assert.match(html, /客服微信/);
  assert.match(html, /Creator Pro/);
  assert.match(html, /id="license-code"/);
  assert.doesNotMatch(html, /任务记录|诊断工具/);
  assert.match(html, /payment-qr-box/);
  assert.match(popup, /getOrCreateOrderId/);
  assert.match(popup, /VaultRelayLicense\.getDeviceId/);
  assert.match(popup, /copyContactTemplate/);
  assert.match(popup, /chrome\.runtime\.getURL\(commercial\.paymentQrImagePath\)/);
  assert.match(config, /annualPriceCny: 129/);
  assert.match(config, /monthlyPriceCny: 12/);
  assert.match(config, /customerServiceWechat/);
  assert.match(config, /paymentQrImagePath: ""/);
  assert.doesNotMatch(popup, /爱发电|afdian|微信支付|支付宝|payment API/i);
});

test("Companion handles extension reload context invalidation without an unhandled bootstrap rejection", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  const popup = readFileSync(path.resolve("chrome-extension/popup.js"), "utf8");
  assert.match(content, /bootstrap\(\)\.catch\(handleDetachedExtensionContext\)/);
  assert.match(content, /extension context invalidated/);
  assert.match(content, /if \(isDetachedExtensionContext\(error\)\) return/);
  assert.match(content, /fillPendingTask\(\)\.catch\(handleDetachedExtensionContext\)/);
  assert.match(content, /pageObserver\?\.disconnect\(\)/);
  assert.match(popup, /restore\(\)\.catch\(handlePopupError\)/);
  assert.match(popup, /safeListener/);
});

test("X Article creation uses a page-session bridge without debugger access or final publish", () => {
  const manifest = JSON.parse(readFileSync(path.resolve("chrome-extension/manifest.json"), "utf8"));
  const background = readFileSync(path.resolve("chrome-extension/background.js"), "utf8");
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  const mainWorld = readFileSync(path.resolve("chrome-extension/x-article-main.js"), "utf8");

  assert.ok(!manifest.permissions.includes("debugger"));
  assert.doesNotMatch(background, /chrome\.debugger|Input\.insertText/);
  assert.match(content, /fillXArticle/);
  assert.match(content, /__vault_relay_x_article_create_request__/);
  assert.match(mainWorld, /ArticleEntityDraftCreate/);
  assert.match(mainWorld, /upload\.x\.com\/i\/media\/upload\.json/);
  assert.match(mainWorld, /content_state/);
  assert.doesNotMatch(mainWorld, /tweetButton|publishButton|submitButton|立即发布/);
  assert.doesNotMatch(background, /tweetButton|publishButton|submitButton|立即发布/);
});

test("Companion discards an incompatible legacy X Thread task before claiming a new Article task", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /isCompatiblePendingTask/);
  assert.match(content, /discardIncompatibleTask/);
  assert.match(content, /task\.content\?\.mode === "x-article"/);
  assert.match(content, /removePendingPlatformTask/);
});

test("Companion isolates simultaneous batch Push tasks by platform", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  const popup = readFileSync(path.resolve("chrome-extension/popup.js"), "utf8");
  assert.match(content, /pendingPlatformTaskKey/);
  assert.match(content, /`pendingPlatformFill:\$\{platform\}`/);
  assert.match(content, /setPendingPlatformTask/);
  assert.match(content, /removePendingPlatformTask\(pendingPlatformFill\.platform, pendingPlatformFill\.id\)/);
  assert.match(popup, /`pendingPlatformFill:\$\{state\.task\.platform\}`/);
});

test("an explicit relay claim can replace a stale pending task for the same platform", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  const claimBody = content.slice(content.indexOf("async function claimRelayTask"), content.indexOf("function isCompatiblePendingTask"));
  assert.doesNotMatch(claimBody, /else\s*\{\s*return;\s*\}/);
  assert.match(claimBody, /CLAIM_RELAY_TASK/);
  assert.match(claimBody, /setPendingPlatformTask\(response\.task\)/);
});

test("WeChat marker image paste preserves the selection and validates body edges", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /const uploadedBody = platform === "wechat" \|\| platform === "zhihu" \|\| platform === "xiaohongshu"/);
  assert.match(content, /verifyMutationIntegrity\(task, editor\)/);
  assert.match(content, /if \(!selection\?\.anchorNode \|\| !element\.contains\(selection\.anchorNode\)\) element\.focus\(\)/);
});

test("rich article adapters update editor application state through a paste event", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /dispatchRichPaste/);
  assert.match(content, /new OwnerClipboardEvent\("paste"/);
  assert.match(content, /clipboardData: transfer/);
  assert.match(content, /insertFromPaste/);
});

test("Zhihu and Xiaohongshu use one stable body paste and replace image markers in source order", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /const uploadedBody = platform === "wechat" \|\| platform === "zhihu" \|\| platform === "xiaohongshu"/);
  assert.match(content, /prepareUploadedBody/);
  assert.match(content, /insertUploadedBodyImages/);
  assert.match(content, /collapseSelectionToEnd/);
  assert.match(content, /dispatchImagePaste\(editor, file, platform !== "xiaohongshu"\)/);
  assert.doesNotMatch(content, /restoreCleanRichBody/);
  assert.match(content, /verifyBodyIntegrity/);
  assert.match(content, /firstCount === 1 && lastCount === 1/);
  assert.match(content, /platform === "zhihu" \|\| platform === "xiaohongshu"/);
  const fillHtml = content.slice(content.indexOf("async function fillHtml"), content.indexOf("function dispatchRichPaste"));
  assert.match(fillHtml, /platform === "zhihu" \|\| platform === "xiaohongshu"/);
  assert.ok(fillHtml.indexOf('platform === "zhihu"') < fillHtml.indexOf('execCommand("insertHTML"'));
});

test("WeChat uses hosted body-image uploads and a separately verified cover upload", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /const uploadedBody = platform === "wechat" \|\| platform === "zhihu" \|\| platform === "xiaohongshu"/);
  assert.match(content, /setWechatCover/);
  assert.match(content, /findWechatCoverInput/);
  assert.match(content, /waitForWechatCoverPreview/);
  assert.match(content, /hasWechatCoverPreview/);
  assert.match(content, /isElementNode/);
  assert.match(content, /findTitleField/);
  assert.match(content, /titleFieldScore/);
  assert.match(content, /insertWechatImageFallback/);
  assert.match(content, /removeImageMarkers/);
  assert.match(content, /removeAllVaultRelayMarkers/);
  assert.match(content, /imageOptional = platform === "wechat"/);
  assert.match(content, /fillTitleField/);
  assert.match(content, /拖拽或选择封面/);
  assert.match(content, /请在这里输入标题/);
  assert.match(content, /\[contenteditable\]/);
  assert.match(content, /wechatCoverInputScore/);
  assert.match(content, /setWechatCoverFromBody/);
  assert.match(content, /从正文选择/);
  assert.match(content, /dispatchBeforeInput/);
  assert.match(content, /\.rich_media_content \.ProseMirror/);
  assert.match(content, /controlDiagnostic/);
  assert.match(content, /hasVisibleEmptyWechatCoverPlaceholder/);
  assert.match(content, /findWechatVisibleTitleField/);
  assert.match(content, /fillWechatTitle/);
  assert.match(content, /#js_cover_area/);
});

test("Xiaohongshu long-form requires its inline images to be accepted", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /dispatchImagePaste\(editor, file, platform !== "xiaohongshu"\)/);
  assert.match(content, /imageOptional = platform === "wechat"/);
});

test("Zhihu and Xiaohongshu never re-paste the body during image upload", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  const imageFlow = content.slice(
    content.indexOf("async function insertUploadedBodyImages"),
    content.indexOf("function findNewUploadedImage")
  );
  assert.doesNotMatch(imageFlow, /fillHtml\(/);
  assert.doesNotMatch(imageFlow, /dispatchEditorInput/);
  assert.match(imageFlow, /if \(platform === "wechat"\) removeImageMarkers/);
  assert.match(content, /if \(platform === "wechat"\) removeAllVaultRelayMarkers/);
  assert.match(content, /await waitForEditorQuiet\(editor, 600, 4000\)/);
  assert.match(imageFlow, /await synchronizeEditorSelection\(editor, textNode, placement\.marker, platform\)/);
  assert.match(imageFlow, /keepSingleUploadedImage\(editor, beforeImages, uploadedImage\)/);
  assert.match(imageFlow, /settleXiaohongshuImages\(editor, placements\.length\)/);
  assert.doesNotMatch(imageFlow, /removePlacementMarker\(editor, placement\.marker\)/);
  assert.match(content, /const markerRemoved = !findTextNode\(editor, marker\)/);
  assert.match(content, /platform !== "zhihu" && platform !== "xiaohongshu"/);
  assert.match(content, /function emptyBlocksAfter/);
  assert.match(content, /removeXiaohongshuSurplusImages/);
  assert.match(content, /async function settleXiaohongshuImages[\s\S]*removeXiaohongshuImageSpacing\(editor\)/);
  assert.match(content, /imageCountExact/);
  assert.ok(imageFlow.lastIndexOf("verifyMutationIntegrity") > imageFlow.lastIndexOf("for (const placement"));
});

test("Xiaohongshu article entry is guarded against repeated clicks", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /let xiaohongshuEditorOpeningUntil = 0/);
  assert.match(content, /Date\.now\(\) < xiaohongshuEditorOpeningUntil/);
  assert.match(content, /xiaohongshuEditorOpeningUntil = Date\.now\(\) \+ 8000/);
});

test("rich editors never refill the same task twice and only WeChat dispatches marker cleanup", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /const attemptedPageTasks = new Set\(\)/);
  assert.match(content, /attemptedPageTasks\.has\(pageTaskKey\)/);
  assert.match(content, /attemptedPageTasks\.add\(/);
  const fillPendingTask = content.slice(
    content.indexOf("async function fillPendingTask"),
    content.indexOf("function isQuotaExhaustedError")
  );
  assert.ok(
    fillPendingTask.indexOf("fillInProgress = true") < fillPendingTask.indexOf("await getPendingPlatformTask"),
    "fillPendingTask must acquire its lock before the first asynchronous task read"
  );
  assert.doesNotMatch(content, /PAGE_TASK_LEASE_ATTRIBUTE|claimPageTaskLease/);
  assert.match(content, /finally \{\s+if \(platform === "wechat"\) removeAllVaultRelayMarkers\(editor\)/);
  assert.doesNotMatch(content, /finally \{\s+removeAllVaultRelayMarkers\(editor\)/);
});

test("WeChat home page opens the article editor before attempting to fill", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /hasWechatArticleEditor/);
  assert.match(content, /openWechatArticleEditor/);
  assert.match(content, /findWechatArticleEntry/);
  assert.match(content, /正在进入公众号文章编辑器/);
});

test("Zhihu cover upload uses the explicit cover entry or its newly-created input and verifies its preview", () => {
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(content, /findZhihuCoverTrigger/);
  assert.match(content, /findZhihuCoverInput\(inputsBefore\)/);
  assert.match(content, /waitForZhihuCoverPreview/);
  assert.match(content, /hasZhihuCoverPreview/);
});

test("Companion keeps queue history compact and opens Xiaohongshu long-form creation", () => {
  const queue = readFileSync(path.resolve("chrome-extension/queue.js"), "utf8");
  const content = readFileSync(path.resolve("chrome-extension/content.js"), "utf8");
  assert.match(queue, /compactQueueTask/);
  assert.match(queue, /imageCount/);
  assert.match(content, /findXiaohongshuArticleEntry/);
  assert.match(content, /新建长文合集/);
  assert.match(content, /XIAOHONGSHU_ARTICLE_URL/);
  assert.match(content, /正在进入小红书长文编辑器/);
  assert.match(content, /isStorageQuotaError/);
  assert.match(content, /chrome\.storage\.local\.remove\(\["publicationQueue", "publishTask"\]\)/);
});
