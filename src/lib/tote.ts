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
      signal: AbortSignal.timeout(8_000),
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
    return { ok: true, items: data.items ?? [] };
  } catch (err) {
    console.error('[tote] pantry request failed', err);
    return { ok: false, reason: 'unreachable', message: 'Couldn’t reach your tote pantry. Try again in a moment.' };
  }
}

export function formatPantryItem(i: PantryItem): string {
  const qty = [i.quantity, i.unit].filter(Boolean).join(' ');
  return `${i.name}${qty ? ` (${qty})` : ''}${i.status === 'LOW' ? ' [running low]' : ''}`;
}
