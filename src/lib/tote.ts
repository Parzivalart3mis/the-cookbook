/**
 * Reads your pantry from the tote app (GET /api/integrations/pantry).
 * tote only shares items that are In stock or Running low.
 *
 * The apps use different Clerk instances, so this is a server-to-server call
 * with a shared bearer secret. tote binds that secret to a single user.
 */
export type PantryItem = {
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  status: 'IN_STOCK' | 'LOW';
};

export type PantryResult =
  | { ok: true; items: PantryItem[] }
  | { ok: false; reason: 'not-configured' | 'unreachable'; message: string };

export async function getPantry(): Promise<PantryResult> {
  const base = process.env.TOTE_API_URL?.trim().replace(/\/+$/, '');
  const key = process.env.TOTE_API_KEY?.trim();
  if (!base || !key) {
    return {
      ok: false,
      reason: 'not-configured',
      message: 'Pantry is not connected. Set TOTE_API_URL and TOTE_API_KEY in The Cookbook, and PANTRY_SHARE_SECRET / PANTRY_SHARE_USER_ID in tote.',
    };
  }

  try {
    const res = await fetch(`${base}/api/integrations/pantry`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store', // the pantry changes constantly; always read it fresh
      // tote may first sort new items into categories with AI (capped at ~6s there).
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`[tote] pantry request failed: ${res.status}`);
      const message =
        res.status === 401 ? 'tote rejected the key: TOTE_API_KEY must match tote’s PANTRY_SHARE_SECRET.'
        : res.status === 503 ? 'Pantry sharing is switched off in tote (set PANTRY_SHARE_SECRET and PANTRY_SHARE_USER_ID there).'
        : `Couldn’t reach your tote pantry (HTTP ${res.status}).`;
      return { ok: false, reason: 'unreachable', message };
    }
    const data = (await res.json()) as { items?: PantryItem[] };
    return { ok: true, items: cookableItems(data.items ?? []) };
  } catch (err) {
    console.error('[tote] pantry request failed', err);
    return { ok: false, reason: 'unreachable', message: 'Couldn’t reach your tote pantry. Try again in a moment.' };
  }
}

/**
 * tote already drops Household / Personal Care items (it sorts new items with
 * AI first). This is a fallback for anything still uncategorized there.
 */
const NON_FOOD_CATEGORIES = new Set(['Household', 'Personal Care']);
const NON_FOOD_NAME =
  /\b(toilet|tissue|paper towel|napkin|detergent|soap|shampoo|conditioner|toothpaste|toothbrush|deodorant|lotion|bleach|cleaner|sponge|trash|garbage|bin bag|foil|cling ?film|plastic wrap|zip ?lock|ziploc|parchment|batter(?:y|ies)|light ?bulb|dishwasher|laundry|fabric softener|razor|floss|diaper|wipes)\b/i;

/** The pantry is also a household inventory; recipes only need the food. */
export function cookableItems(items: PantryItem[]): PantryItem[] {
  return items
    .map(i => ({ ...i, name: i.name.trim() }))
    .filter(i => i.name && !NON_FOOD_CATEGORIES.has(i.category ?? '') && !NON_FOOD_NAME.test(i.name));
}

export function formatPantryItem(i: PantryItem): string {
  const qty = [i.quantity, i.unit].filter(Boolean).join(' ');
  return `${i.name}${qty ? ` (${qty})` : ''}${i.status === 'LOW' ? ' [running low]' : ''}`;
}
