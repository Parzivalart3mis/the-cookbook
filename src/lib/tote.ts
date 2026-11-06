import { ingredientAliasKey } from './ingredient-aliases';

export type PantryItem = {
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  status: 'IN_STOCK' | 'LOW';
};

export type PantryFailureReason = 'not-configured' | 'unreachable' | 'verify-email' | 'not-linked' | 'ambiguous-account' | 'identity-unavailable' | 'service-upgrade';
export type PantryResult =
  | { ok: true; items: PantryItem[]; connectionId: string }
  | { ok: false; reason: PantryFailureReason; message: string };

/**
 * tote already drops Household / Personal Care items: it sorts new items with
 * AI first and judges any still-uncategorized ones by name. This repeats that
 * check as a safety net. A category, when set, wins over the name, so food like
 * "Sponge cake mix" filed under Baking isn't dropped. Keep the word list in
 * sync with tote's lib/categories.ts.
 */
const NON_FOOD_CATEGORIES = new Set(['Household', 'Personal Care']);
const NON_FOOD_NAME =
  /\b(?:toilet|tissue|paper towel|napkin|detergent|soap|shampoo|conditioner|toothpaste|toothbrush|mouthwash|deodorant|lotion|sanitizer|(?:hand|body|face) ?wash|bleach|cleaner|sponge|trash|garbage|bin bag|foil|cling ?film|plastic wrap|zip ?lock|ziploc|parchment|batter(?:y|ies)|light ?bulb|dishwasher|laundry|fabric softener|razor|floss|diaper|wipe|bandage)(?:e?s)?\b/i;

function isFood(i: PantryItem): boolean {
  const category = i.category?.trim();
  return category ? !NON_FOOD_CATEGORIES.has(category) : !NON_FOOD_NAME.test(i.name);
}

/** The pantry is also a household inventory; recipes only need the food. */
export function cookableItems(items: PantryItem[]): PantryItem[] {
  return items
    .map(i => ({ ...i, name: i.name.trim() }))
    .filter(i => i.name && (i.status === 'IN_STOCK' || i.status === 'LOW') && isFood(i));
}

export function formatPantryItem(i: PantryItem): string {
  const qty = [i.quantity, i.unit].filter(Boolean).join(' ');
  return `${i.name}${qty ? ` (${qty})` : ''}${i.status === 'LOW' ? ' [running low]' : ''}`;
}

/** Spelling variants that should compare equal. */
const ALIASES: Record<string, string> = { chilli: 'chili', yoghurt: 'yogurt' };

/**
 * Canonical form of one word, so singular and plural compare equal: tomatoes →
 * tomato, cloves → clove, chillies/chilies/chili → chili. Not English, only a key.
 */
function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (/(?:s|x|z|ch|sh|o)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  w = w.replace(/y$/, 'i');
  return ALIASES[w] ?? w;
}

/**
 * Lowercased, stemmed words of an ingredient name. Square-bracket tags such as
 * "[running low]" come from the prompt (see formatPantryItem), never from a real
 * name, so they always go; notes in round brackets go only with `dropNotes`.
 */
export function ingredientWords(name: string, { dropNotes = false } = {}): string[] {
  let text = name.replace(/\[[^\]]*\]/g, ' ');
  if (dropNotes) text = text.replace(/\([^)]*\)/g, ' ');
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map(stem);
}

/**
 * Words that describe an ingredient without changing what it is. "Cream",
 * "powder", "sauce" and "brown" are deliberately absent: cream cheese, garlic
 * powder, tomato sauce and brown sugar are different things to buy.
 */
const DESCRIPTORS = new Set(
  [
    'fresh', 'frozen', 'dried', 'dry', 'raw', 'cooked', 'boiled', 'roasted', 'chopped', 'diced', 'sliced',
    'slices', 'minced', 'grated', 'shredded', 'crushed', 'mashed', 'whole', 'large', 'small', 'medium',
    'ripe', 'boneless', 'skinless', 'organic', 'firm', 'extra', 'virgin', 'plain', 'unsalted', 'salted',
    'canned', 'tinned', 'lean', 'baby', 'leaf', 'leaves', 'clove', 'cloves', 'low', 'fat', 'free', 'fatfree',
    'skim', 'reduced', 'a', 'the', 'that', 'of', 'for', 'and', 'with',
  ].map(stem)
);

function coreKey(words: string[]): string {
  return words.filter(w => !DESCRIPTORS.has(w) && !/^\d/.test(w)).sort().join(' ');
}

/**
 * Map a model-written ingredient to the real pantry item, if there is one.
 * Errs towards "not in the pantry": listing something the cook might already
 * have is better than hiding something they need to buy.
 */
export function matchPantry(candidate: string, pantry: PantryItem[]): PantryItem | undefined {
  const words = ingredientWords(candidate);
  if (!words.length) return undefined;

  // 1. Same name ("Urad Dal" must not land on "Urad (Whole) Dal").
  const full = words.join(' ');
  const exact = pantry.find(p => ingredientWords(p.name).join(' ') === full);
  if (exact) return exact;

  // 2. Same name once notes in brackets are ignored: "pinto beans" ↔ "Pinto Beans (for Burrito)".
  const bare = ingredientWords(candidate, { dropNotes: true }).join(' ');
  const noted = pantry.find(p => ingredientWords(p.name, { dropNotes: true }).join(' ') === bare);
  if (noted) return noted;

  // 3. Same once descriptive words are set aside: "boneless chicken breasts" ↔ "chicken breast",
  //    but "cream cheese" ≠ "cheese" and "garlic powder" ≠ "garlic".
  const core = coreKey(ingredientWords(candidate, { dropNotes: true }));
  if (!core) return undefined;
  const described = pantry.find(p => coreKey(ingredientWords(p.name, { dropNotes: true })) === core);
  if (described) return described;

  // 4. Curated ingredient equivalents, e.g. haldi ↔ turmeric powder. Never
  // discard form words globally or guess which blend "Masale" means.
  const alias = ingredientAliasKey(candidate);
  return alias ? pantry.find(p => ingredientAliasKey(p.name) === alias) : undefined;
}
