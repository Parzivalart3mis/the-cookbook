import { Client } from '@notionhq/client';
import type { BlockObjectResponse, PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// Module-scoped singleton — one client per process (used for blocks)
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;
const NOTION_VERSION = '2022-06-28';

// notion.databases.query was removed in SDK v5; call the REST endpoint directly
async function queryDatabase(args: {
  database_id: string;
  sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>;
  start_cursor?: string;
}): Promise<{ results: PageObjectResponse[]; has_more: boolean; next_cursor: string | null }> {
  const { database_id, ...body } = args;
  const res = await fetch(`https://api.notion.com/v1/databases/${database_id}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify(body),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Notion API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface Nutrition {
  calories:            number | null;
  totalFat:            number | null;
  saturatedFat:        number | null;
  polyunsaturatedFat:  number | null;
  monounsaturatedFat:  number | null;
  transFat:            number | null;
  cholesterol:         number | null;
  sodium:              number | null;
  potassium:           number | null;
  totalCarbohydrates:  number | null;
  dietaryFiber:        number | null;
  sugars:              number | null;
  addedSugars:         number | null;
  sugarAlcohols:       number | null;
  protein:             number | null;
  vitaminA:            number | null; // stored as %DV directly
  vitaminC:            number | null;
  calcium:             number | null;
  iron:                number | null;
  vitaminD:            number | null;
}

export interface RecipeSummary {
  id: string;
  slug: string;
  name: string;
  createdAt: string;        // ISO date from page.created_time
  servings: number | null;
  prepTime: number | null;  // minutes
  cookTime: number | null;  // minutes
  source: string | null;
  tags: string[];
  nutrition: Nutrition;
}

export interface Recipe extends RecipeSummary {
  blocks: BlockObjectResponse[];
}

// Notion SDK v5 property values are a discriminated union; cast to access fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

function parseProps(props: Props): Pick<RecipeSummary, 'name' | 'servings' | 'prepTime' | 'cookTime' | 'source' | 'tags' | 'nutrition'> {
  // properties.Name.title can be empty array if page is untitled
  const titleArr: Array<{ plain_text: string }> = props.Name?.title ?? [];
  const name = titleArr.map((t) => t.plain_text).join('') || 'Untitled';

  const num = (key: string): number | null => (props[key]?.number as number | null) ?? null;

  return {
    name,
    servings:   (props.Servings?.number as number | null) ?? null,
    prepTime:   (props['Prep Time']?.number as number | null) ?? null,
    cookTime:   (props['Cook Time']?.number as number | null) ?? null,
    source:     (props.Source?.url as string | null) ?? null,
    tags:       ((props.Tags?.multi_select ?? []) as Array<{ name: string }>).map((t) => t.name),
    nutrition: {
      calories:           num('Calories'),
      totalFat:           num('Total Fat'),
      saturatedFat:       num('Saturated Fat'),
      polyunsaturatedFat: num('Polyunsaturated Fat'),
      monounsaturatedFat: num('Monounsaturated Fat'),
      transFat:           num('Trans Fat'),
      cholesterol:        num('Cholesterol'),
      sodium:             num('Sodium'),
      potassium:          num('Potassium'),
      totalCarbohydrates: num('Total Carbohydrates'),
      dietaryFiber:       num('Dietary Fiber'),
      sugars:             num('Sugars'),
      addedSugars:        num('Added Sugars'),
      sugarAlcohols:      num('Sugar Alcohols'),
      protein:            num('Protein'),
      vitaminA:           num('Vitamin A'),
      vitaminC:           num('Vitamin C'),
      calcium:            num('Calcium'),
      iron:               num('Iron'),
      vitaminD:           num('Vitamin D'),
    },
  };
}

export async function getAllRecipes(): Promise<RecipeSummary[]> {
  const response = await queryDatabase({
    database_id: DATABASE_ID,
    sorts: [{ property: 'Name', direction: 'ascending' }],
  });

  return response.results.map((page) => {
    const props = page.properties as Props;
    return {
      id: page.id,
      slug: slugify(
        ((props.Name?.title ?? []) as Array<{ plain_text: string }>)
          .map((t) => t.plain_text)
          .join('') || 'Untitled'
      ),
      createdAt: page.created_time,
      ...parseProps(props),
    };
  });
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | null> {
  const all = await getAllRecipes();
  const summary = all.find((r) => r.slug === slug);
  if (!summary) return null;

  // Paginate block children — Notion returns max 100 per request
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.blocks.children.list({
      block_id: summary.id,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    blocks.push(...(res.results as BlockObjectResponse[]));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return { ...summary, blocks };
}
