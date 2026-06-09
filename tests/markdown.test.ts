import assert from "node:assert/strict";
import test from "node:test";
import {
  countCharacters,
  countXWeightedCharacters,
  extractRemoteImageUrls,
  mapRemoteImagesToPosts,
  markdownToPost,
  splitIntoPosts
} from "../src/markdown";

test("converts common Obsidian markdown to readable post text", () => {
  const markdown = `---
title: Demo
---
# 标题

这是 **重点**，链接到 [[目标|别名]] 和 [官网](https://example.com)。

![[image.png]]`;

  assert.equal(markdownToPost(markdown), "标题\n\n这是 重点，链接到 别名 和 官网 https://example.com。");
});

test("keeps a short note as one post", () => {
  assert.deepEqual(splitIntoPosts("一段短文", true), ["一段短文"]);
});

test("splits long text and numbers a thread within the limit", () => {
  const text = `${"第一句。".repeat(55)}\n\n${"第二句。".repeat(55)}`;
  const posts = splitIntoPosts(text, true);

  assert.ok(posts.length > 1);
  posts.forEach((post, index) => {
    assert.ok(countCharacters(post) <= 280);
    assert.ok(post.endsWith(`${index + 1}/${posts.length}`));
  });
});

test("counts unicode code points instead of UTF-16 units", () => {
  assert.equal(countCharacters("你好😀"), 3);
});

test("uses X weighted character rules for CJK, emoji, and URLs", () => {
  assert.equal(countXWeightedCharacters("abc"), 3);
  assert.equal(countXWeightedCharacters("中文"), 4);
  assert.equal(countXWeightedCharacters("😀"), 2);
  assert.equal(countXWeightedCharacters("https://example.com/a/very/long/path"), 23);
});

test("splits Chinese posts using the X weighted limit", () => {
  const posts = splitIntoPosts("中文内容。".repeat(40), false);

  assert.ok(posts.length > 1);
  posts.forEach((post) => assert.ok(countXWeightedCharacters(post) <= 280));
});

test("extracts and deduplicates remote image URLs", () => {
  const markdown = "![a](https://oss.example/a.png)\n![b](https://oss.example/b.jpg)\n![a](https://oss.example/a.png)";
  assert.deepEqual(extractRemoteImageUrls(markdown), [
    "https://oss.example/a.png",
    "https://oss.example/b.jpg"
  ]);
});

test("normalizes soft line breaks for long-form posts", () => {
  const markdown = `这是第一行
这是第二行
这是第三行

- 第一项
- 第二项

English line one
continues here.`;

  assert.equal(
    markdownToPost(markdown),
    "这是第一行这是第二行这是第三行\n\n• 第一项\n• 第二项\n\nEnglish line one continues here."
  );
});

test("turns literal newline escapes into real paragraphs", () => {
  assert.equal(markdownToPost("第一段\\n\\n第二段"), "第一段\n\n第二段");
});

test("maps remote images to the closest generated post", () => {
  const markdown = `第一部分内容。

![one](https://oss.example/one.png)

第二部分内容。

![two](https://oss.example/two.png)`;
  const posts = ["第一部分内容。", "第二部分内容。"];

  assert.deepEqual(mapRemoteImagesToPosts(markdown, posts), [
    ["https://oss.example/one.png"],
    ["https://oss.example/two.png"]
  ]);
});

test("avoids leaving a tiny final post when content can be rebalanced", () => {
  const text = `${"第一部分内容很完整。".repeat(8)}${"第二部分继续说明。".repeat(8)}短结尾。`;
  const posts = splitIntoPosts(text, false, 100);

  assert.ok(posts.length > 1);
  assert.ok(countXWeightedCharacters(posts.at(-1) ?? "") >= 30);
  posts.forEach((post) => assert.ok(countXWeightedCharacters(post) <= 100));
});
