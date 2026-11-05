'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

/** Optimistic lists share one in-flight write, rollback, and account isolation. */
export function useAccountList<T>(endpoint: string, field: string, label: string) {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [state, setState] = useState<{ owner: string; items: T[]; error: string | null } | null>(null);
  const [savingOwner, setSavingOwner] = useState<string | null>(null);
  const lock = useRef<{ owner: string; token: symbol } | null>(null);
  const isLoaded = authLoaded && (!userId || state?.owner === userId);
  const items = userId && state?.owner === userId ? state.items : [];
  const error = userId && state?.owner === userId ? state.error : null;

  useEffect(() => {
    if (!authLoaded || !userId) return;
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!Array.isArray(data[field])) throw new Error();
        if (!controller.signal.aborted) setState({ owner: userId, items: data[field], error: null });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ owner: userId, items: [], error: `Could not load ${label}. Reload to retry.` }); });
    return () => controller.abort();
  }, [authLoaded, userId, endpoint, field, label]);

  const update = useCallback(async (
    next: T[], url: string, init: RequestInit,
    confirmed?: (res: Response) => Promise<T[]>,
  ): Promise<boolean> => {
    if (!userId || !isLoaded || state?.owner !== userId || lock.current?.owner === userId) return false;
    const before = state.items;
    const token = Symbol();
    lock.current = { owner: userId, token };
    setSavingOwner(userId);
    setState({ owner: userId, items: next, error: null });
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error();
      const saved = confirmed ? await confirmed(res) : next;
      setState(current => current?.owner === userId ? { owner: userId, items: saved, error: null } : current);
      return true;
    } catch {
      setState(current => current?.owner === userId ? { owner: userId, items: before, error: `Could not save ${label}. Your previous list has been restored. Try again.` } : current);
      return false;
    } finally {
      if (lock.current?.token === token) { lock.current = null; setSavingOwner(null); }
    }
  }, [userId, isLoaded, state, label]);

  return { items, isLoaded, isSaving: !!userId && savingOwner === userId, error, update };
}
