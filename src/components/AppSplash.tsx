'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Branded startup splash.
 *
 * Renders during SSR so it is present in the very first paint — that is what
 * prevents a flash of unstyled app. All animation lives in CSS (globals.css),
 * so the choreography runs before hydration and a failsafe keyframe clears the
 * overlay even if JS never executes.
 *
 * Dismissal is done by mutating the DOM node directly rather than via React
 * state: no re-render during startup, and nothing to hydrate-mismatch.
 */

/** Floor on visible time — stops a 100ms flash-and-gone on warm loads. */
const MIN_VISIBLE_MS = 900;
/** Must match the opacity transition in `#app-splash[data-done]`. */
const FADE_MS = 450;

export default function AppSplash() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // performance.now() is ms since navigation start — a truer measure of how
    // long the user has actually been waiting than time-since-React-render.
    const remaining = Math.max(0, MIN_VISIBLE_MS - performance.now());
    let hideTimer: ReturnType<typeof setTimeout>;

    const doneTimer = setTimeout(() => {
      el.dataset.done = 'true';
      // Pull it out of the accessibility tree once the fade completes.
      hideTimer = setTimeout(() => {
        el.hidden = true;
      }, FADE_MS);
    }, remaining);

    return () => {
      clearTimeout(doneTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // The landing page has its own staged entrance — two intros would collide.
  if (pathname === '/welcome') return null;

  return (
    <div id="app-splash" ref={ref} role="status" aria-label="Loading The Cookbook">
      <div className="splash-glow" aria-hidden="true" />

      <svg
        className="splash-mark relative"
        width="72"
        height="72"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
        <path d="M6 17h12" />
      </svg>

      <div className="splash-wordmark relative flex flex-col items-center gap-4">
        <span className="font-display text-xl font-semibold tracking-tight text-ink">
          The Cookbook
        </span>
        <div className="splash-bar" aria-hidden="true" />
      </div>
    </div>
  );
}
