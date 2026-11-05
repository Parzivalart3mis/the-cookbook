'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PantryItem } from '@/lib/tote';
import type { CookbookRecipe } from '@/lib/pantry-matching';

export type PantrySnapshot = { items: PantryItem[]; fingerprint: string; checkedAt: number };

export function useKitchenPantry(tab: string) {
  const [snapshot, setSnapshot] = useState<PantrySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [cookbook, setCookbook] = useState<CookbookRecipe[] | null>(null);
  const [cookbookError, setCookbookError] = useState<string | null>(null);
  const [loadingCookbook, setLoadingCookbook] = useState(false);
  const lastCheck = useRef(0);
  const lastIndex = useRef(0);
  const pantryRequest = useRef<AbortController | null>(null);
  const indexRequest = useRef<AbortController | null>(null);

  const refresh = useCallback((force = false) => {
    if (!pantryRequest.current && (force || Date.now() - lastCheck.current > 30_000)) {
      lastCheck.current = Date.now();
      const controller = new AbortController();
      pantryRequest.current = controller;
      setChecking(true);
      void (async () => {
        try {
          const res = await fetch('/api/pantry', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? 'Could not check pantry. Try Refresh pantry.');
          if (!controller.signal.aborted) { setSnapshot(data); setError(null); }
        } catch (e) {
          if (!controller.signal.aborted) setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Pantry check timed out. Try Refresh pantry.');
        } finally {
          if (pantryRequest.current === controller) { pantryRequest.current = null; setChecking(false); }
        }
      })();
    }
    if (!indexRequest.current && (force || Date.now() - lastIndex.current > 300_000)) {
      lastIndex.current = Date.now();
      const controller = new AbortController();
      indexRequest.current = controller;
      setLoadingCookbook(true);
      void (async () => {
        try {
          const res = await fetch('/api/ai/cookbook-recipes', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Could not load your recipes.');
          if (!controller.signal.aborted) { setCookbook(data.recipes); setCookbookError(null); }
        } catch (e) {
          if (!controller.signal.aborted) setCookbookError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Loading your recipes timed out. Refresh pantry to retry.');
          if (!controller.signal.aborted) lastIndex.current = 0;
        } finally {
          if (indexRequest.current === controller) { indexRequest.current = null; setLoadingCookbook(false); }
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (tab === 'discover') return;
    refresh();
    const focus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [tab, refresh]);

  useEffect(() => () => {
    lastCheck.current = 0; lastIndex.current = 0;
    pantryRequest.current?.abort(); pantryRequest.current = null;
    indexRequest.current?.abort(); indexRequest.current = null;
  }, []);

  return { snapshot, error, checking, cookbook, cookbookError, loadingCookbook, refresh };
}
