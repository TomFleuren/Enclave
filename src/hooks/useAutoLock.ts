import { useEffect } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

interface AutoLockOptions {
  /** Minutes without activity before locking. 0 turns the timer off. */
  idleMinutes: number;
  /** Lock as soon as the tab is hidden. */
  lockOnHide: boolean;
  onLock: (reason: string) => void;
}

/**
 * Locks the vault after a period without input, and optionally when the tab
 * is hidden.
 *
 * Idle time is measured against the wall clock rather than counted by a
 * single long timer, because timers are throttled in background tabs and
 * paused while a laptop sleeps. Checking the clock means a vault left open
 * before closing the lid locks as soon as the machine wakes.
 */
export function useAutoLock({ idleMinutes, lockOnHide, onLock }: AutoLockOptions): void {
  useEffect(() => {
    const limitMs = idleMinutes * 60_000;
    let lastActivity = Date.now();

    const recordActivity = () => {
      lastActivity = Date.now();
    };

    const checkIdle = () => {
      if (limitMs > 0 && Date.now() - lastActivity >= limitMs) {
        onLock('Locked after a period of inactivity.');
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (lockOnHide) onLock('Locked because the tab was hidden.');
      } else {
        checkIdle();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(checkIdle, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [idleMinutes, lockOnHide, onLock]);
}
