import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllRecipes, getRecipeBySlug } from '@/lib/notion';
import RecipeBody from '@/components/RecipeBody';
import RecipeMeta from '@/components/RecipeMeta';
import { ArrowLeft } from 'lucide-react';

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
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent transition-colors duration-150 mb-10"
      >
        <ArrowLeft size={14} />
        All recipes
      </Link>

      {/* Heading */}
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink leading-tight mb-4">
        {recipe.name}
      </h1>

      {/* Meta line */}
      <RecipeMeta servings={recipe.servings} source={recipe.source} />

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-tag-bg px-3 py-1 text-xs font-medium text-tag-text"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="my-8 border-t border-border" />

      {/* Body */}
      <RecipeBody blocks={recipe.blocks} />
    </div>
  );
}
