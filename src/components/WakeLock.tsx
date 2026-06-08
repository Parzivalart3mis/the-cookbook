'use client';

import { useEffect } from 'react';

// Tiny blank MP4 video — base64 data URI, loops silently to prevent screen lock on iOS < 16.4
const BLANK_VIDEO_SRC =
  'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1wNDJtcDQxaXNvbWF2YzEAAATKbW9vdgAAAGxtdmhkAAAAANLEP5XSxD+XAAAD6AAAACoAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABhpb2RzAAAAABCAgIAHAE/////+/////wAAAiF0cmFrAAAAXHRraGQAAAAH0sQ/ldLEP5cAAAABAAAAAAAAKgAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAAqAAAAAAABAAAAAAGZbWRpYQAAACBtZGhkAAAAANLEP5XSxD+XAAAAGQAAAAAVxwAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABQG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAQBzdGJsAAAAmHN0c2QAAAAAAAAAAQAAAIhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADhIAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAOGF2Y0MBQsAI/+EAGGdCwAjZo2wGQXoEAAAAAwBAAAADAsPFi2WAAAEABGjuPIAAAAAYc3R0cwAAAAAAAAABAAAABQAABAAAAAAUc3RzYwAAAAAAAAABAAAAAQAAAAUAAAABAAAAJHN0c3oAAAAAAAAAAAAAAAAFAAAAXAAAABUAAAAVAAAAFQAAABUAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNTguNDUuMTAw';

export default function WakeLock() {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wl = (navigator as any).wakeLock as
      | { request: (type: string) => Promise<{ release: () => Promise<void>; removeEventListener: (e: string, cb: () => void) => void; addEventListener: (e: string, cb: () => void) => void }> }
      | undefined;

    // --- Native Wake Lock path (Chrome, Safari 16.4+, Firefox 126+) ---
    if (wl) {
      let sentinel: Awaited<ReturnType<typeof wl.request>> | null = null;
      let acquiring = false;

      function onRelease() {
        sentinel = null;
        if (document.visibilityState === 'visible') acquire();
      }

      async function acquire() {
        if (acquiring || sentinel) return;
        acquiring = true;
        try {
          sentinel = await wl!.request('screen');
          sentinel.addEventListener('release', onRelease);
        } catch {
          // denied or unavailable — fail silently
        } finally {
          acquiring = false;
        }
      }

      function onVisibilityChange() {
        if (document.visibilityState === 'visible') acquire();
      }

      acquire();
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (sentinel) {
          sentinel.removeEventListener('release', onRelease);
          sentinel.release().catch(() => {});
          sentinel = null;
        }
      };
    }

    // --- NoSleep.js video fallback for iOS < 16.4 ---
    // Requires a user gesture to start; we listen for the first touch/click.
    const video = document.createElement('video');
    video.setAttribute('loop', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:0;left:0;';
    video.src = BLANK_VIDEO_SRC;
    video.load();

    function startVideo() {
      video.play().catch(() => {});
    }

    document.addEventListener('touchstart', startVideo, { once: true, passive: true });
    document.addEventListener('click', startVideo, { once: true });
    document.body.appendChild(video);

    return () => {
      document.removeEventListener('touchstart', startVideo);
      document.removeEventListener('click', startVideo);
      video.pause();
      if (video.parentNode) video.parentNode.removeChild(video);
    };
  }, []);

  return null;
}
