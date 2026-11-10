import type { FormEvent } from 'react';
import { useState } from 'react';
import type { IconName } from '../components/Icon';
import { Icon } from '../components/Icon';
import { PasswordInput } from '../components/PasswordInput';
import { RestoreBackup } from '../components/RestoreBackup';
import { StrengthMeter } from '../components/StrengthMeter';
import { useVault } from '../state/vault-context';
import { MASTER_PASSWORD_MIN_LENGTH } from '../vault/model';
import { AuthLayout } from './AuthLayout';

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'lock',
    title: 'Encrypted before it is saved',
    text: 'AES-256-GCM, with a key derived from your master password. Only ciphertext reaches storage.',
  },
  {
    icon: 'shield',
    title: 'No account, no server',
    text: 'The page is not allowed to make network requests. What you store stays in this browser.',
  },
  {
    icon: 'download',
    title: 'Yours to back up',
    text: 'Export an encrypted backup file whenever you like, and restore it in any browser.',
  },
];

function Promises() {
  return (
    <ul className="promises">
      {PROMISES.map(({ icon, title, text }) => (
        <li key={title} className="promise">
          <Icon name={icon} size={24} />
          <div>
            <h3 className="promise__title">{title}</h3>
            <p className="promise__text">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

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
      cardTitle="Choose a master password"
      cardText="It is the only key to everything you store here."
      after={<Promises />}
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
          className="button button--large button--primary"
          disabled={busy || !acknowledged || password === '' || confirmation === ''}
        >
          {busy ? 'Deriving key…' : 'Create vault'}
        </button>
      </form>

      <RestoreBackup
        label="Restore from a backup instead"
        className="link-button"
        showIcon={false}
        replacesExisting={false}
      />
    </AuthLayout>
  );
}
