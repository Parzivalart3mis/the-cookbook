import type { RecipeSummary } from './notion';

// Metadata vocabulary, not a classifier: missing labels remain unknown.
const CUISINES = ['indian', 'chinese', 'italian', 'american', 'thai', 'mexican', 'japanese', 'korean', 'vietnamese', 'mediterranean', 'greek', 'french', 'spanish', 'lebanese', 'turkish', 'middle eastern', 'caribbean', 'british', 'indonesian', 'malaysian', 'ethiopian', 'pakistani', 'bangladeshi', 'sri lankan', 'nepalese', 'cajun', 'tex mex'];
const ALIASES: Record<string, string> = { indiian: 'indian' };
export function cuisineKey(value: string): string {
  const key = value.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return Object.hasOwn(ALIASES, key) ? ALIASES[key] : key;
}
function containsLabel(text: string, label: string) {
  return ` ${text} `.includes(` ${label} `);
}
export function recipeCuisineStatus(recipe: Pick<RecipeSummary, 'name' | 'tags'>, requested: string): 'match' | 'unknown' | 'different' {
  const key = cuisineKey(requested);
  if (!key) return 'match';
  const tags = recipe.tags.map(cuisineKey);
  const name = cuisineKey(recipe.name);
  if (tags.some(tag => containsLabel(tag, key)) || containsLabel(name, key)) return 'match';
  const known = CUISINES.some(cuisine => tags.some(tag => containsLabel(tag, cuisine)) || containsLabel(name, cuisine));
  return known ? 'different' : 'unknown';
}
