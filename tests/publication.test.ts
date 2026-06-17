import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicationTask,
  omitUnavailableImage,
  PUBLICATION_TASK_PREFIX,
  serializePublicationTask
} from "../src/publication";

const markdown = `# 测试文章

这是 **重点内容**。

![远程图](https://oss.example/image.png)

## 第二部分

- 第一项
- 第二项`;

test("creates X Article tasks using the shared publication protocol", () => {
  const task = createPublicationTask("x", markdown, "fallback", "note.md", "0.9.0");
  assert.equal(task.version, 2);
  assert.equal(task.platform, "x");
  assert.equal(task.content.mode, "x-article");
  assert.ok(task.content.xArticle?.blocks.length);
  assert.ok(task.content.xArticle?.blocks.some((block) => block.type === "header-one"));
  assert.ok(task.content.xArticle?.blocks.some((block) => block.type === "atomic"));
  assert.ok(task.content.xArticle?.blocks.some((block) =>
    block.inline_style_ranges.some((range) => range.style === "Bold")
  ));
  assert.ok(task.content.xArticle?.entity_map.some((entity) => entity.value.type === "MEDIA"));
  assert.equal(task.content.images[0].source, "https://oss.example/image.png");
});

test("marks X Articles as requiring an eligible X membership", () => {
  const task = createPublicationTask("x", markdown, "fallback", "note.md", "0.9.0");
  assert.ok(task.issues.some((issue) => issue.code === "x-premium-required"));
});

test("creates rich article drafts for Zhihu and WeChat", () => {
  for (const platform of ["zhihu", "wechat"] as const) {
    const task = createPublicationTask(platform, markdown, "fallback", "note.md", "0.9.0");
    assert.equal(task.title, "测试文章");
    assert.doesNotMatch(task.content.richHtml ?? "", /<h1>测试文章<\/h1>/);
    assert.match(task.content.richHtml ?? "", /<strong>重点内容<\/strong>/);
    assert.match(task.content.richHtml ?? "", /<img src="https:\/\/oss\.example\/image\.png"/);
  }
});

test("opens WeChat as an available rich article target", () => {
  const x = createPublicationTask("x", markdown, "fallback", "note.md", "0.9.7");
  const zhihu = createPublicationTask("zhihu", markdown, "fallback", "note.md", "0.9.7");
  const wechat = createPublicationTask("wechat", markdown, "fallback", "note.md", "0.9.7");
  assert.ok(!x.issues.some((issue) => issue.code.startsWith("platform-")));
  assert.ok(!zhihu.issues.some((issue) => issue.code.startsWith("platform-")));
  assert.ok(!wechat.issues.some((issue) => issue.code.startsWith("platform-")));
});

test("adds inline publishing styles to WeChat drafts", () => {
  const task = createPublicationTask("wechat", markdown, "fallback", "note.md", "0.9.0");
  assert.match(task.content.richHtml ?? "", /<section style=/);
  assert.match(task.content.richHtml ?? "", /border-left:4px|font-size:16px/);
});

test("creates a Xiaohongshu draft with title and ordered images", () => {
  const task = createPublicationTask("xiaohongshu", markdown, "fallback", "note.md", "0.9.0");
  assert.equal(task.title, "测试文章");
  assert.equal(task.content.images.length, 1);
  assert.equal(task.content.mode, "image-note");
  assert.ok(Array.from(task.content.plainText).length <= 1000);
});

test("omits internal image markers and image labels from platform body text", () => {
  const task = createPublicationTask(
    "xiaohongshu",
    "# 标题\n\n正文一\n\n<!-- IMG1 -->\n\n![工作演示图](https://oss.example/work.png)\n\n正文二",
    "fallback",
    "note.md",
    "0.9.8"
  );

  assert.equal(task.content.plainText, "正文一\n\n正文二");
  assert.doesNotMatch(task.content.plainText, /IMG1|工作演示图|work\.png/);
});

test("uses the first Zhihu article image as the default cover", () => {
  const task = createPublicationTask("zhihu", markdown, "fallback", "note.md", "0.9.8");
  assert.deepEqual(task.content.coverImage, task.content.images[0]);
});

test("uses the first WeChat article image as the default cover", () => {
  const task = createPublicationTask("wechat", markdown, "fallback", "note.md", "0.9.8");
  assert.deepEqual(task.content.coverImage, task.content.images[0]);
});

test("switches long Xiaohongshu content to article mode without truncating it", () => {
  const task = createPublicationTask(
    "xiaohongshu",
    `# ${"长标题".repeat(12)}\n\n${"正文内容".repeat(300)}`,
    "fallback",
    "note.md",
    "0.9.0"
  );

  assert.equal(task.content.mode, "article");
  assert.match(task.editorUrl, /target=article/);
  assert.ok(Array.from(task.content.plainText).length > 1000);
  assert.ok(task.content.richHtml);
  assert.ok(task.issues.some((issue) => issue.code === "xiaohongshu-article-mode"));
  assert.ok(!task.issues.some((issue) => issue.code === "xiaohongshu-body-truncated"));
});

test("uses confirmed real-account editor entry URLs", () => {
  const x = createPublicationTask("x", markdown, "fallback", "note.md", "0.9.4");
  const zhihu = createPublicationTask("zhihu", markdown, "fallback", "note.md", "0.9.4");
  const xiaohongshuLong = createPublicationTask(
    "xiaohongshu",
    `# 长文\n\n${"完整正文。".repeat(300)}`,
    "fallback",
    "note.md",
    "0.9.4"
  );

  assert.equal(x.editorUrl, "https://x.com/compose/articles");
  assert.equal(zhihu.editorUrl, "https://zhuanlan.zhihu.com/write");
  assert.match(xiaohongshuLong.editorUrl, /^https:\/\/creator\.xiaohongshu\.com\/publish\/publish\?.*target=article/);
});

test("serializes all platform drafts with the shared prefix", () => {
  const task = createPublicationTask("zhihu", markdown, "fallback", "note.md", "0.9.0");
  assert.ok(serializePublicationTask(task).startsWith(PUBLICATION_TASK_PREFIX));
});

test("skips an unavailable image without blocking the remaining draft", () => {
  const source = "https://oss.example/image.png";
  const xTask = createPublicationTask("x", markdown, "fallback", "note.md", "0.9.4");
  omitUnavailableImage(xTask, source, "Request failed, status 404");

  assert.equal(xTask.content.images.length, 0);
  assert.equal(xTask.content.xArticle?.entity_map.filter((entity) => entity.value.type === "MEDIA").length, 0);
  assert.ok(xTask.content.plainText.includes("重点内容"));
  assert.ok(xTask.issues.some((issue) => issue.code === "image-unavailable" && issue.severity === "warning"));

  const richTask = createPublicationTask("zhihu", markdown, "fallback", "note.md", "0.9.4");
  omitUnavailableImage(richTask, source, "Request failed, status 404");
  assert.doesNotMatch(richTask.content.richHtml ?? "", /<img/);
  assert.equal(richTask.content.coverImage, undefined);
  assert.ok(richTask.content.plainText.includes("重点内容"));
});

test("removes unavailable signed OSS image URLs from rich HTML", () => {
  const source = "https://bucket.oss-cn.example.com/demo.png?x=1&signature=abc";
  const task = createPublicationTask("zhihu", `# 标题\n\n正文\n\n![图](${source})`, "fallback", "note.md", "0.9.4");

  assert.match(task.content.richHtml ?? "", /x=1&amp;signature=abc/);
  omitUnavailableImage(task, source, "HTTP 404");
  assert.doesNotMatch(task.content.richHtml ?? "", /<img/);
});
