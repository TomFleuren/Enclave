import type { FormEvent } from 'react';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { PasswordInput } from '../components/PasswordInput';
import { RestoreBackup } from '../components/RestoreBackup';
import { StrengthMeter } from '../components/StrengthMeter';
import { useVault } from '../state/vault-context';
import { MASTER_PASSWORD_MIN_LENGTH } from '../vault/model';
import { AuthLayout } from './AuthLayout';

export function SetupScreen() {
  const { create } = useVault();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (password.length < MASTER_PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${MASTER_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await create(password);
    } catch {
      setBusy(false);
      setError('The vault could not be saved. Check that this browser allows site storage.');
    }
  };

  return (
    <AuthLayout
      title="Create your vault"
      subtitle="Choose a master password. It is the only key to everything you store here."
      footer={
        <RestoreBackup
          label="Restore from a backup instead"
          className="link-button"
          replacesExisting={false}
        />
      }
    >
      <form onSubmit={onSubmit} className="stack">
        <div className="field-group">
          <label className="field">
            <span className="field__label">Master password</span>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              autoFocus
              required
            />
          </label>
          <StrengthMeter password={password} />
        </div>

        <label className="field">
          <span className="field__label">Confirm master password</span>
          <PasswordInput
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
            required
          />
        </label>

        <label className="callout callout--warning">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            I understand that a forgotten master password cannot be reset or recovered, by anyone.
          </span>
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="button button--primary button--large"
          disabled={busy || !acknowledged || password === '' || confirmation === ''}
        >
          <Icon name="shield" />
          {busy ? 'Deriving key…' : 'Create vault'}
        </button>
      </form>
    </AuthLayout>
  );
}
