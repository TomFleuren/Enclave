import type { FormEvent } from 'react';
import { useId, useState } from 'react';
import { Icon } from '../components/Icon';
import { PasswordInput } from '../components/PasswordInput';
import { StrengthMeter } from '../components/StrengthMeter';
import { generatePassword, GENERATOR_DEFAULTS } from '../crypto/password';
import type { TotpConfig } from '../crypto/totp';
import { normalizeSecret, parseTotpInput } from '../crypto/totp';
import type { VaultItem, VaultItemDraft } from '../vault/model';
import { EMPTY_DRAFT } from '../vault/model';

interface ItemEditorProps {
  /** The item being edited, or `null` when creating a new one. */
  item: VaultItem | null;
  onSave: (draft: VaultItemDraft) => Promise<void>;
  onCancel: () => void;
}

function sameSecret(input: string, existing: TotpConfig | null): boolean {
  if (!existing) return false;
  try {
    return normalizeSecret(input) === existing.secret;
  } catch {
    return false;
  }
}

export function ItemEditor({ item, onSave, onCancel }: ItemEditorProps) {
  const [draft, setDraft] = useState<VaultItemDraft>(() =>
    item
      ? {
          title: item.title,
          username: item.username,
          password: item.password,
          url: item.url,
          notes: item.notes,
          totp: item.totp,
          favorite: item.favorite,
        }
      : EMPTY_DRAFT,
  );
  const totpHintId = useId();
  const [totpInput, setTotpInput] = useState(item?.totp?.secret ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <Key extends keyof VaultItemDraft>(key: Key, value: VaultItemDraft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    let { title, username } = draft;
    let totp: TotpConfig | null = null;

    if (totpInput.trim() !== '') {
      if (sameSecret(totpInput, draft.totp)) {
        // Unchanged: keep the stored digits, period and algorithm as they are.
        totp = draft.totp;
      } else {
        try {
          const parsed = parseTotpInput(totpInput);
          totp = parsed.config;
          // A setup link names the service and the account, so use them
          // for anything that was left blank.
          title = title.trim() || parsed.issuer;
          username = username.trim() || parsed.account;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'The authenticator key is not valid.');
          return;
        }
      }
    }

    if (title.trim() === '') {
      setError('Give the item a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({ ...draft, title: title.trim(), username: username.trim(), url: draft.url.trim(), totp });
    } catch {
      setSaving(false);
      setError('The item could not be saved.');
    }
  };

  return (
    <form className="editor" onSubmit={onSubmit}>
      <header className="panel__header">
        <h2 className="panel__title">{item ? 'Edit item' : 'New item'}</h2>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Cancel" title="Cancel">
          <Icon name="close" />
        </button>
      </header>

      <div className="editor__fields">
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="input"
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="GitHub"
            autoComplete="off"
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">Username or email</span>
          <input
            className="input"
            value={draft.username}
            onChange={(event) => set('username', event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>

        <div className="field-group">
          <label className="field">
            <span className="field__label">Password</span>
            <PasswordInput
              value={draft.password}
              onChange={(value) => set('password', value)}
              autoComplete="off"
              monospace
              actions={
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => set('password', generatePassword(GENERATOR_DEFAULTS))}
                  aria-label="Generate a password"
                  title="Generate a password"
                >
                  <Icon name="dice" />
                </button>
              }
            />
          </label>
          <StrengthMeter password={draft.password} />
        </div>

        <label className="field">
          <span className="field__label">Website</span>
          <input
            className="input"
            value={draft.url}
            onChange={(event) => set('url', event.target.value)}
            placeholder="https://github.com"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>

        <div className="field-group">
          <label className="field">
            <span className="field__label">Authenticator key</span>
            <PasswordInput
              value={totpInput}
              onChange={setTotpInput}
              autoComplete="off"
              monospace
              placeholder="Secret key or otpauth:// link"
              aria-describedby={totpHintId}
            />
          </label>
          <span className="field__hint" id={totpHintId}>
            The key a site shows when you turn on two-factor authentication. Leave empty if there
            is none.
          </span>
        </div>

        <label className="field">
          <span className="field__label">Notes</span>
          <textarea
            className="input input--area"
            value={draft.notes}
            onChange={(event) => set('notes', event.target.value)}
            rows={4}
          />
        </label>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <footer className="panel__footer">
        <button type="button" className="button button--large button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--large button--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </form>
  );
}
