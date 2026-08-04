'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * The <html> class is the single source of truth for theme (an inline script
 * in the layout sets it before paint). Reading it via useSyncExternalStore
 * keeps this component in sync without mirroring the value into state.
 */
function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

const getIsDark = () => document.documentElement.classList.contains('dark');

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribeToTheme, getIsDark, () => false);

  function toggle() {
    const next = !isDark;
    // Mutating the class fires the observer above, which re-renders us.
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
