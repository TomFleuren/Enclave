import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthLayout } from './screens/AuthLayout';
import { FeedbackProvider } from './state/FeedbackProvider';
import { VaultProvider } from './state/VaultProvider';
import { createLocalStorage, createMemoryStorage } from './vault/storage';
import type { VaultStorage } from './vault/storage';
import type { UnlockedVault } from './vault/vault';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element');
}
const root = createRoot(container);

function render(storage: VaultStorage, initial?: UnlockedVault) {
  root.render(
    <StrictMode>
      <VaultProvider storage={storage} initial={initial}>
        <FeedbackProvider>
          <App />
        </FeedbackProvider>
      </VaultProvider>
    </StrictMode>,
  );
}

function renderUnsupported() {
  root.render(
    <AuthLayout
      title="Enclave cannot run here"
      cardTitle="A secure page is required"
      cardText="This page needs the Web Crypto API, which browsers only provide on secure origins. Open Enclave over HTTPS or from localhost, in a current browser."
    />,
  );
}

if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) {
  renderUnsupported();
} else if (import.meta.env.DEV && window.location.hash === '#demo') {
  // Development only: an in-memory vault filled with made-up items, used for
  // screenshots. The branch and the module behind it are left out of
  // production builds, and nothing here touches real storage.
  void import('./dev/demo').then(async ({ createDemoVault }) => {
    const vault = await createDemoVault();
    render(createMemoryStorage(vault.envelope), vault);
  });
} else {
  render(createLocalStorage());
}
