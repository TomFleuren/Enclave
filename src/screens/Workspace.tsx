import { useState } from 'react';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAutoLock } from '../hooks/useAutoLock';
import { useUnlockedVault, useVault } from '../state/vault-context';
import { AuthenticatorView } from '../views/AuthenticatorView';
import { GeneratorView } from '../views/GeneratorView';
import { SettingsView } from '../views/SettingsView';
import { VaultView } from '../views/VaultView';

type ViewId = 'vault' | 'authenticator' | 'generator' | 'settings';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'vault', label: 'Vault' },
  { id: 'authenticator', label: 'Authenticator' },
  { id: 'generator', label: 'Generator' },
  { id: 'settings', label: 'Settings' },
];

/** The unlocked app: the sections in the header, the selected one below it. */
export function Workspace() {
  const { lock } = useVault();
  const { data } = useUnlockedVault();
  const [view, setView] = useState<ViewId>('vault');

  useAutoLock({
    idleMinutes: data.settings.autoLockMinutes,
    lockOnHide: data.settings.lockOnHide,
    onLock: lock,
  });

  return (
    <div className="workspace">
      <Header
        nav={
          <nav className="header__nav" aria-label="Sections">
            {VIEWS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={view === id ? 'nav-item is-active' : 'nav-item'}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </nav>
        }
        action={
          <button type="button" className="pill-button" onClick={() => lock()}>
            <Icon name="lock" size={16} />
            Lock
          </button>
        }
      />

      <main className="workspace__main">
        {view === 'vault' && <VaultView />}
        {view === 'authenticator' && <AuthenticatorView onOpenVault={() => setView('vault')} />}
        {view === 'generator' && <GeneratorView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
