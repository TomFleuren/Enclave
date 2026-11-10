import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import type { Envelope } from '../crypto/envelope';
import { DecryptionError } from '../crypto/envelope';
import { useFeedback } from '../state/feedback-context';
import { useVault } from '../state/vault-context';
import { readBackupFile } from '../vault/backup';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { PasswordInput } from './PasswordInput';

interface RestoreBackupProps {
  label: string;
  className?: string;
  /** Whether the button carries the upload icon. A plain text link does not. */
  showIcon?: boolean;
  /** Tells the person an existing vault is about to be replaced. */
  replacesExisting: boolean;
}

/**
 * A button that restores a vault from a backup file.
 *
 * The backup has to decrypt with the password entered here before anything
 * in the browser is touched, so a wrong file or a forgotten password can
 * never cost someone the vault they already have.
 */
export function RestoreBackup({
  label,
  className = 'button',
  showIcon = true,
  replacesExisting,
}: RestoreBackupProps) {
  const { restore } = useVault();
  const { notify } = useFeedback();
  const fileInput = useRef<HTMLInputElement>(null);

  const [backup, setBackup] = useState<Envelope | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setBackup(null);
    setPassword('');
    setError(null);
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    try {
      setBackup(await readBackupFile(file));
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'That file could not be read.', 'error');
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!backup || busy) return;
    setBusy(true);
    setError(null);
    try {
      await restore(backup, password);
      setBusy(false);
      close();
      notify('Vault restored from backup.', 'success');
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof DecryptionError
          ? 'That password does not open this backup.'
          : 'The backup could not be restored.',
      );
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => fileInput.current?.click()}>
        {showIcon && <Icon name="upload" />}
        {label}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          void onFileChosen(event.target.files?.[0]);
          // Reset, so choosing the same file again still fires a change event.
          event.target.value = '';
        }}
      />

      {backup && (
        <Dialog title="Restore from backup" onClose={close}>
          <form onSubmit={onSubmit} className="stack">
            <p className="dialog__text">
              Enter the master password this backup was made with.
              {replacesExisting &&
                ' Once it opens, it replaces the vault that is in this browser now.'}
            </p>
            <label className="field">
              <span className="field__label">Backup password</span>
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete="off"
                autoFocus
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog__actions">
              <button
                type="submit"
                className={
                  replacesExisting
                    ? 'button button--large button--danger'
                    : 'button button--large button--primary'
                }
                disabled={busy || password === ''}
              >
                {busy ? 'Decrypting…' : replacesExisting ? 'Replace vault' : 'Restore'}
              </button>
              <button type="button" className="button button--large button--ghost" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
