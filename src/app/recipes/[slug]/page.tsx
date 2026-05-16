import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllRecipes, getRecipeBySlug } from '@/lib/notion';
import RecipeMeta from '@/components/RecipeMeta';
import { MotionPage, MotionItem, BackLink } from '@/components/DetailMotion';
import NutritionModal from '@/components/NutritionModal';
import ReadingProgress from '@/components/ReadingProgress';
import RecipeBody from '@/components/RecipeBody';
import RecipeActions from '@/components/RecipeActions';
import RecipeNotes from '@/components/RecipeNotes';
import RecipeImageManager from '@/components/RecipeImageManager';

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
  return {
    title: `${recipe.name} — The Cookbook`,
    ...(recipe.coverImage ? { openGraph: { images: [recipe.coverImage] } } : {}),
  };
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

      {/* Hero image */}
      {recipe.coverImage && (
        <MotionItem>
          <div className="mb-6 -mt-2 rounded-2xl overflow-hidden aspect-video w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.coverImage}
              alt={recipe.name}
              className="w-full h-full object-cover"
            />
          </div>
        </MotionItem>
      )}

      <MotionItem>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink leading-tight mb-2">
          {recipe.name}
        </h1>
        <RecipeImageManager
          pageId={recipe.id}
          recipeName={recipe.name}
          hasImage={!!recipe.coverImage}
        />
      </MotionItem>

      <MotionItem>
        <div className="mt-4">
          <RecipeMeta
            servings={recipe.servings}
            prepTime={recipe.prepTime}
            cookTime={recipe.cookTime}
            source={recipe.source}
          >
            <NutritionModal nutrition={recipe.nutrition} servings={recipe.servings} />
          </RecipeMeta>
        </div>
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
        <RecipeActions
          blocks={recipe.blocks}
          slug={recipe.slug}
          name={recipe.name}
          prepTime={recipe.prepTime}
          cookTime={recipe.cookTime}
        />
      </MotionItem>

      <MotionItem>
        <div className="my-8 border-t border-border" />
      </MotionItem>

      <MotionItem>
        <RecipeBody blocks={recipe.blocks} slug={recipe.slug} />
      </MotionItem>

      <MotionItem>
        <RecipeNotes slug={recipe.slug} />
      </MotionItem>
    </MotionPage>
  );
}
