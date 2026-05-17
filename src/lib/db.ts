import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    // Use https:// — libsql:// WebSocket is unreliable in Vercel serverless
    const url = (process.env.TURSO_DATABASE_URL ?? '').replace(/^libsql:\/\//, 'https://');
    _db = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }
  return _db;
}

// Proxy so existing `db.execute(...)` calls continue to work unchanged.
// Bind each method to the real client so `this` is correct inside execute/batch/etc.
export const db = new Proxy({} as Client, {
  get(_, prop: string) {
    const client = getDb();
    const value = client[prop as keyof Client];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof value === 'function' ? (value as any).bind(client) : value;
  },
});
