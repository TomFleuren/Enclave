import { useSyncExternalStore } from 'react';

// One shared timer for every component that shows a countdown, instead of one
// interval per code on screen.
const listeners = new Set<() => void>();
let timer: number | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    // Faster than once a second so the displayed second never lags visibly.
    timer = window.setInterval(() => listeners.forEach((notify) => notify()), 250);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): number {
  return Math.floor(Date.now() / 1000);
}

/** The current Unix time in whole seconds, re-rendering when it changes. */
export function useNowSeconds(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}
