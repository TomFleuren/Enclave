import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { PageHead } from '../components/PageHead';
import { CodeDigits, CountdownRing } from '../components/TotpCode';
import type { TotpConfig } from '../crypto/totp';
import { useTotp } from '../hooks/useTotp';
import { useFeedback } from '../state/feedback-context';
import { useUnlockedVault } from '../state/vault-context';
import type { VaultItem } from '../vault/model';
import { sortItems } from '../vault/model';

function CodeCard({ item, config }: { item: VaultItem; config: TotpConfig }) {
  const { copy } = useFeedback();
  const reading = useTotp(config);

  return (
    <button
      type="button"
      className="code-card"
      onClick={() => reading.code && void copy(reading.code, 'Code', { sensitive: true })}
      aria-label={`Copy the code for ${item.title}`}
    >
      <span className="code-card__header">
        <Avatar title={item.title} />
        <span className="item__text">
          <span className="item__title">{item.title}</span>
          <span className="item__subtitle">{item.username || 'No username'}</span>
        </span>
        <CountdownRing reading={reading} size={30} />
      </span>
      <span className="code-card__code">
        <CodeDigits reading={reading} config={config} />
        <span className="code-card__hint">
          <Icon name="copy" size={14} />
          Copy
        </span>
      </span>
    </button>
  );
}

export function AuthenticatorView({ onOpenVault }: { onOpenVault: () => void }) {
  const { data } = useUnlockedVault();
  const items = sortItems(data.items).filter((item) => item.totp !== null);

  return (
    <div className="page">
      <PageHead tag="authenticator" title="Authenticator">
        One-time codes for your two-factor logins. Select one to copy it.
      </PageHead>

      {items.length > 0 ? (
        <div className="code-grid">
          {items.map((item) => item.totp && <CodeCard key={item.id} item={item} config={item.totp} />)}
        </div>
      ) : (
        <div className="placeholder placeholder--inline">
          <span className="placeholder__icon">
            <Icon name="clock" size={24} />
          </span>
          <h2 className="placeholder__title">No codes yet</h2>
          <p className="placeholder__text">
            Add an authenticator key to an item in your vault and its one-time code will show up
            here.
          </p>
          <button type="button" className="button button--primary" onClick={onOpenVault}>
            Go to the vault
          </button>
        </div>
      )}
    </div>
  );
}
