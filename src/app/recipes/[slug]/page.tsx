import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllRecipes, getRecipeBySlug } from '@/lib/notion';
import RecipeMeta from '@/components/RecipeMeta';
import { MotionPage, MotionItem, BackLink } from '@/components/DetailMotion';
import NutritionModal from '@/components/NutritionModal';
import ReadingProgress from '@/components/ReadingProgress';
import RecipeBody from '@/components/RecipeBody';

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

      {recipe.tags.length > 0 && (
        <MotionItem>
          <div className="flex flex-wrap gap-2 mt-3">
            {recipe.tags.map((tag) => (
              <Link
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="inline-block rounded-full bg-tag-bg px-3 py-1 text-xs font-medium text-tag-text hover:bg-accent hover:text-white transition-colors duration-150"
              >
                {tag}
              </Link>
            ))}
          </div>
        </MotionItem>
      )}

      <MotionItem>
        <div className="my-8 border-t border-border" />
      </MotionItem>

      <MotionItem>
        <RecipeBody blocks={recipe.blocks} slug={recipe.slug} />
      </MotionItem>

    </MotionPage>
  );
}
