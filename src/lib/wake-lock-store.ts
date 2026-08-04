/**
 * Tiny external store holding live Screen Wake Lock diagnostics.
 *
 * Exists because three previous attempts at this feature swallowed every
 * rejection with `.catch(() => {})`, leaving no way to tell "API missing"
 * apart from "request rejected". The debug panel subscribes to this.
 */

export type WakeState = {
  /** navigator.wakeLock exists and exposes request(). */
  supported: boolean;
  /** A sentinel is currently held. */
  active: boolean;
  /** Waiting for a user gesture to (re)acquire — WebKit requires one. */
  armed: boolean;
  /** Video fallback is playing (iOS < 16.4 path). */
  fallbackActive: boolean;
  /** How many acquire attempts have been made. */
  attempts: number;
  /** Last rejection, formatted as "Name: message". */
  lastError: string | null;
  /** Last lifecycle event, for tracing. */
  lastEvent: string | null;
};

export const INITIAL_WAKE_STATE: WakeState = Object.freeze({
  supported: false,
  active: false,
  armed: false,
  fallbackActive: false,
  attempts: 0,
  lastError: null,
  lastEvent: null,
});

let state: WakeState = INITIAL_WAKE_STATE;
const listeners = new Set<() => void>();

export function getWakeState(): WakeState {
  return state;
}

export function setWakeState(patch: Partial<WakeState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribeWakeState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
