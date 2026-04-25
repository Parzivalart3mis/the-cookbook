import { Client, isFullPage } from '@notionhq/client';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// Module-scoped singleton — one client per process
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// The Notion SDK v5 renamed "databases" to "data sources";
// NOTION_DATABASE_ID still refers to the same Notion database ID
const DATA_SOURCE_ID = process.env.NOTION_DATABASE_ID!;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface RecipeSummary {
  id: string;
  slug: string;
  name: string;
  servings: number | null;
  source: string | null;
  tags: string[];
}

export interface Recipe extends RecipeSummary {
  blocks: BlockObjectResponse[];
}

// Notion SDK v5 property values are a discriminated union; cast to access fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

function parseProps(props: Props): Pick<RecipeSummary, 'name' | 'servings' | 'source' | 'tags'> {
  // properties.Name.title can be empty array if page is untitled
  const titleArr: Array<{ plain_text: string }> = props.Name?.title ?? [];
  const name = titleArr.map((t) => t.plain_text).join('') || 'Untitled';

  return {
    name,
    servings: (props.Servings?.number as number | null) ?? null,
    source: (props.Source?.url as string | null) ?? null,
    tags: ((props.Tags?.multi_select ?? []) as Array<{ name: string }>).map(
      (t) => t.name
    ),
  };
}

export async function getAllRecipes(): Promise<RecipeSummary[]> {
  // SDK v5: notion.dataSources.query replaces notion.databases.query
  // Returns empty array if the integration isn't connected yet (graceful build)
  let response;
  try {
    response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      sorts: [{ property: 'Name', direction: 'ascending' }],
    });
  } catch (err) {
    console.warn('[notion] getAllRecipes failed — is the integration connected?', err);
    return [];
  }

  return response.results.filter(isFullPage).map((page) => {
    const props = page.properties as Props;
    return {
      id: page.id,
      slug: slugify(
        ((props.Name?.title ?? []) as Array<{ plain_text: string }>)
          .map((t) => t.plain_text)
          .join('') || 'Untitled'
      ),
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
