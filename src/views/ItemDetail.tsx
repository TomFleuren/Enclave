import type { ReactNode } from 'react';
import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { CodeDigits, CountdownRing } from '../components/TotpCode';
import type { TotpConfig } from '../crypto/totp';
import { useTotp } from '../hooks/useTotp';
import { useFeedback } from '../state/feedback-context';
import type { VaultItem } from '../vault/model';
import { displayHost, toWebUrl } from '../vault/url';

interface ItemDetailProps {
  item: VaultItem;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// A fixed number of dots, so the mask does not give away the length.
const MASK = '•'.repeat(12);

function Row({ label, children, actions }: { label: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="detail-row">
      <div className="detail-row__content">
        <span className="detail-row__label">{label}</span>
        <div className="detail-row__value">{children}</div>
      </div>
      {actions && <div className="detail-row__actions">{actions}</div>}
    </div>
  );
}

function CopyButton({ onCopy, label }: { onCopy: () => void; label: string }) {
  return (
    <button type="button" className="icon-button" onClick={onCopy} aria-label={label} title={label}>
      <Icon name="copy" />
    </button>
  );
}

function CodeRow({ config }: { config: TotpConfig }) {
  const { copy } = useFeedback();
  const reading = useTotp(config);

  return (
    <Row
      label="One-time code"
      actions={
        <>
          <CountdownRing reading={reading} />
          <CopyButton
            label="Copy code"
            onCopy={() => reading.code && void copy(reading.code, 'Code', { sensitive: true })}
          />
        </>
      }
    >
      <CodeDigits reading={reading} config={config} />
    </Row>
  );
}

export function ItemDetail({ item, onBack, onEdit, onDelete, onToggleFavorite }: ItemDetailProps) {
  const { copy } = useFeedback();
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const href = toWebUrl(item.url);

  return (
    <article className="panel glass detail">
      <header className="detail__header">
        <button type="button" className="icon-button detail__back" onClick={onBack} aria-label="Back to the list">
          <Icon name="back" />
        </button>
        <Avatar title={item.title} size="large" />
        <div className="detail__heading">
          <h2 className="detail__title">{item.title}</h2>
          {item.url && <p className="detail__subtitle">{displayHost(item.url)}</p>}
        </div>
        <div className="detail__actions">
          <button
            type="button"
            className={item.favorite ? 'icon-button is-favorite' : 'icon-button'}
            onClick={onToggleFavorite}
            aria-label={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={item.favorite}
            title={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Icon name="star" filled={item.favorite} />
          </button>
          <button type="button" className="icon-button" onClick={onEdit} aria-label="Edit" title="Edit">
            <Icon name="edit" />
          </button>
          <button
            type="button"
            className="icon-button icon-button--danger"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete"
            title="Delete"
          >
            <Icon name="trash" />
          </button>
        </div>
      </header>

      <div className="detail__rows">
        {item.username && (
          <Row
            label="Username"
            actions={<CopyButton label="Copy username" onCopy={() => void copy(item.username, 'Username')} />}
          >
            <span className="selectable">{item.username}</span>
          </Row>
        )}

        {item.password && (
          <Row
            label="Password"
            actions={
              <>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setRevealed((current) => !current)}
                  aria-label={revealed ? 'Hide password' : 'Show password'}
                  aria-pressed={revealed}
                  title={revealed ? 'Hide password' : 'Show password'}
                >
                  <Icon name={revealed ? 'eyeOff' : 'eye'} />
                </button>
                <CopyButton
                  label="Copy password"
                  onCopy={() => void copy(item.password, 'Password', { sensitive: true })}
                />
              </>
            }
          >
            <span className={revealed ? 'secret selectable' : 'secret secret--masked'}>
              {revealed ? item.password : MASK}
            </span>
          </Row>
        )}

        {item.totp && <CodeRow config={item.totp} />}

        {item.url && (
          <Row
            label="Website"
            actions={
              href && (
                <a
                  className="icon-button"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open website in a new tab"
                  title="Open website"
                >
                  <Icon name="external" />
                </a>
              )
            }
          >
            <span className="selectable">{item.url}</span>
          </Row>
        )}

        {item.notes && (
          <Row label="Notes">
            <p className="notes selectable">{item.notes}</p>
          </Row>
        )}

        {!item.username && !item.password && !item.totp && !item.url && !item.notes && (
          <p className="detail__empty">This item has no details yet.</p>
        )}
      </div>

      <footer className="detail__meta">
        <span>Updated {dateFormat.format(item.updatedAt)}</span>
        <span>Created {dateFormat.format(item.createdAt)}</span>
      </footer>

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete “${item.title}”?`}
          message="This item will be removed from the vault. This cannot be undone."
          confirmLabel="Delete item"
          onConfirm={onDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </article>
  );
}
