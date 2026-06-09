import assert from "node:assert/strict";
import test from "node:test";
import { compileArticleCards } from "../src/card-compiler";
import { parseArticleDocument } from "../src/document-model";

test("compiles article blocks into ordered cards without dropping content", () => {
  const markdown = `# 标题

${"第一部分内容。".repeat(30)}

## 第二部分

${"第二部分内容。".repeat(30)}

\`\`\`ts
const value = 1;
\`\`\``;
  const document = parseArticleDocument(markdown);
  const cards = compileArticleCards(document);
  const compiledBlocks = cards.flatMap((card) => card.blocks);

  assert.ok(cards.length > 1);
  assert.equal(compiledBlocks.length, document.blocks.length - 1);
  cards.forEach((card, index) => assert.equal(card.index, index));
});

test("starts a major section on a new card when the current card is already substantial", () => {
  const markdown = `# 标题

${"内容。".repeat(100)}

## 新章节

章节正文。`;
  const cards = compileArticleCards(parseArticleDocument(markdown));

  assert.ok(cards.length >= 2);
  assert.equal(cards.at(-1)?.blocks[0]?.type, "heading");
});
