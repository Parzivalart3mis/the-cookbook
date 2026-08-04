'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Clock, BookmarkPlus, BookmarkCheck, ChefHat } from 'lucide-react';
import type { RecipeSummary } from '@/lib/notion';
import { useQueue } from './QueueProvider';
import { useAuth } from '@clerk/nextjs';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Cap the stagger. Uncapped `index * 0.055` meant the 46th card waited 2.5s
 * before appearing — and re-waited on every filter change.
 */
const STAGGER_STEP = 0.04;
const STAGGER_MAX_INDEX = 6;

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function RecipeCard({
  recipe,
  index = 0,
}: {
  recipe: RecipeSummary;
  index?: number;
}) {
  const totalTime =
    recipe.prepTime !== null && recipe.cookTime !== null
      ? recipe.prepTime + recipe.cookTime
      : recipe.prepTime ?? recipe.cookTime ?? null;

  const { isSignedIn } = useAuth();
  const { addToQueue, removeFromQueue, isInQueue } = useQueue();
  const inQueue = isInQueue(recipe.slug);
  const reduced = useReducedMotion();

  function handleQueue(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inQueue) {
      removeFromQueue(recipe.slug);
    } else {
      addToQueue({
        slug: recipe.slug,
        name: recipe.name,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
      });
    }
  }

  return (
    <motion.div
      layout
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.94, transition: { duration: 0.15, ease: 'easeIn' } }}
      transition={{
        duration: 0.4,
        delay: reduced ? 0 : Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP,
        ease,
      }}
    >
      {/*
        Stretched-link pattern: the title anchor's ::after covers the whole
        card, so the card is clickable while tags and the queue button stay
        independently focusable. Wrapping everything in one <Link> would nest
        anchors, which is invalid HTML and unusable with a screen reader.
      */}
      <motion.article
        whileHover={reduced ? undefined : { y: -6, scale: 1.018 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="group relative h-full overflow-hidden rounded-xl border border-border bg-surface-card shadow-card transition-[border-color,box-shadow] duration-200 focus-within:border-accent/40 hover:border-accent/30 hover:shadow-card-hover"
      >
        {/* Cover — fixed aspect box prevents the layout shift raw <img> caused */}
        <div className="relative h-36 w-full overflow-hidden bg-accent-light">
          {recipe.coverImage ? (
            <Image
              src={recipe.coverImage}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
              <ChefHat size={26} className="text-accent/25" />
            </div>
          )}
        </div>

        <div className="p-5">
          <h3 className="mb-3 pr-6 font-display text-lg font-semibold leading-snug text-ink transition-colors duration-150 group-hover:text-accent">
            <Link
              href={`/recipes/${recipe.slug}`}
              className="rounded outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline focus-visible:decoration-accent focus-visible:decoration-2 focus-visible:underline-offset-4"
            >
              {recipe.name}
            </Link>
          </h3>

          {recipe.mealTypes.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {recipe.mealTypes.map((mt) => (
                <span
                  key={mt}
                  className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                >
                  {mt}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {recipe.servings !== null && (
                <span className="text-xs tabular-nums text-ink-muted">
                  {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
                </span>
              )}
              {totalTime !== null && (
                <span className="flex items-center gap-1 text-xs tabular-nums text-ink-muted">
                  <Clock size={11} className="text-accent" aria-hidden="true" />
                  {formatTime(totalTime)}
                </span>
              )}
            </div>

            {recipe.tags.length > 0 && (
              <div className="ml-auto flex flex-wrap gap-1.5">
                {recipe.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/recipes?tag=${encodeURIComponent(tag)}`}
                    className="relative z-10 inline-block rounded-full bg-tag-bg px-2.5 py-0.5 text-xs font-medium text-tag-text transition-colors duration-150 hover:bg-accent hover:text-white"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {isSignedIn && (
          <button
            onClick={handleQueue}
            aria-label={
              inQueue ? `Remove ${recipe.name} from this week` : `Add ${recipe.name} to this week`
            }
            aria-pressed={inQueue}
            title={inQueue ? 'Remove from queue' : 'Add to this week'}
            className={`absolute right-2 top-2 z-10 rounded-lg border p-1.5 transition-colors duration-150 ${
              inQueue
                ? 'border-accent/50 bg-accent-light text-accent'
                : 'border-border bg-surface-card text-ink-faint hover:border-accent/30 hover:text-accent'
            }`}
          >
            {inQueue ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />}
          </button>
        )}
      </motion.article>
    </motion.div>
  );
}
