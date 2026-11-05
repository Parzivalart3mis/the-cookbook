'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { CookbookMatch } from '@/lib/pantry-matching';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle, BookmarkCheck, BookmarkPlus, ChefHat, ChevronDown, Clock, Flame, PlayCircle, ShoppingBasket, Users, Zap,
} from 'lucide-react';
import type { PantryRecipe, RecipeIdea } from '@/lib/kitchen-ai';
import type { YouTubeVideo } from '@/lib/youtube';

const ease = [0.22, 1, 0.36, 1] as const;

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export function formatViews(n: number): string {
  return `${compact.format(n)} views`;
}

function formatDuration(s: number | null): string | null {
  if (s === null || s <= 0) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'accent' | 'warn' | 'muted' }) {
  const tones = {
    default: 'bg-surface-hover text-ink-muted',
    accent: 'bg-tag-bg text-tag-text',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    muted: 'border border-dashed border-border text-ink-muted',
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function CardShell({ index, children }: { index: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease, delay: Math.min(index, 6) * 0.04 }}
      className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface-card shadow-card"
    >
      {children}
    </motion.article>
  );
}

export function SaveIdeaButton({ saved, onSave }: { saved: boolean; onSave: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={saved || busy}
      onClick={async () => {
        setBusy(true);
        try { await onSave(); } finally { setBusy(false); }
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        saved ? 'bg-accent-light text-accent' : 'bg-accent text-white hover:bg-accent-hover disabled:opacity-60'
      }`}
    >
      {saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
      {saved ? 'In Future Recipes' : busy ? 'Saving…' : 'Save idea'}
    </button>
  );
}

export function VideoCard({ video, compactLayout = false }: { video: YouTubeVideo; compactLayout?: boolean }) {
  const duration = formatDuration(video.durationSeconds);
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex gap-3 rounded-lg transition-colors hover:bg-surface-hover ${compactLayout ? 'items-center p-1.5' : 'flex-col p-2'}`}
    >
      <div className={`relative shrink-0 overflow-hidden rounded-md bg-surface-hover ${compactLayout ? 'aspect-video w-28' : 'aspect-video w-full'}`}>
        <Image
          src={video.thumbnail}
          alt=""
          fill
          sizes={compactLayout ? '112px' : '(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw'}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[10px] font-medium text-white">{duration}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-accent">{video.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {video.channel}{video.views ? ` · ${formatViews(video.views)}` : ''}
        </p>
      </div>
    </a>
  );
}

export function IdeaCard({ idea, index, saved, onSave }: { idea: RecipeIdea; index: number; saved: boolean; onSave: () => Promise<void> }) {
  return (
    <CardShell index={index}>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Chip tone="accent">{idea.cuisine}</Chip>
          <Chip><Clock size={11} />{formatMinutes(idea.timeMinutes)}</Chip>
          <Chip><ChefHat size={11} />{idea.difficulty}</Chip>
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug text-ink">{idea.name}</h3>
        <p className="mt-1 text-sm text-ink-muted">{idea.description}</p>
        <p className="mt-2 flex gap-1.5 text-xs text-ink-muted">
          <Flame size={13} className="mt-px shrink-0 text-accent" />
          <span>{idea.whyPopular}</span>
        </p>

        <div className="mt-4 space-y-1">
          {idea.videos.length > 0 ? (
            idea.videos.map(v => <VideoCard key={v.id} video={v} compactLayout />)
          ) : (
            <a
              href={idea.searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
            >
              <PlayCircle size={15} /> Find videos on YouTube
            </a>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          {idea.videos.length > 0 ? (
            <a href={idea.searchUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-muted hover:text-ink">
              More on YouTube →
            </a>
          ) : <span />}
          <SaveIdeaButton saved={saved} onSave={onSave} />
        </div>
      </div>
    </CardShell>
  );
}

export function PantryRecipeCard({
  recipe, index, saved, onSave, highlightMacros = false,
}: {
  recipe: PantryRecipe;
  index: number;
  saved: boolean;
  onSave: () => Promise<void>;
  highlightMacros?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const low = new Set(recipe.lowStockUsed);
  const n = recipe.nutrition;

  return (
    <CardShell index={index}>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Chip><Clock size={11} />{formatMinutes(recipe.timeMinutes)}</Chip>
          <Chip><Users size={11} />{recipe.servings} serving{recipe.servings === 1 ? '' : 's'}</Chip>
          <Chip><ChefHat size={11} />{recipe.difficulty}</Chip>
          {recipe.missing.length === 0 && <Chip tone="accent">No missing ingredients listed</Chip>}
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug text-ink">{recipe.name}</h3>
        <p className="mt-1 text-sm text-ink-muted">{recipe.description}</p>

        {/* Macros, per serving */}
        <div className={`mt-3 grid grid-cols-4 gap-1 rounded-lg p-2 text-center ${highlightMacros ? 'bg-accent-light' : 'bg-surface-hover/60'}`}>
          <Macro label="Protein" value={`${n.protein}g`} strong={highlightMacros} />
          <Macro label="Calories" value={`${n.calories}`} strong={highlightMacros} />
          <Macro label="Carbs" value={`${n.carbs}g`} />
          <Macro label="Fat" value={`${n.fat}g`} />
        </div>
        {highlightMacros && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
            <Zap size={12} className="text-accent" />
            {recipe.proteinPer100kcal} g protein per 100 kcal · AI estimate per serving
          </p>
        )}

        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-faint">From your pantry</p>
          <div className="flex flex-wrap gap-1.5">
            {recipe.usesFromPantry.map(name => (
              <Chip key={name} tone={low.has(name) ? 'warn' : 'default'}>
                {low.has(name) && <AlertTriangle size={11} />}
                {name}{low.has(name) ? ' · low' : ''}
              </Chip>
            ))}
          </div>
        </div>

        {recipe.missing.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-faint">You&apos;d still need</p>
            <div className="flex flex-wrap gap-1.5">
              {recipe.missing.map(m => (
                <Chip key={m} tone="muted"><ShoppingBasket size={11} />{m}</Chip>
              ))}
            </div>
          </div>
        )}

        {recipe.steps.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              className="flex items-center gap-1 text-sm font-medium text-ink hover:text-accent"
            >
              <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              {open ? 'Hide steps' : `Show ${recipe.steps.length} steps`}
            </button>
            {open && (
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-muted marker:text-ink-faint">
                {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <a
            href={recipe.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-accent"
          >
            <PlayCircle size={14} /> Watch on YouTube
          </a>
          <SaveIdeaButton saved={saved} onSave={onSave} />
        </div>
      </div>
    </CardShell>
  );
}

function Macro({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className={`text-sm font-semibold ${strong ? 'text-accent' : 'text-ink'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
    </div>
  );
}


export function CookbookRecipeCard({ recipe, index, cuisineUnverified = false }: { recipe: CookbookMatch; index: number; cuisineUnverified?: boolean }) {
  return (
    <CardShell index={index}>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="accent">{Math.round(recipe.coverage * 100)}% ingredient match</Chip>
          {cuisineUnverified && <Chip tone="muted">Cuisine not tagged</Chip>}
          {recipe.prepTime !== null && recipe.cookTime !== null && <Chip><Clock size={11} />{formatMinutes(recipe.prepTime + recipe.cookTime)}</Chip>}
        </div>
        <h3 className="font-display text-lg font-semibold text-ink">{recipe.name}</h3>
        {(recipe.nutrition.protein !== null || recipe.nutrition.calories !== null) && (
          <p className="text-sm text-ink-muted">
            {recipe.nutrition.protein !== null && `${recipe.nutrition.protein} g protein`}
            {recipe.nutrition.protein !== null && recipe.nutrition.calories !== null && ' · '}
            {recipe.nutrition.calories !== null && `${recipe.nutrition.calories} kcal`}
            <span className="block text-xs text-ink-faint">Per serving · saved recipe nutrition</span>
          </p>
        )}
        <div>
          <p className="mb-1 text-xs font-semibold text-ink-muted">In your pantry</p>
          <div className="flex flex-wrap gap-1.5">{recipe.available.map(name => <Chip key={name} tone={recipe.low.includes(name) ? 'warn' : 'default'}>{name}{recipe.low.includes(name) ? ' · running low' : ''}</Chip>)}</div>
        </div>
        {recipe.missing.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-muted">Still needed ({recipe.missing.length})</p>
            <div className="flex flex-wrap gap-1.5">{recipe.missing.map((name, i) => <Chip key={`${name}-${i}`} tone="muted">{name}</Chip>)}</div>
          </div>
        ) : <p className="text-sm text-accent">All non-staple ingredients matched.</p>}
        <p className="text-xs text-ink-faint">Check quantities in the saved recipe before cooking.</p>
        <Link href={`/recipes/${recipe.slug}`} className="mt-auto pt-2 text-sm font-semibold text-accent hover:text-accent-hover">Open recipe →</Link>
      </div>
    </CardShell>
  );
}
