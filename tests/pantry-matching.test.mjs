import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingredientName, pantryFingerprint, matchCookbook, dishKey } from '../src/lib/pantry-matching.ts';
import { cookableItems } from '../src/lib/tote.ts';
import { suggestionsMatch } from '../src/lib/kitchen-cache.ts';

const item = (name, overrides = {}) => ({ name, quantity: '1', unit: 'bag', category: 'Food', status: 'IN_STOCK', ...overrides });
const recipe = (overrides = {}) => ({ id: 'one', slug: 'lentil-dinner', name: 'Lentil Dinner', tags: ['Indian'], mealTypes: ['Dinner'], ingredients: ['1 cup lentils', '2 tomatoes', '1 tsp salt'], prepTime: 5, cookTime: 10, nutrition: { protein: 30, calories: 400 }, ...overrides });
const options = { cuisine: '', diet: 'vegetarian', refine: '', protein: false, targets: { minProtein: 25, maxCalories: 500 } };

test('pantry changes include additions, removal, quantity, unit and stock status, but not order', () => {
  const base = [item('lentils'), item('tomatoes')];
  assert.equal(pantryFingerprint(base), pantryFingerprint([...base].reverse()));
  for (const changed of [[...base, item('rice')], base.slice(1), [item('lentils', { quantity: '2' }), base[1]], [item('lentils', { unit: 'kg' }), base[1]], [item('lentils', { status: 'LOW' }), base[1]]]) assert.notEqual(pantryFingerprint(base), pantryFingerprint(changed));
});
test('pantry excludes out of stock and non-food', () => {
  assert.deepEqual(cookableItems([item('rice'), item('soap', { category: 'Household' }), item('eggs', { status: 'OUT_OF_STOCK' })]).map(i => i.name), ['rice']);
});
test('ingredient amounts and notes do not prevent matching; compound identity is preserved', () => {
  assert.equal(ingredientName('½ tbsp jeera (cumin seeds)'), 'jeera');
  assert.equal(ingredientName('4 cloves garlic, chopped'), 'garlic');
  assert.equal(ingredientName('3 potatoes — boiled, peeled'), 'potatoes');
  assert.equal(ingredientName('Paneer – 200g'), 'Paneer');
  const { matches } = matchCookbook([recipe({ ingredients: ['1 cup lentils', '1 tsp garlic powder'] })], [item('lentils'), item('garlic')], options);
  assert.deepEqual(matches[0].missing, ['1 tsp garlic powder']);
});
test('cookbook ranks full coverage first, preserves saved recipe and flags running low', () => {
  const full = recipe(); const partial = recipe({ id: 'two', ingredients: ['lentils', 'potatoes'] });
  const { matches } = matchCookbook([partial, full], [item('lentils', { status: 'LOW' }), item('tomatoes')], options);
  assert.equal(matches[0].id, 'one'); assert.equal(matches[0].coverage, 1);
  assert.deepEqual(matches[0].low, ['lentils']); assert.equal(matches[0].slug, full.slug);
  assert.deepEqual(matches[1].missing, ['potatoes']);
});
test('diet, meal and cuisine filters exclude incompatible saved recipes', () => {
  const recipes = [recipe(), recipe({ name: 'Chicken curry', ingredients: ['lentils', 'chicken'] }), recipe({ id: 'dessert', mealTypes: ['Dessert'] })];
  const result = matchCookbook(recipes, [item('lentils')], { ...options, refine: 'Dinner under 20 minutes', cuisine: 'Indian' });
  assert.deepEqual(result.matches.map(r => r.id), ['one']);
  assert.equal(matchCookbook(recipes, [item('lentils')], { ...options, cuisine: 'Italian' }).matches.length, 0);
});
test('missing ingredients/nutrition and no pantry overlap never imply a match', () => {
  const result = matchCookbook([recipe(), recipe({ ingredients: [], id: 'empty' }), recipe({ nutrition: { protein: null, calories: 400 }, id: 'unknown' }), recipe({ nutrition: { protein: 5, calories: 400 }, id: 'low' })], [item('lentils')], { ...options, protein: true });
  assert.deepEqual(result.matches.map(r => r.id), ['one']); assert.equal(result.missingNutrition, 1); assert.equal(result.missingIngredients, 1);
  assert.equal(matchCookbook([recipe()], [item('rice')], options).matches.length, 0);
});
test('new-dish comparison normalizes trivial name variants', () => assert.equal(dishKey('Classic Sooji Halwa'), dishKey('Sooji Halwa')));
test('cache checks every input, pantry changes, expiry and legacy records', () => {
  const now = Date.now();
  const current = { tab: 'protein', cuisine: '', diet: 'vegetarian', refine: 'Dinner', targets: options.targets, fingerprint: 'pantry-one' };
  const cached = { ...current, at: now };
  assert.equal(suggestionsMatch(cached, current, now), true);
  for (const update of [{ refine: 'Lunch' }, { cuisine: 'Indian' }, { diet: 'eggetarian' }, { targets: { minProtein: 40, maxCalories: 500 } }, { fingerprint: 'pantry-two' }, { fingerprint: undefined }]) assert.equal(suggestionsMatch(cached, { ...current, ...update }, now), false);
  assert.equal(suggestionsMatch(cached, current, now + 86_400_000), false);
  assert.equal(suggestionsMatch({ at: now, cuisine: '', diet: 'vegetarian' }, current, now), false);
  assert.equal(suggestionsMatch({ ...cached, fingerprint: undefined }, { ...current, tab: 'discover' }, now), true);
});
