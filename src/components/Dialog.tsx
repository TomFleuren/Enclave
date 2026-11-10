import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A modal built on the native <dialog> element, which provides the focus
 * trap, the Escape key and the inert background without any extra code.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog glass"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click that lands on the dialog element itself is on the backdrop.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog__body">
        <h2 className="dialog__title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before something that cannot be undone. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <p className="dialog__text">{message}</p>
      <div className="dialog__actions">
        <button type="button" className="button" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button type="button" className="button button--danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
