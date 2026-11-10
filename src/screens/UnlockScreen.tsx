import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { PasswordInput } from '../components/PasswordInput';
import { DecryptionError } from '../crypto/envelope';
import { useVault } from '../state/vault-context';
import { AuthLayout } from './AuthLayout';

export function UnlockScreen({ notice }: { notice: string | null }) {
  const { unlock, destroy } = useVault();
  const input = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || password === '') return;
    setBusy(true);
    setError(null);
    try {
      await unlock(password);
    } catch (cause) {
      setBusy(false);
      setPassword('');
      setError(
        cause instanceof DecryptionError
          ? 'That password is not right. Try again.'
          : 'The vault could not be opened.',
      );
      // Back to the field, so the next attempt can be typed straight away.
      input.current?.focus();
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Enter your master password to unlock the vault."
      footer={
        <button type="button" className="link-button" onClick={() => setConfirmingDelete(true)}>
          Forgot your password? Delete this vault and start over
        </button>
      }
    >
      <form onSubmit={onSubmit} className="stack">
        {notice && !error && <p className="callout">{notice}</p>}

        <label className="field">
          <span className="field__label">Master password</span>
          <PasswordInput
            ref={input}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            autoFocus
            required
            aria-invalid={error !== null}
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="button button--primary button--large"
          disabled={busy || password === ''}
        >
          <Icon name="unlock" />
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this vault?"
          message="Everything stored in this vault will be erased from this browser. Without a backup and its password, it cannot be brought back."
          confirmLabel="Delete vault"
          onConfirm={destroy}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </AuthLayout>
  );
}
