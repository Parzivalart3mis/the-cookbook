import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
process.env.COOKBOOK_TEST_MOCKS = '1';
process.env.COOKBOOK_OWNER_USER_ID = 'owner';
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = '';
process.env.NOTION_TOKEN = 'fake-notion-key';
process.env.TOTE_API_URL = 'https://pantry.test';
process.env.TOTE_API_KEY = 'fake-pantry-secret';
process.env.UNSPLASH_ACCESS_KEY = 'fake-unsplash-key';
const { db } = await import('../src/lib/db.ts');
const { isOwnerUser } = await import('../src/lib/access.ts');
const { getPantry } = await import('../src/lib/tote-server.ts');
const { unsplashDownloadUrl } = await import('../src/lib/image-security.ts');
const { canonicalRecipeKey, recipeReferenceKeys, stableRecipeId } = await import('../src/lib/recipe-identity.ts');
const { getAllRecipes, getRecipeBySlug } = await import('../src/lib/notion.ts');
const aliases = (await import('../src/data/recipe-aliases.json', { with: { type: 'json' } })).default;
const { POST: saveImage } = await import('../src/app/api/recipe-image/route.ts');
const checklist = await import('../src/app/api/checklist/[slug]/route.ts');
const notes = await import('../src/app/api/notes/[slug]/route.ts');
const favorites = await import('../src/app/api/favorites/route.ts');
const cooked = await import('../src/app/api/cooked/route.ts');
const queue = await import('../src/app/api/queue/route.ts');
const { invalidations } = await import('./fixtures/cache.mjs');
const [legacy, [id]] = Object.entries(aliases).find(([, ids]) => ids.length === 1);
const otherId = '123456781234123412341234567890ab';
const page = (rid = id, name = 'Renamed Recipe') => ({ id: rid, created_time: '2026-01-01', properties: { Name: { title: [{ plain_text: name }] } } });
const params = slug => ({ params: Promise.resolve({ slug }) });
const request = (body, method = 'POST', url = 'https://app.test/api') => new Request(url, { method, body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body) });
for (const sql of [
  'CREATE TABLE recipe_checklists(user_id TEXT, recipe_slug TEXT, item_ids TEXT, saved_at TEXT, PRIMARY KEY(user_id,recipe_slug))',
  'CREATE TABLE recipe_notes(user_id TEXT, recipe_slug TEXT, text TEXT, saved_at TEXT, PRIMARY KEY(user_id,recipe_slug))',
  'CREATE TABLE favorites(user_id TEXT, recipe_slug TEXT, added_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,recipe_slug))',
  'CREATE TABLE cooked_history(user_id TEXT, recipe_slug TEXT, cooked_at TEXT, PRIMARY KEY(user_id,recipe_slug))',
  'CREATE TABLE meal_queue(user_id TEXT, slug TEXT, name TEXT, prep_time INTEGER, cook_time INTEGER, added_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,slug))',
]) await db.execute(sql);
let calls = [];
beforeEach(async () => {
  globalThis.testClerkUser = undefined;
  globalThis.testUser = 'owner'; calls = []; invalidations.length = 0;
  for (const table of ['recipe_checklists', 'recipe_notes', 'favorites', 'cooked_history', 'meal_queue']) await db.execute(`DELETE FROM ${table}`);
  globalThis.testNotionBlocks = async () => ({ results: [], has_more: false });
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), ...options });
    return Response.json(String(url).includes('/query') ? { results: [page()], has_more: false } : {});
  };
});

test('image ownership remains closed without configuration; pantry accepts a different verified account', async () => {
  assert.equal(isOwnerUser('owner'), true); assert.equal(isOwnerUser('visitor'), false);
  globalThis.fetch = async () => Response.json({ protocolVersion: 2, connectionId: 'a'.repeat(64), items: [] });
  const linked = await getPantry('visitor'); assert.equal(linked.ok, true);
  const saved = process.env.COOKBOOK_OWNER_USER_ID; delete process.env.COOKBOOK_OWNER_USER_ID;
  assert.equal(isOwnerUser('owner'), false); process.env.COOKBOOK_OWNER_USER_ID = saved;
});
test('image changes require authentication, ownership and cookbook membership', async () => {
  globalThis.testUser = null;
  assert.equal((await saveImage(request({ pageId: id, imageUrl: null }))).status, 401);
  globalThis.testUser = 'visitor';
  assert.equal((await saveImage(request({ pageId: id, imageUrl: null }))).status, 403); assert.equal(calls.length, 0);
  globalThis.testUser = 'owner';
  assert.equal((await saveImage(request({ pageId: otherId, imageUrl: null }))).status, 404);
  assert.equal(calls.filter(c => c.method === 'PATCH').length, 0);
});
test('malicious tracking URLs never receive a request or the Unsplash key', async () => {
  for (const url of ['https://evil.test/photos/a/download', 'http://api.unsplash.com/photos/a/download', 'https://api.unsplash.com.evil.test/photos/a/download', 'https://api.unsplash.com@evil.test/photos/a/download', 'https://api.unsplash.com:444/photos/a/download', 'https://api.unsplash.com/photos/a/download?redirect=https://evil.test', 'https://api.unsplash.com/photos/a/download/../../users/a', 'https://api.unsplash.com/photos/a/download?client_id=bad']) {
    assert.equal(unsplashDownloadUrl(url), null);
    assert.equal((await saveImage(request({ pageId: id, imageUrl: null, downloadLocation: url }))).status, 400);
  }
  assert.equal(calls.length, 0);
});
test('valid image update derives cache paths from cookbook and disables tracking redirects', async () => {
  const response = await saveImage(request({ pageId: id, imageUrl: 'https://images.unsplash.com/a', downloadLocation: 'https://api.unsplash.com/photos/photo_123/download?ixid=abc123', slug: '/untrusted' }));
  assert.equal(response.status, 200);
  const tracking = calls.find(c => c.url.startsWith('https://api.unsplash.com'));
  assert.equal(tracking.redirect, 'error'); assert.equal(new URL(tracking.url).searchParams.get('client_id'), 'fake-unsplash-key');
  assert.ok(invalidations.includes(`/recipes/${id}`)); assert.ok(invalidations.includes('/recipes')); assert.ok(!invalidations.includes('/recipes//untrusted'));
});
test('recipe page IDs survive renames and duplicate titles; legacy aliases still resolve', async () => {
  assert.equal((await getAllRecipes())[0].slug, id);
  assert.equal((await getRecipeBySlug(legacy)).id, id);
  assert.equal((await getRecipeBySlug(id)).name, 'Renamed Recipe');
  globalThis.fetch = async () => Response.json({ results: [page(id, 'Same Name'), page(otherId, 'Same Name')], has_more: false });
  const recipes = await getAllRecipes(); assert.notEqual(recipes[0].slug, recipes[1].slug);
  assert.equal(await getRecipeBySlug('same-name'), null);
  assert.equal(canonicalRecipeKey('constructor'), 'constructor');
  assert.ok(recipeReferenceKeys(id).includes(legacy)); assert.equal(stableRecipeId(`${id.slice(0, 8)}-${id.slice(8)}`), id);
});
test('signed-in checklist round-trips canonical ids, accepts old clients and preserves old saved data', async () => {
  await db.execute({ sql: 'INSERT INTO recipe_checklists VALUES (?, ?, ?, ?)', args: ['owner', legacy, '["old-item"]', '2020-01-01'] });
  let body = await (await checklist.GET(request(null, 'GET'), params(id))).json(); assert.deepEqual(body.ids, ['old-item']);
  assert.equal((await checklist.POST(request({ ids: ['new-item'] }), params(id))).status, 200);
  body = await (await checklist.GET(request(null, 'GET'), params(legacy))).json(); assert.deepEqual(body.ids, ['new-item']); assert.deepEqual(body.itemIds, ['new-item']);
  assert.equal((await checklist.POST(request({ itemIds: ['legacy-client'] }), params(id))).status, 200);
  assert.equal((await checklist.POST(request({ itemIds: 'invalid' }), params(id))).status, 400);
  globalThis.testUser = 'visitor'; assert.deepEqual((await (await checklist.GET(request(null, 'GET'), params(id))).json()).ids, []);
  globalThis.testUser = 'owner'; await checklist.DELETE(request(null, 'DELETE'), params(id));
  assert.deepEqual((await (await checklist.GET(request(null, 'GET'), params(id))).json()).ids, []);
});
test('legacy notes are readable after renames and new writes use permanent IDs', async () => {
  await db.execute({ sql: 'INSERT INTO recipe_notes VALUES (?, ?, ?, ?)', args: ['owner', legacy, 'Existing note', '2020-01-01'] });
  assert.equal((await (await notes.GET(request(null, 'GET'), params(id))).json()).text, 'Existing note');
  await notes.POST(request({ text: 'Updated note' }), params(legacy));
  assert.equal((await (await notes.GET(request(null, 'GET'), params(id))).json()).text, 'Updated note');
  const rows = await db.execute({ sql: 'SELECT recipe_slug FROM recipe_notes WHERE text = ?', args: ['Updated note'] }); assert.equal(rows.rows[0].recipe_slug, id);
});
test('favorites, cooked dates and queue translate old keys and remove both forms', async () => {
  for (const key of [legacy, id]) {
    await db.execute({ sql: 'INSERT INTO favorites (user_id,recipe_slug) VALUES (?,?)', args: ['owner', key] });
    await db.execute({ sql: 'INSERT INTO cooked_history VALUES (?,?,?)', args: ['owner', key, key === legacy ? '2026-11-01' : '2026-10-01'] });
    await db.execute({ sql: 'INSERT INTO meal_queue(user_id,slug,name) VALUES (?,?,?)', args: ['owner', key, 'Recipe'] });
  }
  assert.deepEqual((await (await favorites.GET()).json()).favorites, [id]);
  assert.equal((await (await cooked.GET()).json()).cooked[id], '2026-11-01');
  assert.equal((await (await queue.GET()).json()).queue.length, 1);
  const deletion = request(null, 'DELETE', `https://app.test/api?slug=${id}`);
  await favorites.DELETE(deletion); await cooked.DELETE(deletion); await queue.DELETE(deletion);
  assert.deepEqual((await (await favorites.GET()).json()).favorites, []);
  assert.deepEqual((await (await cooked.GET()).json()).cooked, {});
  assert.deepEqual((await (await queue.GET()).json()).queue, []);
});
