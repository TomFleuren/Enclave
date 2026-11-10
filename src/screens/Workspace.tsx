import { useState } from 'react';
import { Brand } from '../components/Brand';
import type { IconName } from '../components/Icon';
import { Icon } from '../components/Icon';
import { useAutoLock } from '../hooks/useAutoLock';
import { useUnlockedVault, useVault } from '../state/vault-context';
import { AuthenticatorView } from '../views/AuthenticatorView';
import { GeneratorView } from '../views/GeneratorView';
import { SettingsView } from '../views/SettingsView';
import { VaultView } from '../views/VaultView';

type ViewId = 'vault' | 'authenticator' | 'generator' | 'settings';

const VIEWS: { id: ViewId; label: string; icon: IconName }[] = [
  { id: 'vault', label: 'Vault', icon: 'vault' },
  { id: 'authenticator', label: 'Authenticator', icon: 'clock' },
  { id: 'generator', label: 'Generator', icon: 'dice' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

/** The unlocked app: navigation on the side, the selected view beside it. */
export function Workspace() {
  const { lock } = useVault();
  const { data } = useUnlockedVault();
  const [view, setView] = useState<ViewId>('vault');

  useAutoLock({
    idleMinutes: data.settings.autoLockMinutes,
    lockOnHide: data.settings.lockOnHide,
    onLock: lock,
  });

  const codeCount = data.items.filter((item) => item.totp !== null).length;
  const counts: Partial<Record<ViewId, number>> = {
    vault: data.items.length,
    authenticator: codeCount,
  };

  return (
    <div className="workspace">
      <aside className="sidebar glass">
        <div className="sidebar__brand">
          <Brand />
        </div>

        <nav className="sidebar__nav" aria-label="Sections">
          {VIEWS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={view === id ? 'nav-item is-active' : 'nav-item'}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
            >
              <Icon name={icon} size={20} />
              <span className="nav-item__label">{label}</span>
              {counts[id] !== undefined && counts[id] > 0 && (
                <span className="nav-item__count">{counts[id]}</span>
              )}
            </button>
          ))}
        </nav>

        <button type="button" className="nav-item nav-item--lock" onClick={() => lock()}>
          <Icon name="lock" size={20} />
          <span className="nav-item__label">Lock</span>
        </button>
      </aside>

      <main className="workspace__main">
        {view === 'vault' && <VaultView />}
        {view === 'authenticator' && <AuthenticatorView onOpenVault={() => setView('vault')} />}
        {view === 'generator' && <GeneratorView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
