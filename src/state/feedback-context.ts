import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export interface Feedback {
  /** Shows a short message at the bottom of the screen. */
  notify(message: string, tone?: ToastTone): void;
  /**
   * Copies `text` and confirms it with a toast. A `sensitive` value is wiped
   * from the clipboard again after the delay chosen in the settings.
   */
  copy(text: string, label: string, options?: { sensitive?: boolean }): Promise<void>;
}

export const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const feedback = useContext(FeedbackContext);
  if (!feedback) {
    throw new Error('useFeedback must be used inside a FeedbackProvider');
  }
  return feedback;
}
