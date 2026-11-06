import { createHmac, timingSafeEqual } from 'node:crypto';

export type PantryIdentity = {
  version: 2; issuer: 'the-cookbook'; audience: 'tote-pantry';
  subject: string; email: string; issuedAt: number; expiresAt: number;
};
export const normalizePantryEmail = (email: string) => email.trim().toLowerCase();

export function signPantryIdentity(subject: string, email: string, secret: string, now = Date.now()): string {
  if (!secret || !subject) throw new Error('Pantry identity is not configured');
  const issuedAt = Math.floor(now / 1000);
  const identity: PantryIdentity = { version: 2, issuer: 'the-cookbook', audience: 'tote-pantry', subject,
    email: normalizePantryEmail(email), issuedAt, expiresAt: issuedAt + 60 };
  const payload = Buffer.from(JSON.stringify(identity)).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

export function verifyPantryIdentity(header: string | null, secret: string, now = Date.now()): PantryIdentity | null {
  if (!secret || !header || header.length > 4096) return null;
  const match = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/i.exec(header);
  if (!match) return null;
  const [, payload, signature] = match;
  const expected = createHmac('sha256', secret).update(payload!).digest();
  const given = Buffer.from(signature!, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected) || given.toString('base64url') !== signature) return null;
  try {
    const bytes = Buffer.from(payload!, 'base64url');
    if (bytes.toString('base64url') !== payload) return null;
    const data = JSON.parse(bytes.toString('utf8')) as PantryIdentity;
    const seconds = Math.floor(now / 1000);
    if (data.version !== 2 || data.issuer !== 'the-cookbook' || data.audience !== 'tote-pantry' ||
      typeof data.subject !== 'string' || !data.subject || data.subject.length > 200 ||
      typeof data.email !== 'string' || data.email.length > 254 || data.email !== normalizePantryEmail(data.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
      !Number.isInteger(data.issuedAt) || !Number.isInteger(data.expiresAt) ||
      data.issuedAt > seconds + 10 || data.expiresAt <= seconds || data.expiresAt - data.issuedAt > 60 || data.expiresAt <= data.issuedAt) return null;
    return data;
  } catch { return null; }
}
