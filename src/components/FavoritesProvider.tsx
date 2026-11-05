'use client';

import { createContext, useContext, useCallback, useMemo } from 'react';
import { useAccountList } from './useAccountList';

type FavoritesContextType = {
  favorites: string[];
  isLoaded: boolean;
  isSaving: boolean;
  error: string | null;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  isLoaded: false,
  isSaving: false,
  error: null,
  isFavorite: () => false,
  toggleFavorite: async () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { items: favorites, isLoaded, isSaving, error, update } = useAccountList<string>('/api/favorites', 'favorites', 'your favorites');

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const isFavorite = useCallback((slug: string) => favoriteSet.has(slug), [favoriteSet]);

  const toggleFavorite = useCallback(async (slug: string) => {
    const adding = !favoriteSet.has(slug);
    await update(adding ? [...favorites, slug] : favorites.filter(s => s !== slug),
      adding ? '/api/favorites' : `/api/favorites?slug=${encodeURIComponent(slug)}`,
      adding ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) } : { method: 'DELETE' });
  }, [favorites, favoriteSet, update]);

  return (
    <FavoritesContext.Provider value={{ favorites, isLoaded, isSaving, error, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
