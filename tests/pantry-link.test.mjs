import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
process.env.COOKBOOK_TEST_MOCKS = '1';
const { getPantry } = await import('../src/lib/tote-server.ts');
const { verifyPantryIdentity } = await import('../src/lib/pantry-identity.ts');
const { GET } = await import('../src/app/api/pantry/route.ts');
const { pantryFingerprint } = await import('../src/lib/pantry-matching.ts');
let calls;
const items = [{ name: 'Lentils', category: 'Food', quantity: '1', unit: 'kg', status: 'IN_STOCK' }];
const account = (id, email, verified = true) => ({ id, primaryEmailAddressId: 'primary', emailAddresses: [{ id: 'other', emailAddress: 'secondary@example.com', verification: { status: 'verified' } }, { id: 'primary', emailAddress: email, verification: { status: verified ? 'verified' : 'unverified' } }] });
beforeEach(() => {
  process.env.TOTE_API_URL = 'https://pantry.test'; process.env.TOTE_API_KEY = 'shared-test-secret';
  globalThis.testUser = 'person-a'; globalThis.testClerkUser = undefined; calls = [];
  globalThis.fetch = async (url, options) => {
    const identity = verifyPantryIdentity(options.headers.Authorization, process.env.TOTE_API_KEY);
    assert.ok(identity, 'Cookbook assertions must be accepted by the shared pantry protocol');
    calls.push({ url, options, identity });
    return Response.json({ protocolVersion: 2, connectionId: 'a'.repeat(64), items });
  };
});
test('links by verified primary email without putting the email or server key in the URL', async () => {
  globalThis.testClerkUser = account('person-a', ' Person.Name+pantry@Example.com ');
  const result = await getPantry('person-a'); assert.equal(result.ok, true);
  assert.equal(calls[0].identity.email, 'person.name+pantry@example.com');
  assert.equal(calls[0].identity.subject, 'person-a');
  assert.equal(calls[0].options.method, 'POST'); assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].url, 'https://pantry.test/api/integrations/pantry');
  assert.ok(!calls[0].options.headers.Authorization.includes(process.env.TOTE_API_KEY));
});
test('unverified primary email or another Clerk user never triggers pantry access', async () => {
  globalThis.testClerkUser = account('person-a', 'person@example.com', false);
  assert.equal((await getPantry('person-a')).reason, 'verify-email');
  globalThis.testClerkUser = account('someone-else', 'person@example.com');
  assert.equal((await getPantry('person-a')).reason, 'verify-email'); assert.equal(calls.length, 0);
});
test('two signed-in users request different identities; owner configuration is irrelevant', async () => {
  delete process.env.COOKBOOK_OWNER_USER_ID;
  assert.equal((await getPantry('person-a')).ok, true);
  assert.equal((await getPantry('person-b')).ok, true);
  assert.notEqual(calls[0].identity.email, calls[1].identity.email);
  assert.notEqual(calls[0].identity.subject, calls[1].identity.subject);
});
test('pantry route cannot accept a browser-supplied email or account ID', async () => {
  const response = await GET(new Request('https://app.test/api/pantry?email=someone-else@example.com&userId=other'));
  assert.equal(response.status, 200); assert.equal(calls[0].identity.email, 'person-a@example.com');
  globalThis.testUser = null; assert.equal((await GET()).status, 401);
});
test('account lookup is repeated so revoked verification cannot reuse an old link', async () => {
  globalThis.testClerkUser = account('person-a', 'person@example.com');
  assert.equal((await getPantry('person-a')).ok, true);
  globalThis.testClerkUser = account('person-a', 'person@example.com', false);
  assert.equal((await getPantry('person-a')).reason, 'verify-email'); assert.equal(calls.length, 1);
});
test('missing, unverified and ambiguous tote accounts have actionable errors', async () => {
  for (const [status, reason] of [[404, 'not-linked'], [403, 'verify-email'], [409, 'ambiguous-account'], [405, 'service-upgrade']]) {
    globalThis.fetch = async () => new Response('', { status });
    assert.equal((await getPantry('person-a')).reason, reason);
  }
});
test('old owner-only responses never pass as a linked pantry', async () => {
  globalThis.fetch = async () => Response.json({ items });
  assert.equal((await getPantry('person-a')).reason, 'service-upgrade');
  globalThis.fetch = async () => Response.json({ protocolVersion: 2, connectionId: 'invalid', items });
  assert.equal((await getPantry('person-a')).reason, 'service-upgrade');
});
test('cache fingerprints distinguish accounts even when the food is identical', () => {
  assert.notEqual(pantryFingerprint(items, 'a'.repeat(64)), pantryFingerprint(items, 'b'.repeat(64)));
});


test('Cookbook signatures match the versioned contract fixture also tested by tote', async () => {
  const { readFileSync } = await import('node:fs');
  const { signPantryIdentity } = await import('../src/lib/pantry-identity.ts');
  const vector = JSON.parse(readFileSync(new URL('./fixtures/pantry-identity-v2.json', import.meta.url), 'utf8'));
  assert.equal(signPantryIdentity(vector.subject, vector.email, vector.secret, vector.now), vector.token);
  assert.equal(verifyPantryIdentity(`Bearer ${vector.token}`, vector.secret, vector.now).subject, vector.subject);
});
