'use client';

import { useSyncExternalStore } from 'react';
import {
  getWakeState,
  subscribeWakeState,
  INITIAL_WAKE_STATE,
  type WakeState,
} from '@/lib/wake-lock-store';

/**
 * Live wake-lock readout. Hidden unless the URL carries `?wakedebug=1`.
 *
 * Reads the query string via useSyncExternalStore rather than
 * `useSearchParams()` on purpose — the latter opts the whole tree into
 * dynamic rendering, which would de-optimise the statically generated
 * recipe pages.
 */

const noopSubscribe = () => () => {};

function readDebugFlag(): boolean {
  return new URLSearchParams(window.location.search).has('wakedebug');
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-white/45">{label}</span>
      <span className={tone ?? 'text-white'}>{value}</span>
    </div>
  );
}

export default function WakeLockDebug() {
  const enabled = useSyncExternalStore(noopSubscribe, readDebugFlag, () => false);
  const state: WakeState = useSyncExternalStore(
    subscribeWakeState,
    getWakeState,
    () => INITIAL_WAKE_STATE,
  );

  if (!enabled) return null;

  const held = state.active || state.fallbackActive;

  return (
    <div
      className="fixed bottom-3 left-3 z-[100] w-[15rem] rounded-xl border border-white/15 bg-black/85 p-3 font-mono text-[11px] leading-relaxed text-white shadow-2xl backdrop-blur-md"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mb-2 flex items-center gap-2 border-b border-white/15 pb-2">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
            held ? 'bg-green-400' : state.armed ? 'bg-amber-400' : 'bg-red-400'
          }`}
        />
        <span className="font-semibold tracking-wide">
          {held ? 'SCREEN HELD' : state.armed ? 'AWAITING TAP' : 'INACTIVE'}
        </span>
      </div>

      <Row
        label="api"
        value={state.supported ? 'yes' : 'MISSING'}
        tone={state.supported ? 'text-green-400' : 'text-red-400'}
      />
      <Row
        label="lock"
        value={state.active ? 'held' : 'no'}
        tone={state.active ? 'text-green-400' : 'text-white/70'}
      />
      <Row
        label="fallback"
        value={state.fallbackActive ? 'playing' : 'off'}
        tone={state.fallbackActive ? 'text-green-400' : 'text-white/70'}
      />
      <Row
        label="armed"
        value={state.armed ? 'yes' : 'no'}
        tone={state.armed ? 'text-amber-400' : 'text-white/70'}
      />
      <Row label="attempts" value={String(state.attempts)} />
      <Row label="event" value={state.lastEvent ?? '—'} />

      <div className="mt-2 border-t border-white/15 pt-2">
        <div className="text-white/45">error</div>
        <div className={state.lastError ? 'break-words text-red-400' : 'text-white/70'}>
          {state.lastError ?? 'none'}
        </div>
      </div>

      {!state.supported && (
        <p className="mt-2 border-t border-white/15 pt-2 text-white/55">
          No wakeLock API — iOS below 16.4. Using video fallback.
        </p>
      )}
      {state.supported && state.armed && !state.active && (
        <p className="mt-2 border-t border-white/15 pt-2 text-white/55">
          Tap anywhere to acquire.
        </p>
      )}
    </div>
  );
}
