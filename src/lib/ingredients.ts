import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

const CATEGORIES: [string, string[]][] = [
  ['Produce', ['tomato', 'onion', 'garlic', 'pepper', 'lettuce', 'spinach', 'carrot', 'celery', 'potato', 'lemon', 'lime', 'mushroom', 'zucchini', 'cucumber', 'avocado', 'broccoli', 'kale', 'basil', 'cilantro', 'parsley', 'ginger', 'apple', 'banana', 'berry', 'mint', 'shallot', 'leek', 'cabbage']],
  ['Protein', ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'tofu', 'tempeh', 'egg', 'salmon', 'tuna', 'lamb', 'turkey', 'bacon', 'sausage', 'beans', 'lentils', 'chickpea', 'prawn', 'steak', 'mince', 'ground beef', 'ground turkey']],
  ['Dairy', ['milk', 'butter', 'cream', 'cheese', 'yogurt', 'parmesan', 'mozzarella', 'cheddar', 'sour cream', 'ghee', 'ricotta', 'feta', 'brie', 'gouda', 'half-and-half']],
  ['Pantry', ['flour', 'sugar', 'oil', 'vinegar', 'sauce', 'pasta', 'rice', 'bread', 'broth', 'stock', 'canned', 'tomato paste', 'coconut milk', 'soy sauce', 'honey', 'maple syrup', 'oats', 'nuts', 'seeds', 'cornstarch', 'baking', 'vanilla', 'noodle', 'cracker', 'breadcrumb']],
  ['Spices', ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'thyme', 'rosemary', 'cinnamon', 'turmeric', 'cayenne', 'chili', 'bay leaf', 'seasoning', 'powder', 'flake', 'cardamom', 'clove', 'nutmeg', 'allspice', 'anise']],
];

export function categorize(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of CATEGORIES) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Other';
}

const INGREDIENT_KW = ['ingredient', 'what you need', "you'll need", 'shopping list'];
const INSTRUCTION_KW = ['instruction', 'step', 'method', 'direction', 'how to', 'preparation', 'procedure'];

export function extractIngredients(blocks: BlockObjectResponse[]): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = blocks as any[];

  function isHeading(block: { type: string }) {
    return block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3';
  }
  function headingText(block: { type: string; [key: string]: unknown }): string {
    const rich = (block[block.type] as { rich_text?: { plain_text: string }[] })?.rich_text ?? [];
    return rich.map((r: { plain_text: string }) => r.plain_text).join('').toLowerCase();
  }
  function listText(block: { type: string; [key: string]: unknown }): string {
    const rich = (block[block.type] as { rich_text?: { plain_text: string }[] })?.rich_text ?? [];
    return rich.map((r: { plain_text: string }) => r.plain_text).join('').trim();
  }
  const isList = (block: { type: string }) =>
    block.type === 'bulleted_list_item' || block.type === 'numbered_list_item';

  const hasIngredientHeading = b.some(block => isHeading(block) && INGREDIENT_KW.some(k => headingText(block).includes(k)));
  if (hasIngredientHeading) {
    let collecting = false;
    const result: string[] = [];
    for (const block of b) {
      if (isHeading(block)) { collecting = INGREDIENT_KW.some(k => headingText(block).includes(k)); continue; }
      if (collecting && isList(block)) { const t = listText(block); if (t) result.push(t); }
    }
    if (result.length > 0) return result;
  }

  const instructionIdx = b.findIndex(block => isHeading(block) && INSTRUCTION_KW.some(k => headingText(block).includes(k)));
  const relevant = instructionIdx === -1 ? b : b.slice(0, instructionIdx);
  const bulleted = relevant.filter((bl: { type: string }) => bl.type === 'bulleted_list_item').map(listText).filter(Boolean);
  if (bulleted.length > 0) return bulleted;

  return b.filter((bl: { type: string }) => bl.type === 'bulleted_list_item').map(listText).filter(Boolean);
}
