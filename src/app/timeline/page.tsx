import { getAllRecipes, type RecipeSummary } from '@/lib/notion';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import MarkCookedButton from '@/components/MarkCookedButton';
import RecentlyCookedSection from '@/components/RecentlyCookedSection';

export const revalidate = 60;

function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function TimelineCard({ recipe }: { recipe: RecipeSummary }) {
  const date = new Date(recipe.createdAt);
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0 gap-4">
      <div className="min-w-0">
        <Link
          href={`/recipes/${recipe.slug}`}
          className="font-medium text-ink hover:text-accent transition-colors duration-150 truncate block"
        >
          {recipe.name}
        </Link>
        <p className="text-xs text-ink-muted mt-0.5">
          Added {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {recipe.tags.length > 0 && <span className="text-ink-faint"> · {recipe.tags.slice(0, 2).join(', ')}</span>}
        </p>
      </div>
      <MarkCookedButton slug={recipe.slug} />
    </div>
  );
}

function Section({ title, recipes }: { title: string; recipes: RecipeSummary[] }) {
  if (recipes.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-3">{title}</h2>
      <div className="rounded-xl border border-border bg-surface-card px-4">
        {recipes.map(r => <TimelineCard key={r.id} recipe={r} />)}
      </div>
    </section>
  );
}

export default async function TimelinePage() {
  const recipes = await getAllRecipes().catch(() => [] as RecipeSummary[]);

  const thisMonth   = recipes.filter(r => daysAgo(r.createdAt) <= 30);
  const thisYear    = recipes.filter(r => daysAgo(r.createdAt) > 30 && daysAgo(r.createdAt) <= 365);
  const older       = recipes.filter(r => daysAgo(r.createdAt) > 365);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink mb-1">Timeline</h1>
        <p className="text-ink-muted">
          {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} in your cookbook
        </p>
      </div>

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <ChefHat size={48} className="text-accent/30" />
          <p className="font-display text-xl text-ink">No recipes yet</p>
        </div>
      ) : (
        <>
          <RecentlyCookedSection recipes={recipes} />
          <Section title="This Month" recipes={thisMonth} />
          <Section title="Earlier This Year" recipes={thisYear} />
          <Section title="Older" recipes={older} />
        </>
      )}
    </div>
  );
}
