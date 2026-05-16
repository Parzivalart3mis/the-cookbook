// Notion recipe structure auditor
// Run: node scripts/audit-recipes.mjs

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

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID  = process.env.NOTION_DATABASE_ID;
const NOTION_VERSION = '2022-06-28';

const INGREDIENT_KW  = ['ingredient', 'what you need', "you'll need", 'shopping list'];
const INSTRUCTION_KW = ['instruction', 'step', 'method', 'direction', 'how to', 'preparation', 'procedure'];

const EXPECTED_PROPS = [
  { name: 'Name',               type: 'title' },
  { name: 'Tags',               type: 'multi_select' },
  { name: 'Servings',           type: 'number' },
  { name: 'Prep Time',          type: 'number' },
  { name: 'Cook Time',          type: 'number' },
  { name: 'Source',             type: 'url' },
  { name: 'Calories',           type: 'number' },
  { name: 'Protein',            type: 'number' },
  { name: 'Sodium',             type: 'number' },
  { name: 'Total Fat',          type: 'number' },
  { name: 'Dietary Fiber',      type: 'number' },
  { name: 'Saturated Fat',      type: 'number' },
  { name: 'Total Carbohydrates',type: 'number' },
  { name: 'Cholesterol',        type: 'number' },
];

async function notionFetch(path, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getAllPages() {
  const pages = [];
  let cursor = undefined;
  do {
    const data = await notionFetch(`/databases/${DATABASE_ID}/query`, {
      sorts: [{ property: 'Name', direction: 'ascending' }],
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function getBlocks(pageId) {
  const blocks = [];
  let cursor = undefined;
  do {
    const data = await notionFetch(
      `/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    );
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function richText(block) {
  return (block[block.type]?.rich_text ?? []).map(r => r.plain_text).join('');
}

function isHeading(block) {
  return ['heading_1', 'heading_2', 'heading_3'].includes(block.type);
}

function isList(block) {
  return block.type === 'bulleted_list_item' || block.type === 'numbered_list_item';
}

function analyzeBlocks(blocks) {
  const issues = [];
  const info   = [];

  const headings = blocks.filter(isHeading).map(b => richText(b).toLowerCase());
  const hasIngredientHeading  = headings.some(h => INGREDIENT_KW.some(k => h.includes(k)));
  const hasInstructionHeading = headings.some(h => INSTRUCTION_KW.some(k => h.includes(k)));
  const bulletedItems  = blocks.filter(b => b.type === 'bulleted_list_item');
  const numberedItems  = blocks.filter(b => b.type === 'numbered_list_item');
  const anyList        = bulletedItems.length + numberedItems.length;
  const anyBlock       = blocks.length;

  // ── Content checks ──────────────────────────────────────────────────────────

  if (anyBlock === 0) {
    issues.push('EMPTY PAGE — no blocks at all. Recipe page is blank.');
    return { issues, info };
  }

  if (anyList === 0) {
    issues.push('NO LIST ITEMS — only paragraphs/headings. Shopping List will be empty. Cook Mode will show "No steps found". Checklist won\'t work.');
  }

  if (!hasIngredientHeading) {
    if (bulletedItems.length > 0) {
      info.push('No "Ingredients" heading — Shopping List will fall back to all bulleted items (may work if ingredients are bulleted).');
    } else if (numberedItems.length > 0) {
      issues.push('No "Ingredients" heading AND no bulleted items — Shopping List will be EMPTY (numbered items will not be collected without a heading).');
    }
  }

  if (!hasInstructionHeading) {
    if (numberedItems.length > 0) {
      info.push('No "Instructions/Steps" heading — Cook Mode will fall back to numbered items only (may work if steps are numbered).');
    } else if (bulletedItems.length > 0) {
      issues.push('No "Instructions/Steps" heading AND no numbered items — Cook Mode will be EMPTY (only bullets found, no headings to identify them as steps).');
    }
  }

  // ── Heading content checks ───────────────────────────────────────────────

  headings.forEach(h => {
    if (!INGREDIENT_KW.some(k => h.includes(k)) && !INSTRUCTION_KW.some(k => h.includes(k))) {
      // Only flag if it looks like it was intended as a section (not a recipe sub-note)
      const likelySectionWords = ['note', 'tip', 'serve', 'garnish', 'storage', 'variation', 'equipment'];
      if (!likelySectionWords.some(w => h.includes(w))) {
        info.push(`Heading "${richText}" ("${h}") doesn't match any known keyword — its list items may be ignored by Shopping List / Cook Mode.`);
      }
    }
  });

  // Report what WAS found (for context)
  info.push(`Blocks: ${anyBlock} total — ${bulletedItems.length} bulleted, ${numberedItems.length} numbered, ${headings.length} heading(s): [${headings.map(h => `"${h}"`).join(', ') || 'none'}]`);

  return { issues, info };
}

function getName(page) {
  const title = page.properties?.Name?.title ?? [];
  return title.map(t => t.plain_text).join('') || 'Untitled';
}

function checkProperties(page) {
  const props = page.properties ?? {};
  const issues = [];
  for (const { name, type } of EXPECTED_PROPS) {
    if (!props[name]) {
      issues.push(`Missing property "${name}" (expected type: ${type})`);
    } else if (props[name].type !== type) {
      issues.push(`Property "${name}" is type "${props[name].type}", expected "${type}"`);
    }
  }
  return issues;
}

async function main() {
  console.log('Fetching all recipes from Notion...\n');
  const pages = await getAllPages();
  console.log(`Found ${pages.length} recipes. Auditing blocks...\n`);

  const results = [];

  for (const page of pages) {
    const name = getName(page);
    process.stdout.write(`  Checking: ${name}...`);

    const propIssues = checkProperties(page);
    const blocks = await getBlocks(page.id);
    const { issues, info } = analyzeBlocks(blocks);

    results.push({ name, propIssues, issues, info });
    process.stdout.write(' done\n');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('AUDIT REPORT');
  console.log('═'.repeat(70) + '\n');

  const broken  = results.filter(r => r.issues.length > 0 || r.propIssues.length > 0);
  const warning = results.filter(r => r.issues.length === 0 && r.propIssues.length === 0 && r.info.some(i => i.startsWith('No ')));
  const clean   = results.filter(r => r.issues.length === 0 && r.propIssues.length === 0 && !r.info.some(i => i.startsWith('No ')));

  if (broken.length > 0) {
    console.log(`❌  BROKEN (${broken.length} recipes — features will not work correctly)\n`);
    for (const r of broken) {
      console.log(`  ▸ ${r.name}`);
      for (const i of r.propIssues) console.log(`      [PROPERTY] ${i}`);
      for (const i of r.issues)    console.log(`      [CONTENT]  ${i}`);
      console.log();
    }
  }

  if (warning.length > 0) {
    console.log(`⚠️   WARNING (${warning.length} recipes — may work but structure is not ideal)\n`);
    for (const r of warning) {
      console.log(`  ▸ ${r.name}`);
      for (const i of r.info.filter(i => i.startsWith('No '))) console.log(`      ${i}`);
      console.log();
    }
  }

  console.log(`✅  CLEAN (${clean.length} recipes — structure looks good)\n`);
  for (const r of clean) {
    console.log(`  ▸ ${r.name}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`SUMMARY: ${broken.length} broken  |  ${warning.length} warnings  |  ${clean.length} clean  |  ${pages.length} total`);
  console.log('═'.repeat(70));

  console.log('\n📋  IDEAL STRUCTURE FOR EVERY RECIPE:\n');
  console.log('  Notion Page Properties:');
  console.log('    Name (title), Tags (multi-select), Servings (number),');
  console.log('    Prep Time (number, minutes), Cook Time (number, minutes), Source (url)');
  console.log('    + nutrition number fields if needed\n');
  console.log('  Page Content:');
  console.log('    ## Ingredients          ← heading must contain "ingredient"');
  console.log('    - 200g flour');
  console.log('    - 2 eggs\n');
  console.log('    ## Instructions         ← heading must contain "instruction", "step", "method", etc.');
  console.log('    1. Mix flour and eggs');
  console.log('    2. Bake for 30 minutes\n');
}

main().catch(err => { console.error(err); process.exit(1); });
