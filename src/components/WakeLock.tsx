'use client';

import { useEffect } from 'react';

export default function WakeLock() {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wl = (navigator as any).wakeLock as
      | { request: (type: string) => Promise<{ release: () => Promise<void>; addEventListener: (e: string, cb: () => void) => void }> }
      | undefined;

    if (!wl) return;

    let sentinel: { release: () => Promise<void>; addEventListener: (e: string, cb: () => void) => void } | null = null;

    async function acquire() {
      try {
        sentinel = await wl!.request('screen');
        // Reacquire when tab becomes visible again (lock is released on tab hide)
        sentinel.addEventListener('release', () => {
          if (document.visibilityState === 'visible') acquire();
        });
      } catch {
        // Wake Lock not available or denied — fail silently
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquire();
    }

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release();
    };
  }, []);

  return null;
}
