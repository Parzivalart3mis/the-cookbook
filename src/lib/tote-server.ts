import { clerkClient } from '@clerk/nextjs/server';
import { normalizePantryEmail, signPantryIdentity } from './pantry-identity';
import { cookableItems, type PantryResult, type PantryItem } from './tote';

export function pantryFailureStatus(reason: string): number {
  return ({ 'verify-email': 403, 'not-linked': 404, 'ambiguous-account': 409, unreachable: 502 } as Record<string, number>)[reason] ?? 503;
}

/** The caller passes only its authenticated Clerk ID, never an email from the browser. */
export async function getPantry(userId: string): Promise<PantryResult> {
  const base = process.env.TOTE_API_URL?.trim().replace(/\/+$/, '');
  const key = process.env.TOTE_API_KEY?.trim();
  if (!base || !key) return { ok: false, reason: 'not-configured', message: 'Pantry linking is not configured on this deployment.' };

  let email: string;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const primary = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId);
    if (user.id !== userId || !primary || primary.verification?.status !== 'verified') {
      return { ok: false, reason: 'verify-email', message: 'Verify your primary email in your Cookbook account, then sign in to tote with the same verified email.' };
    }
    email = normalizePantryEmail(primary.emailAddress);
  } catch {
    return { ok: false, reason: 'identity-unavailable', message: 'Could not verify your Cookbook account right now. Try refreshing pantry shortly.' };
  }
  try {
    const res = await fetch(`${base}/api/integrations/pantry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signPantryIdentity(userId, email, key)}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const reason = res.status === 404 ? 'not-linked' : res.status === 409 ? 'ambiguous-account' : res.status === 403 ? 'verify-email' : res.status === 405 || res.status === 410 ? 'service-upgrade' : 'unreachable';
      const message = reason === 'not-linked' ? 'No matching tote account was found. Sign in to tote with the same verified email as your Cookbook primary email, then refresh pantry.'
        : reason === 'verify-email' ? 'Verify the matching email in tote, then refresh pantry.'
        : reason === 'ambiguous-account' ? 'More than one tote account matches this email. Resolve the duplicate accounts before linking your pantry.'
        : reason === 'service-upgrade' ? 'The tote connection needs an update before account linking can work.'
        : res.status === 401 ? 'The pantry connection could not authenticate. Check the shared server configuration.'
        : 'Could not reach your tote pantry. Try refreshing shortly.';
      console.warn('[tote]', { status: res.status, reason });
      return { ok: false, reason, message };
    }
    const data = await res.json() as { protocolVersion?: number; connectionId?: string; items?: PantryItem[] };
    // Never accept an old server's fixed-owner response as this person's pantry.
    if (data.protocolVersion !== 2 || typeof data.connectionId !== 'string' || !/^[a-f0-9]{64}$/.test(data.connectionId) || !Array.isArray(data.items)) {
      return { ok: false, reason: 'service-upgrade', message: 'The tote connection needs an update before account linking can work.' };
    }
    return { ok: true, items: cookableItems(data.items), connectionId: data.connectionId };
  } catch {
    return { ok: false, reason: 'unreachable', message: 'Could not reach your tote pantry. Try refreshing shortly.' };
  }
}
