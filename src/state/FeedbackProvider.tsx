import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS } from '../vault/model';
import type { Feedback, ToastTone } from './feedback-context';
import { FeedbackContext } from './feedback-context';
import { useVault } from './vault-context';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const TOAST_DURATION_MS = 2600;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { state } = useVault();
  const [toast, setToast] = useState<Toast | null>(null);

  const toastTimer = useRef<number | undefined>(undefined);
  const clipboardTimer = useRef<number | undefined>(undefined);
  const nextToastId = useRef(1);

  const unlocked = state.status === 'unlocked';
  const clearSeconds = unlocked
    ? state.data.settings.clipboardClearSeconds
    : DEFAULT_SETTINGS.clipboardClearSeconds;

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: nextToastId.current++, message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  /**
   * Overwrites the clipboard. Browsers only allow that while the page has
   * focus, so if it does not, the wipe is retried the moment focus returns.
   */
  const wipeClipboard = useCallback(() => {
    window.clearTimeout(clipboardTimer.current);
    clipboardTimer.current = undefined;
    navigator.clipboard.writeText('').catch(() => {
      window.addEventListener(
        'focus',
        () => void navigator.clipboard.writeText('').catch(() => {}),
        { once: true },
      );
    });
  }, []);

  const copy = useCallback(
    async (text: string, label: string, options: { sensitive?: boolean } = {}) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        notify('Copying was blocked by the browser.', 'error');
        return;
      }

      window.clearTimeout(clipboardTimer.current);
      clipboardTimer.current = undefined;

      if (options.sensitive && clearSeconds > 0) {
        clipboardTimer.current = window.setTimeout(wipeClipboard, clearSeconds * 1000);
        notify(`${label} copied. Clipboard clears in ${clearSeconds}s.`, 'success');
      } else {
        notify(`${label} copied.`, 'success');
      }
    },
    [clearSeconds, notify, wipeClipboard],
  );

  // Locking should not leave a secret sitting on the clipboard.
  useEffect(() => {
    if (!unlocked && clipboardTimer.current !== undefined) {
      wipeClipboard();
    }
  }, [unlocked, wipeClipboard]);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(clipboardTimer.current);
    },
    [],
  );

  const feedback = useMemo<Feedback>(() => ({ notify, copy }), [notify, copy]);

  return (
    <FeedbackContext.Provider value={feedback}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        )}
      </div>
    </FeedbackContext.Provider>
  );
}
