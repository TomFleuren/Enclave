import type { FormEvent } from 'react';
import { useState } from 'react';
import { ConfirmDialog, Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { PageHead } from '../components/PageHead';
import { PasswordInput } from '../components/PasswordInput';
import { RestoreBackup } from '../components/RestoreBackup';
import { StrengthMeter } from '../components/StrengthMeter';
import { DecryptionError } from '../crypto/envelope';
import { useFeedback } from '../state/feedback-context';
import { useUnlockedVault, useVault } from '../state/vault-context';
import { downloadBackup } from '../vault/backup';
import type { VaultSettings } from '../vault/model';
import {
  AUTO_LOCK_OPTIONS,
  CLIPBOARD_CLEAR_OPTIONS,
  MASTER_PASSWORD_MIN_LENGTH,
  updateSettings,
} from '../vault/model';

function autoLockLabel(minutes: number): string {
  if (minutes === 0) return 'Never';
  if (minutes === 60) return 'After 1 hour';
  return `After ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function clipboardLabel(seconds: number): string {
  return seconds === 0 ? 'Never' : `After ${seconds} seconds`;
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { changePassword } = useVault();
  const { notify } = useFeedback();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (next.length < MASTER_PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${MASTER_PASSWORD_MIN_LENGTH} characters for the new password.`);
      return;
    }
    if (next !== confirmation) {
      setError('The two new passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      notify('Master password changed.', 'success');
      onClose();
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof DecryptionError
          ? 'The current password is not right.'
          : 'The master password could not be changed.',
      );
    }
  };

  return (
    <Dialog title="Change master password" onClose={onClose}>
      <form onSubmit={onSubmit} className="stack">
        <p className="dialog__text">
          The vault is re-encrypted with a key derived from the new password. Backups made earlier
          still open with the password they were made with.
        </p>
        <label className="field">
          <span className="field__label">Current password</span>
          <PasswordInput
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        <div className="field-group">
          <label className="field">
            <span className="field__label">New password</span>
            <PasswordInput value={next} onChange={setNext} autoComplete="new-password" required />
          </label>
          <StrengthMeter password={next} />
        </div>
        <label className="field">
          <span className="field__label">Confirm new password</span>
          <PasswordInput
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <button type="submit" className="button button--large button--primary" disabled={busy}>
            {busy ? 'Re-encrypting…' : 'Change password'}
          </button>
          <button type="button" className="button button--large button--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function SettingsView() {
  const { mutate, destroy } = useVault();
  const { data, envelope } = useUnlockedVault();
  const { notify } = useFeedback();

  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { settings } = data;

  const change = (patch: Partial<VaultSettings>) => {
    mutate((current) => updateSettings(current, patch)).catch(() =>
      notify('The setting could not be saved to this browser.', 'error'),
    );
  };

  return (
    <div className="page page--aside">
      <PageHead tag="settings" title="Settings">
        These are stored inside the encrypted vault.
      </PageHead>

      <div className="page__body">
        <h2 className="section-title">Security</h2>
        <section className="card settings-group">
          <label className="setting">
            <span className="setting__text">
              <span className="setting__label">Lock automatically</span>
              <span className="setting__hint">When there has been no activity in this tab</span>
            </span>
            <select
              className="select"
              value={settings.autoLockMinutes}
              onChange={(event) => change({ autoLockMinutes: Number(event.target.value) })}
            >
              {AUTO_LOCK_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {autoLockLabel(minutes)}
                </option>
              ))}
            </select>
          </label>

          <label className="setting">
            <span className="setting__text">
              <span className="setting__label">Lock when the tab is hidden</span>
              <span className="setting__hint">On switching tabs or minimising the window</span>
            </span>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              checked={settings.lockOnHide}
              onChange={(event) => change({ lockOnHide: event.target.checked })}
            />
          </label>

          <label className="setting">
            <span className="setting__text">
              <span className="setting__label">Clear the clipboard</span>
              <span className="setting__hint">After copying a password or a one-time code</span>
            </span>
            <select
              className="select"
              value={settings.clipboardClearSeconds}
              onChange={(event) => change({ clipboardClearSeconds: Number(event.target.value) })}
            >
              {CLIPBOARD_CLEAR_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {clipboardLabel(seconds)}
                </option>
              ))}
            </select>
          </label>

          <div className="setting">
            <span className="setting__text">
              <span className="setting__label">Master password</span>
              <span className="setting__hint">Re-encrypts the vault under a new key</span>
            </span>
            <button type="button" className="button button--ghost" onClick={() => setChangingPassword(true)}>
              Change
            </button>
          </div>
        </section>

        <h2 className="section-title">Backup</h2>
        <section className="card settings-group">
          <div className="setting">
            <span className="setting__text">
              <span className="setting__label">Export an encrypted backup</span>
              <span className="setting__hint">A file that only opens with your current master password</span>
            </span>
            <button type="button" className="button button--ghost" onClick={() => downloadBackup(envelope)}>
              <Icon name="download" size={16} />
              Export
            </button>
          </div>

          <div className="setting">
            <span className="setting__text">
              <span className="setting__label">Restore from a backup</span>
              <span className="setting__hint">Replaces the vault that is in this browser</span>
            </span>
            <RestoreBackup label="Restore" className="button button--ghost" replacesExisting />
          </div>
        </section>

        <h2 className="section-title">Encryption</h2>
        <dl className="facts">
          <div className="fact">
            <dt>Cipher</dt>
            <dd>AES-256-GCM</dd>
          </div>
          <div className="fact">
            <dt>Key derivation</dt>
            <dd>PBKDF2-HMAC-SHA-256, {envelope.kdf.iterations.toLocaleString('en-US')} iterations</dd>
          </div>
          <div className="fact">
            <dt>Stored</dt>
            <dd>In this browser only, as ciphertext</dd>
          </div>
          <div className="fact">
            <dt>Items</dt>
            <dd>{data.items.length}</dd>
          </div>
        </dl>

        <h2 className="section-title">Danger zone</h2>
        <section className="card settings-group settings-group--danger">
          <div className="setting">
            <span className="setting__text">
              <span className="setting__label">Delete this vault</span>
              <span className="setting__hint">Erases everything from this browser, permanently</span>
            </span>
            <button
              type="button"
              className="button button--ghost button--warn"
              onClick={() => setConfirmingDelete(true)}
            >
              <Icon name="trash" size={16} />
              Delete
            </button>
          </div>
        </section>
      </div>

      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this vault?"
          message="Everything stored in this vault will be erased from this browser. Without a backup and its password, it cannot be brought back."
          confirmLabel="Delete vault"
          onConfirm={destroy}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
