// Smoke-test the Gemini setup the app uses.
//
//   GEMINI_API_KEY=... node scripts/test-gemini.mjs        (or put the key in .env.local)
//
// 1. Lists the models your key can call and checks the app's fallback chains.
// 2. Runs a structured-output (JSON schema) pantry-recipe prompt on each
//    candidate model and reports latency + whether the output is valid.
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('✗ GEMINI_API_KEY is not set (env or .env.local).');
  process.exit(1);
}

// Keep in sync with DEFAULT_CHAIN in src/lib/gemini.ts.
const FULL = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'].filter(Boolean);
const LITE = [process.env.GEMINI_MODEL_LITE, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'].filter(Boolean);
const candidates = [...new Set([...FULL, ...LITE])];

const ai = new GoogleGenAI({ apiKey });

console.log('Models available to this key:');
const available = new Set();
try {
  for await (const m of await ai.models.list({ config: { pageSize: 200 } })) {
    const id = m.name?.replace(/^models\//, '');
    if (id && (m.supportedActions ?? []).includes('generateContent') && /^gemini/.test(id)) available.add(id);
  }
  console.log('  ' + [...available].sort().join('\n  '));
} catch (e) {
  console.error('✗ Could not list models:', e.message ?? e);
  process.exit(1);
}

const schema = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array', minItems: 1, maxItems: 2,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          usesFromPantry: { type: 'array', items: { type: 'string' } },
          nutrition: {
            type: 'object',
            properties: { calories: { type: 'integer' }, protein: { type: 'integer' } },
            required: ['calories', 'protein'],
          },
        },
        required: ['name', 'usesFromPantry', 'nutrition'],
      },
    },
  },
  required: ['recipes'],
};

console.log('\nStructured-output test (2 high-protein dishes from a sample pantry):');
let anyOk = { full: false, lite: false };
for (const model of candidates) {
  const tier = FULL.includes(model) ? 'full' : 'lite';
  if (!available.has(model) && !model.endsWith('-latest')) {
    console.log(`  – ${model.padEnd(28)} not available to this key`);
    continue;
  }
  const t0 = Date.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents: 'Pantry: eggs, Greek yogurt, spinach, canned tuna, oats, lentils. Suggest 2 dishes with ≥25 g protein and ≤500 kcal per serving.',
      config: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.6 },
    });
    const data = JSON.parse(res.text ?? '');
    const r = data.recipes?.[0];
    if (!r?.name) throw new Error('JSON did not match the schema');
    anyOk[tier] = true;
    console.log(`  ✓ ${model.padEnd(28)} ${String(Date.now() - t0).padStart(6)} ms  e.g. "${r.name}" ${r.nutrition.protein} g / ${r.nutrition.calories} kcal`);
  } catch (e) {
    console.log(`  ✗ ${model.padEnd(28)} ${String(Date.now() - t0).padStart(6)} ms  ${e.status ?? ''} ${String(e.message ?? e).slice(0, 140)}`);
  }
}

console.log(`\nFull tier (ideas, pantry, meal plan): ${anyOk.full ? 'OK' : 'NO WORKING MODEL'}`);
console.log(`Lite tier (voice, substitutes):       ${anyOk.lite ? 'OK' : 'NO WORKING MODEL'}`);
process.exit(anyOk.full && anyOk.lite ? 0 : 1);
