'use client';

import { useEffect } from 'react';
import { getWakeState, setWakeState } from '@/lib/wake-lock-store';

/**
 * Keeps the screen awake on every page.
 *
 * The critical detail: WebKit requires *transient user activation* for
 * `wakeLock.request()`. Requesting only on mount (no gesture) is silently
 * rejected on iOS — which is why the same API works in iron-log, where the
 * request happens right after the user taps to start a rest timer.
 *
 * So: try on mount (free win on Chrome/Android), and always arm a one-shot
 * gesture listener so the user's first tap acquires the lock on iOS.
 */

/** Tiny silent MP4 — loops to hold the screen on iOS < 16.4, where wakeLock is absent. */
const BLANK_VIDEO_SRC =
  'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1wNDJtcDQxaXNvbWF2YzEAAATKbW9vdgAAAGxtdmhkAAAAANLEP5XSxD+XAAAD6AAAACoAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABhpb2RzAAAAABCAgIAHAE/////+/////wAAAiF0cmFrAAAAXHRraGQAAAAH0sQ/ldLEP5cAAAABAAAAAAAAKgAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAAqAAAAAAABAAAAAAGZbWRpYQAAACBtZGhkAAAAANLEP5XSxD+XAAAAGQAAAAAVxwAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABQG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAQBzdGJsAAAAmHN0c2QAAAAAAAAAAQAAAIhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADhIAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAOGF2Y0MBQsAI/+EAGGdCwAjZo2wGQXoEAAAAAwBAAAADAsPFi2WAAAEABGjuPIAAAAAYc3R0cwAAAAAAAAABAAAABQAABAAAAAAUc3RzYwAAAAAAAAABAAAAAQAAAAUAAAABAAAAJHN0c3oAAAAAAAAAAAAAAAAFAAAAXAAAABUAAAAVAAAAFQAAABUAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNTguNDUuMTAw';

/** Events that count as user activation. Passive — never blocks scrolling. */
const GESTURES = ['pointerdown', 'touchstart', 'click'] as const;

function formatError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export default function WakeLock() {
  useEffect(() => {
    const wl = navigator.wakeLock as WakeLock | undefined;
    const supported = typeof wl?.request === 'function';
    setWakeState({ supported, lastEvent: 'mount' });

    // ── Path A: native Screen Wake Lock ──────────────────────────────────
    if (supported && wl) {
      let sentinel: WakeLockSentinel | null = null;
      let acquiring = false;
      let disposed = false;

      function onGesture() {
        disarmGestures();
        void acquire('gesture');
      }

      function armGestures() {
        if (disposed) return;
        // Same listener reference, so repeated arming cannot stack duplicates.
        for (const g of GESTURES) {
          document.addEventListener(g, onGesture, { passive: true });
        }
        setWakeState({ armed: true });
      }

      function disarmGestures() {
        for (const g of GESTURES) document.removeEventListener(g, onGesture);
        setWakeState({ armed: false });
      }

      function onRelease() {
        sentinel = null;
        setWakeState({ active: false, lastEvent: 'released' });
        // iOS releases on backgrounding; re-take it if we're still on screen.
        if (!disposed && document.visibilityState === 'visible') {
          void acquire('auto-release');
        }
      }

      async function acquire(reason: string) {
        if (disposed || acquiring || sentinel) return;
        acquiring = true;
        setWakeState({
          attempts: getWakeState().attempts + 1,
          lastEvent: `acquire:${reason}`,
        });

        try {
          const next = await wl!.request('screen');
          if (disposed) {
            void next.release().catch(() => {});
            return;
          }
          sentinel = next;
          next.addEventListener('release', onRelease);
          disarmGestures();
          setWakeState({ active: true, lastError: null, lastEvent: `held:${reason}` });
        } catch (err) {
          // The expected iOS path when there is no user activation yet.
          setWakeState({ active: false, lastError: formatError(err) });
          armGestures();
        } finally {
          acquiring = false;
        }
      }

      function onVisibilityChange() {
        if (document.visibilityState !== 'visible') return;
        setWakeState({ lastEvent: 'visible' });
        if (!sentinel || sentinel.released) void acquire('visibility');
      }

      // Arm first so a tap during the async request still counts, then try.
      armGestures();
      void acquire('mount');
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        disposed = true;
        document.removeEventListener('visibilitychange', onVisibilityChange);
        disarmGestures();
        if (sentinel) {
          sentinel.removeEventListener('release', onRelease);
          void sentinel.release().catch(() => {});
          sentinel = null;
        }
        setWakeState({ active: false, lastEvent: 'unmount' });
      };
    }

    // ── Path B: no wakeLock API (iOS < 16.4) → silent looping video ──────
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    video.src = BLANK_VIDEO_SRC;

    let videoDisposed = false;

    function playVideo(reason: string) {
      if (videoDisposed) return;
      setWakeState({
        attempts: getWakeState().attempts + 1,
        lastEvent: `video:${reason}`,
      });
      video
        .play()
        .then(() => setWakeState({ fallbackActive: true, lastError: null }))
        .catch((err) => setWakeState({ fallbackActive: false, lastError: formatError(err) }));
    }

    function onVideoGesture() {
      playVideo('gesture');
    }

    function onVideoVisibility() {
      // iOS pauses media on background — restart every time we come back.
      if (document.visibilityState === 'visible') playVideo('visibility');
    }

    document.body.appendChild(video);
    for (const g of GESTURES) {
      document.addEventListener(g, onVideoGesture, { passive: true });
    }
    document.addEventListener('visibilitychange', onVideoVisibility);
    setWakeState({ armed: true });
    playVideo('mount');

    return () => {
      videoDisposed = true;
      for (const g of GESTURES) document.removeEventListener(g, onVideoGesture);
      document.removeEventListener('visibilitychange', onVideoVisibility);
      video.pause();
      video.remove();
      setWakeState({ fallbackActive: false, armed: false, lastEvent: 'unmount' });
    };
  }, []);

  return null;
}
