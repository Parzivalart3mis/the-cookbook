import { cleanRefine, type Diet, type Targets } from './kitchen-ai';

export type SuggestionInputs = { cuisine?: string; diet?: Diet; refine?: string; targets?: Targets; fingerprint?: string };
export function suggestionsMatch(
  cached: (SuggestionInputs & { at: number }) | null,
  current: SuggestionInputs & { tab: string },
  now: number,
): boolean {
  if (!cached || now - cached.at >= 86_400_000 || cached.at > now + 60_000) return false;
  if ((cached.cuisine ?? '') !== current.cuisine || cached.diet !== current.diet || cached.refine !== cleanRefine(current.refine)) return false;
  if (current.tab !== 'discover' && (!current.fingerprint || cached.fingerprint !== current.fingerprint)) return false;
  return current.tab !== 'protein' || (cached.targets?.minProtein === current.targets?.minProtein && cached.targets?.maxCalories === current.targets?.maxCalories);
}
