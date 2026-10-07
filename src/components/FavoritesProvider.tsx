'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';

type FavoritesContextType = {
  favorites: string[];
  isLoaded: boolean;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  isLoaded: false,
  isFavorite: () => false,
  toggleFavorite: async () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [fetched, setFetched] = useState(false);

  // Same shape as QueueProvider: signed-out users are "loaded" once Clerk resolves.
  const isLoaded = authLoaded && (!isSignedIn || fetched);

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    fetch('/api/favorites')
      .then(r => r.json())
      .then(data => { setFavorites(data.favorites ?? []); setFetched(true); })
      .catch(() => setFetched(true));
  }, [isSignedIn, authLoaded]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const isFavorite = useCallback((slug: string) => favoriteSet.has(slug), [favoriteSet]);

  const toggleFavorite = useCallback(async (slug: string) => {
    if (!isSignedIn) return;
    const adding = !favoriteSet.has(slug);
    setFavorites(prev => adding ? [...prev, slug] : prev.filter(s => s !== slug));
    try {
      const res = adding
        ? await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
          })
        : await fetch(`/api/favorites?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      // Roll back so the star never claims a save that didn't happen
      setFavorites(prev => adding ? prev.filter(s => s !== slug) : [...prev, slug]);
    }
  }, [isSignedIn, favoriteSet]);

  return (
    <FavoritesContext.Provider value={{ favorites, isLoaded, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
