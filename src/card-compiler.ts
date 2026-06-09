import { articleBlockPreview, type ArticleBlock, type ArticleDocument } from "./document-model";

export interface ArticleCard {
  index: number;
  blocks: ArticleBlock[];
  estimatedWeight: number;
  mayOverflow: boolean;
}

const MAX_CARD_WEIGHT = 980;

export function compileArticleCards(document: ArticleDocument): ArticleCard[] {
  const sourceBlocks = document.blocks.filter((block) =>
    !(block.type === "heading" && block.depth === 1 && articleBlockPreview(block) === document.title)
  );
  const cards: ArticleCard[] = [];
  let blocks: ArticleBlock[] = [];
  let weight = 0;

  for (const block of sourceBlocks) {
    const blockWeight = estimateBlockWeight(block);
    const beginsSection = block.type === "heading" && block.depth <= 2;
    const shouldBreak = blocks.length > 0 &&
      (weight + blockWeight > MAX_CARD_WEIGHT || (beginsSection && weight > MAX_CARD_WEIGHT * 0.55));

    if (shouldBreak) {
      cards.push(createCard(cards.length, blocks, weight));
      blocks = [];
      weight = 0;
    }

    blocks.push(block);
    weight += blockWeight;
  }

  if (blocks.length) cards.push(createCard(cards.length, blocks, weight));
  return cards;
}

export function estimateBlockWeight(block: ArticleBlock): number {
  switch (block.type) {
    case "heading":
      return 120 + articleBlockPreview(block).length * 2;
    case "paragraph":
      return 70 + articleBlockPreview(block).length * 2.5;
    case "list":
      return 100 + block.items.reduce(
        (total, item) => total + item.reduce((sum, child) => sum + estimateBlockWeight(child), 0),
        0
      );
    case "quote":
    case "callout":
      return 130 + block.blocks.reduce((total, child) => total + estimateBlockWeight(child), 0);
    case "code":
      return 150 + block.value.split("\n").length * 34 + Math.min(block.value.length, 500);
    case "table":
      return 170 + block.rows.length * 58 + (block.rows[0]?.length ?? 0) * 24;
    case "image":
      return 620;
    case "thematicBreak":
      return 50;
  }
}

function createCard(index: number, blocks: ArticleBlock[], weight: number): ArticleCard {
  return {
    index,
    blocks,
    estimatedWeight: Math.round(weight),
    mayOverflow: weight > MAX_CARD_WEIGHT
  };
}

