'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Dumbbell, Flame, Loader2, Refrigerator, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { IdeaCard, PantryRecipeCard, VideoCard } from '@/components/kitchen/KitchenCards';
import { Skeleton } from '@/components/Skeleton';
import {
  CUISINES,
  DEFAULT_TARGETS,
  TARGET_LIMITS,
  clampTargets,
  isDefaultTargets,
  type IdeasResponse,
  type PantryMode,
  type PantryRecipesResponse,
  type Targets,
  type TrendingResponse,
} from '@/lib/kitchen-ai';
import { sGet, sSet } from '@/lib/storage';

export type TabId = 'discover' | 'pantry' | 'protein';

const TABS: { id: TabId; label: string; short: string; icon: typeof Sparkles; blurb: string; placeholder: string }[] = [
  {
    id: 'discover',
    label: 'Discover',
    short: 'Discover',
    icon: Flame,
    blurb: 'New dishes you don’t have yet, with the most-watched YouTube videos for each.',
    placeholder: 'e.g. quick weeknight, dessert, street food…',
  },
  {
    id: 'pantry',
    label: 'From my pantry',
    short: 'Pantry',
    icon: Refrigerator,
    blurb: 'Dishes you can make now from what tote says is in stock or running low.',
    placeholder: 'e.g. breakfast, under 20 min, no oven…',
  },
  {
    id: 'protein',
    label: 'High-protein',
    short: 'Protein',
    icon: Dumbbell,
    blurb: 'High-protein, low-calorie dishes from your pantry, ranked by protein per calorie.',
    placeholder: 'e.g. vegetarian, post-workout, meal prep…',
  },
];

/** `cuisine` is what the results were generated for; empty or missing means any. */
type Cached<T> = { at: number; data: T; cuisine?: string };
type DiscoverData = { ideas: IdeasResponse; trending: TrendingResponse };

const KEY = {
  discover: 'kitchen-ai:v1:discover',
  pantry: 'kitchen-ai:v1:pantry',
  protein: 'kitchen-ai:v1:protein',
  targets: 'kitchen-ai:v1:targets',
  refine: 'kitchen-ai:v1:refine',
  cuisine: 'kitchen-ai:v1:cuisine',
} as const;

const EMPTY_FLAGS: Record<TabId, boolean> = { discover: false, pantry: false, protein: false };
const EMPTY_ERRORS: Record<TabId, string | null> = { discover: null, pantry: null, protein: null };

function timeAgo(at: number, now: number): string {
  const mins = Math.max(0, Math.round((now - at) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === 'string') return data.error;
  } catch {}
  return `Something went wrong (HTTP ${res.status}).`;
}

/**
 * Rendered client-only (see KitchenAILoader), so the lazy initialisers below
 * can read localStorage without a hydration mismatch.
 */
export default function KitchenAIClient({ initialTab }: { initialTab: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [discover, setDiscover] = useState<Cached<DiscoverData> | null>(() => sGet(KEY.discover));
  const [pantry, setPantry] = useState<Cached<PantryRecipesResponse> | null>(() => sGet(KEY.pantry));
  const [protein, setProtein] = useState<Cached<PantryRecipesResponse> | null>(() => sGet(KEY.protein));
  const [targets, setTargets] = useState<Targets>(() => clampTargets(sGet<Targets>(KEY.targets) ?? undefined));
  const [refine, setRefine] = useState<Record<TabId, string>>(
    () => ({ discover: '', pantry: '', protein: '', ...(sGet<Record<TabId, string>>(KEY.refine) ?? {}) })
  );
  const [cuisine, setCuisine] = useState<Record<TabId, string>>(
    () => ({ discover: '', pantry: '', protein: '', ...(sGet<Record<TabId, string>>(KEY.cuisine) ?? {}) })
  );
  const [loading, setLoading] = useState(EMPTY_FLAGS);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [now] = useState(() => Date.now());

  // Mark ideas already in Future Recipes.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/future-recipes')
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: { name: string }[] }) => {
        if (!cancelled) setSaved(new Set((d.items ?? []).map(i => i.name.toLowerCase().trim())));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function selectTab(id: TabId) {
    setTab(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', id);
      window.history.replaceState(null, '', url);
    } catch {}
  }

  function updateRefine(id: TabId, value: string) {
    setRefine(prev => {
      const next = { ...prev, [id]: value };
      sSet(KEY.refine, next);
      return next;
    });
  }

  function updateCuisine(id: TabId, value: string) {
    setCuisine(prev => {
      const next = { ...prev, [id]: value };
      sSet(KEY.cuisine, next);
      return next;
    });
  }

  function updateTargets(next: Targets) {
    setTargets(next);
    sSet(KEY.targets, next);
  }

  const setFlag = (id: TabId, v: boolean) => setLoading(prev => ({ ...prev, [id]: v }));
  const setError = (id: TabId, v: string | null) => setErrors(prev => ({ ...prev, [id]: v }));

  async function saveIdea(name: string) {
    const res = await fetch('/api/future-recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) setSaved(prev => new Set(prev).add(name.toLowerCase().trim()));
  }
  const isSaved = (name: string) => saved.has(name.toLowerCase().trim());

  async function runDiscover() {
    setFlag('discover', true);
    setError('discover', null);
    const picked = cuisine.discover;
    try {
      const [ideasRes, trendingRes] = await Promise.all([
        fetch('/api/ai/ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refine: refine.discover, cuisine: picked }),
        }),
        fetch(`/api/ai/trending${picked ? `?cuisine=${encodeURIComponent(picked)}` : ''}`),
      ]);
      if (!ideasRes.ok) throw new Error(await readError(ideasRes));
      const ideas = (await ideasRes.json()) as IdeasResponse;
      const trending: TrendingResponse = trendingRes.ok ? await trendingRes.json() : { videos: [], youtube: ideas.youtube };
      const cached = { at: Date.now(), data: { ideas, trending }, cuisine: picked };
      setDiscover(cached);
      sSet(KEY.discover, cached);
    } catch (e) {
      setError('discover', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setFlag('discover', false);
    }
  }

  async function runPantry(mode: PantryMode, override?: Targets) {
    const id: TabId = mode;
    setFlag(id, true);
    setError(id, null);
    const picked = cuisine[id];
    try {
      const res = await fetch('/api/ai/pantry-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, refine: refine[id], targets: override ?? targets, cuisine: picked }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as PantryRecipesResponse;
      const cached = { at: Date.now(), data, cuisine: picked };
      if (mode === 'protein') { setProtein(cached); sSet(KEY.protein, cached); }
      else { setPantry(cached); sSet(KEY.pantry, cached); }
    } catch (e) {
      setError(id, e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setFlag(id, false);
    }
  }

  function applyDefaultTargets() {
    const d = { ...DEFAULT_TARGETS };
    updateTargets(d);
    void runPantry('protein', d);
  }

  const run = () => (tab === 'discover' ? runDiscover() : runPantry(tab));
  const current = tab === 'discover' ? discover : tab === 'pantry' ? pantry : protein;
  const meta = TABS.find(t => t.id === tab)!;
  const busy = loading[tab];
  const picked = cuisine[tab];
  // The results on screen are for the picked cuisine, so the button just refreshes them.
  const matches = !!current && (current.cuisine ?? '') === picked;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={20} className="text-accent" />
          <h1 className="font-display text-2xl font-semibold text-ink">AI Kitchen</h1>
        </div>
        <p className="text-sm text-ink-muted">Recipe ideas, pantry cooking and high-protein picks, powered by Gemini.</p>
      </header>

      {/* Tabs */}
      <div role="tablist" aria-label="AI Kitchen sections" className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-card p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 sm:px-3 text-sm font-medium transition-colors ${
                active ? 'bg-accent text-white' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
              }`}
            >
              <Icon size={15} />
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {loading[t.id] && <Loader2 size={13} className="animate-spin" />}
            </button>
          );
        })}
      </div>

      <p className="mb-4 text-sm text-ink-muted">{meta.blurb}</p>

      {/* Controls */}
      <div className="mb-6 rounded-xl border border-border bg-surface-card p-4">
        <CuisinePicker
          key={tab}
          value={picked}
          onChange={c => updateCuisine(tab, c)}
          onSubmit={() => { if (!busy) void run(); }}
          disabled={busy}
        />
        {tab === 'protein' && <TargetsEditor targets={targets} onChange={updateTargets} disabled={busy} />}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={refine[tab]}
            onChange={e => updateRefine(tab, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !busy) void run(); }}
            placeholder={meta.placeholder}
            maxLength={200}
            aria-label="Refine suggestions (optional)"
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : matches ? <RefreshCw size={15} /> : <Sparkles size={15} />}
            {busy ? 'Thinking…'
              : matches ? 'Refresh'
              : tab === 'discover' ? `Get ${picked ? `${picked} ` : ''}ideas`
              : `Suggest ${picked ? `${picked} ` : ''}dishes`}
          </button>
        </div>
        {current && !busy && (
          <p className="mt-2 text-xs text-ink-faint">
            Generated {timeAgo(current.at, now)}{current.cuisine ? ` · ${current.cuisine}` : ''}.{matches ? ' Refresh for new suggestions.' : ''}
          </p>
        )}
      </div>

      {errors[tab] && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {errors[tab]}
        </div>
      )}

      {busy && !current ? (
        <ResultsSkeleton />
      ) : (
        <div className={busy ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}>
          {tab === 'discover' && (discover ? <DiscoverResults data={discover.data} cuisine={discover.cuisine} isSaved={isSaved} onSave={saveIdea} /> : <EmptyState tab="discover" />)}
          {tab === 'pantry' && (pantry ? <PantryResults data={pantry.data} isSaved={isSaved} onSave={saveIdea} /> : <EmptyState tab="pantry" />)}
          {tab === 'protein' && (
            protein ? (
              <PantryResults
                data={protein.data}
                isSaved={isSaved}
                onSave={saveIdea}
                protein
                onUseDefaults={applyDefaultTargets}
              />
            ) : <EmptyState tab="protein" />
          )}
        </div>
      )}
    </div>
  );
}

function CuisinePicker({
  value, onChange, onSubmit, disabled,
}: { value: string; onChange: (c: string) => void; onSubmit: () => void; disabled: boolean }) {
  // Typed text is kept here, so typing "Indian" in the field doesn't jump to the Indian chip.
  const [custom, setCustom] = useState(() => ((CUISINES as readonly string[]).includes(value) ? '' : value));
  const typed = custom.trim() !== '';
  const options = [{ label: 'Any', value: '' }, ...CUISINES.map(c => ({ label: c, value: c }))];

  return (
    <div className="mb-3">
      <p id="cuisine-label" className="mb-1.5 text-xs font-medium text-ink-muted">Cuisine</p>
      <div role="group" aria-labelledby="cuisine-label" className="flex flex-wrap items-center gap-1.5">
        {options.map(o => {
          const active = !typed && value === o.value;
          return (
            <button
              key={o.label}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => { setCustom(''); onChange(o.value); }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                active ? 'bg-accent text-white' : 'border border-border text-ink-muted hover:bg-surface-hover hover:text-ink'
              }`}
            >
              {o.label}
            </button>
          );
        })}
        <input
          type="text"
          value={custom}
          disabled={disabled}
          maxLength={40}
          onChange={e => { setCustom(e.target.value); onChange(e.target.value.trim()); }}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
          placeholder="Other, e.g. Thai"
          aria-label="Other cuisine"
          className={`w-full rounded-full border px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:w-44 ${
            typed ? 'border-accent bg-accent-light' : 'border-border bg-surface'
          }`}
        />
      </div>
    </div>
  );
}

function TargetsEditor({ targets, onChange, disabled }: { targets: Targets; onChange: (t: Targets) => void; disabled: boolean }) {
  // Local strings so a half-typed number isn't clamped mid-edit.
  const [protein, setProtein] = useState(String(targets.minProtein));
  const [calories, setCalories] = useState(String(targets.maxCalories));
  const [synced, setSynced] = useState(targets);
  if (synced !== targets) {
    // Targets changed from outside (e.g. "use defaults"): mirror them.
    setSynced(targets);
    setProtein(String(targets.minProtein));
    setCalories(String(targets.maxCalories));
  }

  function commit(p: string, c: string) {
    const next = clampTargets({ minProtein: Number(p), maxCalories: Number(c) });
    setSynced(next);
    onChange(next);
  }

  const field = 'w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <label className="text-xs font-medium text-ink-muted">
        Protein at least (g)
        <input
          type="number" inputMode="numeric" disabled={disabled}
          min={TARGET_LIMITS.minProtein.min} max={TARGET_LIMITS.minProtein.max}
          value={protein}
          onChange={e => setProtein(e.target.value)}
          onBlur={() => commit(protein, calories)}
          className={`mt-1 block ${field}`}
        />
      </label>
      <label className="text-xs font-medium text-ink-muted">
        Calories at most (kcal)
        <input
          type="number" inputMode="numeric" disabled={disabled}
          min={TARGET_LIMITS.maxCalories.min} max={TARGET_LIMITS.maxCalories.max}
          value={calories}
          onChange={e => setCalories(e.target.value)}
          onBlur={() => commit(protein, calories)}
          className={`mt-1 block ${field}`}
        />
      </label>
      <p className="pb-2 text-xs text-ink-faint">per serving</p>
      {!isDefaultTargets(targets) && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...DEFAULT_TARGETS })}
          className="pb-2 text-xs font-medium text-accent hover:text-accent-hover"
        >
          Reset to {DEFAULT_TARGETS.minProtein} g / {DEFAULT_TARGETS.maxCalories} kcal
        </button>
      )}
    </div>
  );
}

function DiscoverResults({
  data, cuisine, isSaved, onSave,
}: { data: DiscoverData; cuisine?: string; isSaved: (n: string) => boolean; onSave: (n: string) => Promise<void> }) {
  const { ideas, trending } = data;
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-muted">
          <Sparkles size={13} /> {cuisine ? `${cuisine} ideas` : 'Ideas for you'} · {ideas.ideas.length}
        </h2>
        {!ideas.youtube && (
          <p className="mb-3 text-xs text-ink-faint">Add a YOUTUBE_API_KEY to show the most-watched videos for each idea. Until then you get YouTube search links.</p>
        )}
        {ideas.ideas.length === 0 ? (
          <p className="text-sm text-ink-muted">No new ideas this time. Try Refresh or change the request.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ideas.ideas.map((idea, i) => (
              <IdeaCard key={idea.name} idea={idea} index={i} saved={isSaved(idea.name)} onSave={() => onSave(idea.name)} />
            ))}
          </div>
        )}
      </section>

      {trending.youtube && trending.videos.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-muted">
            <TrendingUp size={13} /> Viral{cuisine ? ` ${cuisine}` : ''} on YouTube · last 2 weeks
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {trending.videos.map(v => <VideoCard key={v.id} video={v} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function PantryResults({
  data, isSaved, onSave, protein = false, onUseDefaults,
}: {
  data: PantryRecipesResponse;
  isSaved: (n: string) => boolean;
  onSave: (n: string) => Promise<void>;
  protein?: boolean;
  onUseDefaults?: () => void;
}) {
  if (!data.ok) {
    return (
      <Notice
        title={data.pantryError.reason === 'empty' ? 'Your pantry is empty' : 'Pantry not connected'}
        body={data.pantryError.message}
      />
    );
  }

  const { pantry, recipes, targets, noneMatched } = data;
  return (
    <div className="space-y-4">
      <details className="rounded-xl border border-border bg-surface-card px-4 py-3 text-sm">
        <summary className="cursor-pointer text-ink-muted">
          Using <span className="font-semibold text-ink">{pantry.count}</span> items from your tote pantry
          {pantry.lowCount > 0 && <> · <span className="font-semibold text-amber-700 dark:text-amber-300">{pantry.lowCount} running low</span></>}
        </summary>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pantry.items.map(i => (
            <span
              key={i.name}
              className={`rounded-full px-2 py-0.5 text-xs ${i.low ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-surface-hover text-ink-muted'}`}
            >
              {i.name}
            </span>
          ))}
        </div>
      </details>

      {protein && targets && (
        <p className="text-xs text-ink-faint">
          Showing dishes with at least {targets.minProtein} g protein and at most {targets.maxCalories} kcal per serving. Nutrition values are AI estimates.
        </p>
      )}

      {noneMatched && targets ? (
        isDefaultTargets(targets) ? (
          <Notice
            title="Nothing hit the targets"
            body={`None of the suggestions reached ${targets.minProtein} g protein under ${targets.maxCalories} kcal with your current pantry. Try Refresh, loosen the targets, or stock a lean protein (eggs, Greek yogurt, chicken, tofu, lentils).`}
          />
        ) : (
          <div className="rounded-xl border border-border bg-accent-light p-5">
            <p className="font-display text-lg font-medium text-ink">Found nothing for your targets</p>
            <p className="mt-1 text-sm text-ink-muted">
              No dish from your pantry reached {targets.minProtein} g protein with at most {targets.maxCalories} kcal. Want to try the defaults ({DEFAULT_TARGETS.minProtein} g protein, ≤ {DEFAULT_TARGETS.maxCalories} kcal)?
            </p>
            <button
              type="button"
              onClick={onUseDefaults}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Use default values
            </button>
          </div>
        )
      ) : recipes.length === 0 ? (
        <Notice title="No dishes this time" body="Try Refresh, or loosen your request." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r, i) => (
            <PantryRecipeCard
              key={r.name}
              recipe={r}
              index={i}
              saved={isSaved(r.name)}
              onSave={() => onSave(r.name)}
              highlightMacros={protein}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-lg font-medium text-ink">{title}</p>
      <p className="max-w-md text-sm text-ink-muted">{body}</p>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabId }) {
  const copy: Record<TabId, { title: string; body: string }> = {
    discover: { title: 'Find something new to cook', body: 'Get fresh ideas you don’t have yet, each with popular YouTube videos, plus what’s going viral right now.' },
    pantry: { title: 'Cook with what you have', body: 'Suggestions use only your tote items that are in stock or running low, plus basics like salt and oil.' },
    protein: { title: 'High-protein, low-calorie', body: 'Set your targets above and get dishes from your pantry that meet them, ranked by protein per calorie.' },
  };
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light">
        <Sparkles size={24} className="text-accent" />
      </div>
      <p className="font-display text-xl font-medium text-ink">{copy[tab].title}</p>
      <p className="max-w-sm text-sm text-ink-muted">{copy[tab].body}</p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading suggestions">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface-card p-5">
          <div className="mb-3 flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="mb-1 h-3 w-full" />
          <Skeleton className="mb-4 h-3 w-5/6" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
