import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
process.env.COOKBOOK_TEST_MOCKS = '1';
process.env.COOKBOOK_OWNER_USER_ID = 'test-user';
process.env.GEMINI_API_KEY = 'fake-test-key';
process.env.TOTE_API_URL = 'https://pantry.test';
process.env.TOTE_API_KEY = 'fake-pantry-key';
const { calls, outcomes, ApiError } = await import('./fixtures/ai.mjs');
const { generateJson, generateText, aiErrorResponse } = await import('../src/lib/gemini.ts');
const { AiOutputError, AiTimeoutError } = await import('../src/lib/ai-errors.ts');
const { GET: getPantry } = await import('../src/app/api/pantry/route.ts');
const { POST: generatePantry } = await import('../src/app/api/ai/pantry-recipes/route.ts');
const { getCookbookIndex } = await import('../src/lib/cookbook-index.ts');
const { getAllRecipes } = await import('../src/lib/notion.ts');
const { getRecipeBlocks } = await import('../src/lib/notion.ts');
const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] };
const opts = () => ({ tier: 'full', system: 'Test', prompt: 'Test', schema, deadline: Date.now() + 3000 });
const pantryItems = [{ name: 'lentils', quantity: '1', unit: 'kg', category: 'Food', status: 'IN_STOCK' }];
const page = (name = 'Lentil Soup') => ({ id: name, created_time: '2026-01-01', properties: { Name: { title: [{ plain_text: name }] } } });
const block = (type, text) => ({ id: text, type, [type]: { rich_text: [{ plain_text: text }] } });
const dish = (name = 'New Lentil Stew') => ({ name, description: 'Dinner', timeMinutes: 20, servings: 2, difficulty: 'Easy', usesFromPantry: ['lentils'], missing: [], steps: ['Boil lentils.', 'Serve.'], nutrition: { protein: 30, calories: 300, carbs: 30, fat: 6 } });
beforeEach(() => {
  calls.length = 0; outcomes.length = 0; globalThis.testUser = 'test-user';
  globalThis.testNotionBlocks = async () => ({ results: [block('heading_2', 'Ingredients'), block('bulleted_list_item', '1 cup lentils')], has_more: false });
  globalThis.fetch = async (url) => Response.json(String(url).includes('pantry.test') ? { items: pantryItems } : { results: [page()], has_more: false });
});

test('invalid JSON, schema mismatch and empty output fall back before accepting an answer', async () => {
  outcomes.push('not json', '{"answer":12}', '{"answer":"ok"}');
  assert.deepEqual(await generateJson(opts()), { answer: 'ok' }); assert.equal(calls.length, 3);
  assert.equal(calls[0].config.httpOptions.retryOptions.attempts, 1);
  assert.equal(calls[0].config.thinkingConfig.thinkingLevel, 'LOW');
  outcomes.push('', '{"answer":"recovered"}');
  assert.deepEqual(await generateJson(opts()), { answer: 'recovered' }); assert.equal(calls.length, 5);
});
test('network errors retry, rejected credentials stop, and quota errors are distinct', async () => {
  outcomes.push(new TypeError('fetch failed'), '{"answer":"ok"}');
  await generateJson(opts()); assert.equal(calls.length, 2);
  outcomes.push(new ApiError(403));
  await assert.rejects(generateJson(opts())); assert.equal(calls.length, 3);
  const denied = aiErrorResponse(new ApiError(403), 'ref-test'); assert.equal(denied.status, 503);
  const quota = aiErrorResponse(new ApiError(429), 'ref-test'); assert.equal(quota.status, 429); assert.equal((await quota.json()).code, 'quota');
});
test('slow attempts hedge and abort the losing request', async () => {
  outcomes.push(({ config }) => new Promise((_, reject) => config.abortSignal.addEventListener('abort', () => reject(new Error('cancelled')))), '{"answer":"fallback"}');
  assert.deepEqual(await generateJson(opts()), { answer: 'fallback' });
  assert.equal(calls.length, 2); assert.equal(calls[0].config.abortSignal.aborted, true);
});
test('deadline errors are explicit and include a request reference', async () => {
  await assert.rejects(generateText({ ...opts(), deadline: Date.now() - 1 }), AiTimeoutError);
  assert.equal((await aiErrorResponse(new AiTimeoutError('deadline'), 'ref-test').json()).code, 'timeout');
  const error = await aiErrorResponse(new AiOutputError('invalid'), 'ref-test').json(); assert.equal(error.code, 'invalid_output'); assert.equal(error.requestId, 'ref-test');
  assert.equal(aiErrorResponse(new ApiError(504), 'ref-test').status, 504);
});
test('pantry-only endpoint stays fresh when AI fails and requires authentication', async () => {
  const first = await (await getPantry()).json(); assert.equal(first.items.length, 1);
  globalThis.fetch = async () => Response.json({ items: [...pantryItems, { ...pantryItems[0], name: 'tomatoes' }] });
  const second = await (await getPantry()).json(); assert.notEqual(first.fingerprint, second.fingerprint);
  assert.equal(second.items.length, 2); assert.equal(calls.length, 0);
  globalThis.testUser = null; assert.equal((await getPantry()).status, 401);
});
test('generation failure does not prevent a separate pantry read', async () => {
  outcomes.push(new ApiError(503), new ApiError(503), new ApiError(503));
  const result = await generatePantry(new Request('https://app.test', { method: 'POST', body: JSON.stringify({ mode: 'pantry' }) }));
  assert.equal(result.status, 502); const error = await result.json(); assert.equal(error.code, 'unavailable'); assert.ok(error.requestId);
  assert.equal((await (await getPantry()).json()).ok, true);
});
test('new pantry ideas exclude cookbook recipes, return their snapshot and obey protein limits', async () => {
  outcomes.push(JSON.stringify({ recipes: [dish('Classic Lentil Soup'), dish(), dish('Another Stew')] }));
  const result = await generatePantry(new Request('https://app.test', { method: 'POST', body: JSON.stringify({ mode: 'protein', targets: { minProtein: 25, maxCalories: 500 } }) }));
  const data = await result.json(); assert.equal(result.status, 200); assert.equal(data.ok, true);
  assert.deepEqual(data.recipes.map(r => r.name), ['New Lentil Stew', 'Another Stew']); assert.ok(data.fingerprint); assert.ok(data.checkedAt);
  assert.match(calls[0].contents, /Already in the cookbook/);
});
test('recipe summaries and blocks both paginate', async () => {
  let requests = 0;
  globalThis.fetch = async () => Response.json(++requests === 1 ? { results: [page('First')], has_more: true, next_cursor: 'next' } : { results: [page('Second')], has_more: false });
  assert.equal((await getAllRecipes()).length, 2);
  let blocks = 0;
  globalThis.testNotionBlocks = async () => ++blocks === 1 ? { results: [block('paragraph', 'one')], has_more: true, next_cursor: 'next' } : { results: [block('paragraph', 'two')], has_more: false };
  assert.equal((await getRecipeBlocks('page')).length, 2);
});
test('cookbook index coalesces requests and caches extracted saved ingredients', async () => {
  let blocks = 0;
  globalThis.testNotionBlocks = async () => { blocks++; return { results: [block('heading_2', 'Ingredients'), block('bulleted_list_item', '1 cup lentils')], has_more: false }; };
  const [a, b] = await Promise.all([getCookbookIndex(), getCookbookIndex()]);
  assert.deepEqual(a, b); assert.deepEqual(a[0].ingredients, ['1 cup lentils']);
  await getCookbookIndex(); assert.equal(blocks, 1);
});

test('empty or disconnected pantry returns an actionable result without AI calls', async () => {
  globalThis.fetch = async (url) => Response.json(String(url).includes('pantry.test') ? { items: [] } : { results: [page()], has_more: false });
  const empty = await (await generatePantry(new Request('https://app.test', { method: 'POST', body: '{}' }))).json();
  assert.equal(empty.pantryError.reason, 'empty'); assert.equal(calls.length, 0);
  globalThis.fetch = async (url) => String(url).includes('pantry.test') ? new Response('', { status: 401 }) : Response.json({ results: [page()], has_more: false });
  const disconnected = await (await getPantry()).json();
  assert.equal(disconnected.ok, false); assert.equal(disconnected.reason, 'unreachable');
  assert.match(disconnected.message, /rejected the key/); assert.equal(calls.length, 0);
});

test('new suggestions remove duplicate names within the same generated batch', async () => {
  outcomes.push(JSON.stringify({ recipes: [dish(), dish('Classic New Lentil Stew')] }));
  const data = await (await generatePantry(new Request('https://app.test', { method: 'POST', body: '{}' }))).json();
  assert.equal(data.recipes.length, 1);
});
