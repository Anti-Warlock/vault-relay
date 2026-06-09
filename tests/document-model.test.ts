import assert from "node:assert/strict";
import test from "node:test";
import { parseArticleDocument } from "../src/document-model";

test("parses markdown into a platform-neutral article document", () => {
  const markdown = `---
title: 发布测试
---
# 主标题

这是 **加粗** 和 [链接](https://example.com)。

- 第一项
- 第二项

> [!NOTE] 注意事项
> 这是 Callout 内容。

\`\`\`ts
const value = 1;
\`\`\`

| A | B |
| - | - |
| 1 | 2 |

![远程图片](https://oss.example/image.png)

![[local-image.png]]`;

  const document = parseArticleDocument(markdown);

  assert.equal(document.title, "主标题");
  assert.equal(document.stats.headings, 1);
  assert.equal(document.stats.lists, 1);
  assert.equal(document.stats.codeBlocks, 1);
  assert.equal(document.stats.tables, 1);
  assert.equal(document.stats.images, 2);
  assert.equal(document.assets[0].kind, "remote");
  assert.equal(document.assets[1].kind, "local");
  assert.ok(document.warnings.some((warning) => warning.code === "local-asset"));
  assert.ok(document.blocks.some((block) => block.type === "callout"));
});

test("warns when heading depth is difficult to preserve", () => {
  const document = parseArticleDocument("#### 深层标题");

  assert.ok(document.warnings.some((warning) => warning.code === "too-many-heading-levels"));
});

test("ignores HTML comments used as author notes", () => {
  const document = parseArticleDocument("<!-- replace this image before publishing -->\n\n正文");

  assert.equal(document.warnings.length, 0);
  assert.equal(document.stats.paragraphs, 1);
});
