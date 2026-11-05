'use client';

import { createContext, useContext, useCallback } from 'react';
import { useAccountList } from './useAccountList';

export type QueueItem = {
  slug: string;
  name: string;
  prepTime: number | null;
  cookTime: number | null;
};

type QueueContextType = {
  queue: QueueItem[];
  isLoaded: boolean;
  isSaving: boolean;
  error: string | null;
  addToQueue: (item: QueueItem) => Promise<void>;
  removeFromQueue: (slug: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  isInQueue: (slug: string) => boolean;
};

const QueueContext = createContext<QueueContextType>({
  queue: [],
  isLoaded: false,
  isSaving: false,
  error: null,
  addToQueue: async () => {},
  removeFromQueue: async () => {},
  clearQueue: async () => {},
  isInQueue: () => false,
});

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const { items: queue, isLoaded, isSaving, error, update } = useAccountList<QueueItem>('/api/queue', 'queue', 'your cooking queue');

  const addToQueue = useCallback(async (item: QueueItem) => {
    if (queue.some(i => i.slug === item.slug)) return;
    const saved = await update([...queue, item], '/api/queue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
    });
    if (saved) { try { localStorage.setItem('cookbook-queue-ever-used', '1'); } catch {} }
  }, [queue, update]);

  const removeFromQueue = useCallback(async (slug: string) => {
    await update(queue.filter(i => i.slug !== slug), `/api/queue?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
  }, [queue, update]);

  const clearQueue = useCallback(async () => {
    await update([], '/api/queue', { method: 'DELETE' });
  }, [update]);

  const isInQueue = useCallback((slug: string) => queue.some(i => i.slug === slug), [queue]);

  return (
    <QueueContext.Provider value={{ queue, isLoaded, isSaving, error, addToQueue, removeFromQueue, clearQueue, isInQueue }}>
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue() {
  return useContext(QueueContext);
}
