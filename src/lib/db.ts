import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }
  return _db;
}

// Proxy so existing `db.execute(...)` calls continue to work unchanged
export const db = new Proxy({} as Client, {
  get(_, prop: string) {
    return getDb()[prop as keyof Client];
  },
});
