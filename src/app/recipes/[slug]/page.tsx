import { notFound } from 'next/navigation';
import { getAllRecipes, getRecipeBySlug } from '@/lib/notion';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import RecipeMeta from '@/components/RecipeMeta';
import { MotionPage, MotionItem, BackLink } from '@/components/DetailMotion';
import NutritionModal from '@/components/NutritionModal';
import ReadingProgress from '@/components/ReadingProgress';
import RecipeBody from '@/components/RecipeBody';
import RecipeChat from '@/components/RecipeChat';

// Serialize Notion blocks to plain text for the AI context window
function blocksToPlainText(blocks: BlockObjectResponse[]): string {
  return blocks
    .map((block) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const richText: Array<{ plain_text: string }> = (block as any)[block.type]?.rich_text ?? [];
      return richText.map((r) => r.plain_text).join('');
    })
    .filter(Boolean)
    .join('\n');
}

export const revalidate = 60;

export async function generateStaticParams() {
  const recipes = await getAllRecipes();
  return recipes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) return {};
  return { title: `${recipe.name} — The Cookbook` };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);

  if (!recipe) notFound();

  const recipeContext = [
    `Recipe: ${recipe.name}`,
    recipe.servings   ? `Serves: ${recipe.servings}`                : '',
    recipe.prepTime   ? `Prep time: ${recipe.prepTime} minutes`     : '',
    recipe.cookTime   ? `Cook time: ${recipe.cookTime} minutes`     : '',
    recipe.tags.length ? `Tags: ${recipe.tags.join(', ')}`          : '',
    '',
    blocksToPlainText(recipe.blocks),
  ].filter(Boolean).join('\n');

  return (
    <MotionPage className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
      <ReadingProgress />
      <BackLink />

      <MotionItem>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink leading-tight mb-4">
          {recipe.name}
        </h1>
      </MotionItem>

      <MotionItem>
        <RecipeMeta
          servings={recipe.servings}
          prepTime={recipe.prepTime}
          cookTime={recipe.cookTime}
          source={recipe.source}
        >
          <NutritionModal nutrition={recipe.nutrition} servings={recipe.servings} />
        </RecipeMeta>
      </MotionItem>

      <MotionItem>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-tag-bg px-3 py-1 text-xs font-medium text-tag-text"
            >
              {tag}
            </span>
          ))}
          <RecipeChat recipeContext={recipeContext} />
        </div>
      </MotionItem>

      <MotionItem>
        <div className="my-8 border-t border-border" />
      </MotionItem>

      <MotionItem>
        <RecipeBody blocks={recipe.blocks} slug={recipe.slug} />
      </MotionItem>

    </MotionPage>
  );
}
