import type { Envelope } from '../crypto/envelope';
import { parseEnvelopeText } from '../crypto/envelope';

export const STORAGE_KEY = 'enclave.vault';

/**
 * Where the encrypted vault is kept. Only an `Envelope` ever crosses this
 * boundary, so nothing readable is written to disk.
 */
export interface VaultStorage {
  /** Returns the stored vault, `null` when there is none. Throws if it is unreadable. */
  load(): Envelope | null;
  save(envelope: Envelope): void;
  clear(): void;
  /** Calls `listener` when another tab changes the stored vault. */
  subscribe(listener: () => void): () => void;
}

export function createLocalStorage(storage: Storage = window.localStorage): VaultStorage {
  return {
    load() {
      const text = storage.getItem(STORAGE_KEY);
      return text === null ? null : parseEnvelopeText(text);
    },
    save(envelope) {
      storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    },
    clear() {
      storage.removeItem(STORAGE_KEY);
    },
    subscribe(listener) {
      // The storage event only fires in tabs other than the one that wrote.
      const onStorage = (event: StorageEvent) => {
        if (event.storageArea === storage && (event.key === STORAGE_KEY || event.key === null)) {
          listener();
        }
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
}

/** Keeps the vault in memory only. Used by tests and the development demo. */
export function createMemoryStorage(initial: Envelope | null = null): VaultStorage {
  let current = initial;
  return {
    load: () => current,
    save(envelope) {
      current = envelope;
    },
    clear() {
      current = null;
    },
    subscribe: () => () => {},
  };
}
