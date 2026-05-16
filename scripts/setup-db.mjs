import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  try {
    const lines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {}
}
loadEnv();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS shopping_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    category TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    recipe_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS meal_queue (
    user_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    prep_time INTEGER,
    cook_time INTEGER,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, slug)
  )`,
  `CREATE TABLE IF NOT EXISTS recipe_checklists (
    user_id TEXT NOT NULL,
    recipe_slug TEXT NOT NULL,
    item_ids TEXT NOT NULL DEFAULT '[]',
    saved_at TEXT NOT NULL,
    PRIMARY KEY (user_id, recipe_slug)
  )`,
  `CREATE TABLE IF NOT EXISTS recipe_notes (
    user_id TEXT NOT NULL,
    recipe_slug TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    saved_at TEXT NOT NULL,
    PRIMARY KEY (user_id, recipe_slug)
  )`,
  `CREATE TABLE IF NOT EXISTS cooked_history (
    user_id TEXT NOT NULL,
    recipe_slug TEXT NOT NULL,
    cooked_at TEXT NOT NULL,
    PRIMARY KEY (user_id, recipe_slug)
  )`,
  `CREATE TABLE IF NOT EXISTS future_recipes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

for (const sql of statements) {
  await db.execute(sql);
  const table = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
  console.log(`✓ ${table}`);
}
console.log('\nAll tables created successfully.');
