import aliases from '@/data/recipe-aliases.json';

const legacyAliases: Record<string, string[]> = aliases;
export const stableRecipeId = (id: string) => id.replace(/-/g, '').toLowerCase();
export const isRecipeId = (value: string) => /^[a-f0-9]{32}$/.test(stableRecipeId(value));

/** Old title URLs were ambiguous on collision; never guess which recipe owns them. */
export function canonicalRecipeKey(reference: string): string {
  if (isRecipeId(reference)) return stableRecipeId(reference);
  const ids = Object.hasOwn(legacyAliases, reference) ? legacyAliases[reference] : undefined;
  return ids?.length === 1 ? ids[0] : reference;
}

export function recipeReferenceKeys(reference: string): string[] {
  const id = canonicalRecipeKey(reference);
  return [...new Set([id, reference, ...Object.keys(legacyAliases).filter(alias => legacyAliases[alias].length === 1 && legacyAliases[alias][0] === id)])];
}

/** Only the placeholder count is interpolated into SQL; all values stay bound. */
export const keyPlaceholders = (keys: string[]) => keys.map(() => '?').join(', ');

export const isAmbiguousRecipeAlias = (reference: string) => Object.hasOwn(legacyAliases, reference) && legacyAliases[reference].length > 1;
