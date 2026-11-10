import { useState } from 'react';
import { ConfirmDialog } from './components/Dialog';
import { Icon } from './components/Icon';
import { AuthLayout } from './screens/AuthLayout';
import { SetupScreen } from './screens/SetupScreen';
import { UnlockScreen } from './screens/UnlockScreen';
import { Workspace } from './screens/Workspace';
import { useVault } from './state/vault-context';

/** Shown when the stored data exists but is not a vault this version can read. */
function UnreadableScreen({ message }: { message: string }) {
  const { destroy } = useVault();
  const [confirming, setConfirming] = useState(false);

  return (
    <AuthLayout title="This vault cannot be read" cardTitle="Nothing has been deleted" cardText={message}>
      <div className="stack">
        <p className="callout">
          If a newer version of Enclave wrote this vault, open it with that version. Otherwise you
          can remove it and start again.
        </p>
        <button type="button" className="button button--large button--danger" onClick={() => setConfirming(true)}>
          <Icon name="trash" />
          Delete stored data
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title="Delete stored data?"
          message="The unreadable vault data will be erased from this browser. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={destroy}
          onCancel={() => setConfirming(false)}
        />
      )}
    </AuthLayout>
  );
}

export function App() {
  const { state } = useVault();

  switch (state.status) {
    case 'empty':
      return <SetupScreen />;
    case 'unreadable':
      return <UnreadableScreen message={state.message} />;
    case 'locked':
      return <UnlockScreen notice={state.notice} />;
    case 'unlocked':
      return <Workspace />;
  }
}
