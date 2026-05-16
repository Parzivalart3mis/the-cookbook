'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

export type QueueItem = {
  slug: string;
  name: string;
  prepTime: number | null;
  cookTime: number | null;
};

type QueueContextType = {
  queue: QueueItem[];
  isLoaded: boolean;
  addToQueue: (item: QueueItem) => Promise<void>;
  removeFromQueue: (slug: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  isInQueue: (slug: string) => boolean;
};

const QueueContext = createContext<QueueContextType>({
  queue: [],
  isLoaded: false,
  addToQueue: async () => {},
  removeFromQueue: async () => {},
  clearQueue: async () => {},
  isInQueue: () => false,
});

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!authLoaded) return;
    if (!isSignedIn) { setIsLoaded(true); return; }
    fetch('/api/queue')
      .then(r => r.json())
      .then(data => { setQueue(data.queue ?? []); setIsLoaded(true); })
      .catch(() => setIsLoaded(true));
  }, [isSignedIn, authLoaded]);

  const addToQueue = useCallback(async (item: QueueItem) => {
    if (!isSignedIn) return;
    setQueue(prev => prev.some(i => i.slug === item.slug) ? prev : [...prev, item]);
    try { localStorage.setItem('cookbook-queue-ever-used', '1'); } catch {}
    await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  }, [isSignedIn]);

  const removeFromQueue = useCallback(async (slug: string) => {
    if (!isSignedIn) return;
    setQueue(prev => prev.filter(i => i.slug !== slug));
    await fetch(`/api/queue?slug=${slug}`, { method: 'DELETE' });
  }, [isSignedIn]);

  const clearQueue = useCallback(async () => {
    if (!isSignedIn) return;
    setQueue([]);
    await fetch('/api/queue', { method: 'DELETE' });
  }, [isSignedIn]);

  const isInQueue = useCallback((slug: string) => queue.some(i => i.slug === slug), [queue]);

  return (
    <QueueContext.Provider value={{ queue, isLoaded, addToQueue, removeFromQueue, clearQueue, isInQueue }}>
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue() {
  return useContext(QueueContext);
}
