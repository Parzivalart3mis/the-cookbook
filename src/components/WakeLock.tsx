'use client';

import { useEffect } from 'react';

export default function WakeLock() {
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    function acquire() {
      navigator.wakeLock?.request('screen')
        .then((lock) => { wakeLock = lock; })
        .catch(() => {});
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        if (!wakeLock || wakeLock.released) acquire();
      }
    }

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLock?.release().catch(() => {});
    };
  }, []);

  return null;
}
