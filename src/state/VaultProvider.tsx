import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Envelope, Session } from '../crypto/envelope';
import type { VaultData } from '../vault/model';
import type { VaultStorage } from '../vault/storage';
import type { UnlockedVault } from '../vault/vault';
import { createVault, sealVault, unlockVault } from '../vault/vault';
import type { VaultController, VaultState } from './vault-context';
import { VaultContext } from './vault-context';

function readStorage(storage: VaultStorage, notice: string | null = null): VaultState {
  try {
    const envelope = storage.load();
    return envelope ? { status: 'locked', envelope, notice } : { status: 'empty' };
  } catch (error) {
    return {
      status: 'unreadable',
      message: error instanceof Error ? error.message : 'The stored vault could not be read.',
    };
  }
}

interface VaultProviderProps {
  storage: VaultStorage;
  /** Starts unlocked with this vault. Only used by the development demo. */
  initial?: UnlockedVault;
  children: ReactNode;
}

export function VaultProvider({ storage, initial, children }: VaultProviderProps) {
  const [state, setState] = useState<VaultState>(() =>
    initial
      ? { status: 'unlocked', envelope: initial.envelope, data: initial.data }
      : readStorage(storage),
  );

  // The key and the latest decrypted contents live in refs so that saving does
  // not depend on which render a callback was created in.
  const sessionRef = useRef<Session | null>(initial?.session ?? null);
  const dataRef = useRef<VaultData | null>(initial?.data ?? null);

  // Saves run one at a time, in order, so an older encryption of the vault can
  // never overwrite a newer one.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  // Bumped whenever the stored vault is replaced wholesale, which makes any
  // save that was still queued for the old vault a no-op.
  const generation = useRef(0);

  const enter = useCallback((vault: UnlockedVault) => {
    sessionRef.current = vault.session;
    dataRef.current = vault.data;
    setState({ status: 'unlocked', envelope: vault.envelope, data: vault.data });
  }, []);

  const lock = useCallback(
    (notice?: string) => {
      if (sessionRef.current === null) return;
      sessionRef.current = null;
      dataRef.current = null;
      setState((current) =>
        current.status === 'unlocked'
          ? { status: 'locked', envelope: current.envelope, notice: notice ?? null }
          : current,
      );
      // A save may still be in flight. Once it has landed, pick up what is
      // actually in storage so the locked state does not hold a stale copy.
      void saveQueue.current.then(() => {
        if (sessionRef.current === null) setState(readStorage(storage, notice ?? null));
      });
    },
    [storage],
  );

  const create = useCallback(
    async (password: string) => {
      const vault = await createVault(password);
      generation.current += 1;
      storage.save(vault.envelope);
      enter(vault);
    },
    [storage, enter],
  );

  const unlock = useCallback(
    async (password: string) => {
      await saveQueue.current;
      const envelope = storage.load();
      if (!envelope) {
        setState({ status: 'empty' });
        return;
      }
      enter(await unlockVault(envelope, password));
    },
    [storage, enter],
  );

  const mutate = useCallback(
    (change: (data: VaultData) => VaultData) => {
      const session = sessionRef.current;
      const current = dataRef.current;
      if (!session || !current) {
        return Promise.reject(new Error('The vault is locked.'));
      }

      const next = change(current);
      dataRef.current = next;
      setState((previous) =>
        previous.status === 'unlocked' ? { ...previous, data: next } : previous,
      );

      const savedGeneration = generation.current;
      const save = saveQueue.current.then(async () => {
        if (generation.current !== savedGeneration) return;
        const envelope: Envelope = await sealVault(session, next);
        if (generation.current !== savedGeneration) return;
        storage.save(envelope);
        setState((previous) =>
          previous.status === 'unlocked' ? { ...previous, envelope } : previous,
        );
      });
      // Keep the queue alive after a failed save; the caller still sees the error.
      saveQueue.current = save.catch(() => {});
      return save;
    },
    [storage],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await saveQueue.current;
      const stored = storage.load();
      if (!stored || !dataRef.current) {
        throw new Error('The vault is locked.');
      }
      // Proves the person at the keyboard knows the current password, rather
      // than having walked up to an unlocked vault.
      await unlockVault(stored, currentPassword);

      const vault = await createVault(newPassword, dataRef.current);
      generation.current += 1;
      storage.save(vault.envelope);
      enter(vault);
    },
    [storage, enter],
  );

  const restore = useCallback(
    async (backup: Envelope, password: string) => {
      const vault = await unlockVault(backup, password);
      await saveQueue.current;
      generation.current += 1;
      storage.save(vault.envelope);
      enter(vault);
    },
    [storage, enter],
  );

  const destroy = useCallback(() => {
    generation.current += 1;
    sessionRef.current = null;
    dataRef.current = null;
    storage.clear();
    setState({ status: 'empty' });
  }, [storage]);

  // Another tab changed the stored vault. Carrying on here would overwrite
  // that change with this tab's older copy, so lock and reload instead.
  useEffect(
    () =>
      storage.subscribe(() => {
        if (sessionRef.current !== null) {
          lock('The vault was changed in another tab. Unlock it again to load the latest version.');
        } else {
          setState(readStorage(storage));
        }
      }),
    [storage, lock],
  );

  const controller = useMemo<VaultController>(
    () => ({ state, create, unlock, lock, mutate, changePassword, restore, destroy }),
    [state, create, unlock, lock, mutate, changePassword, restore, destroy],
  );

  return <VaultContext.Provider value={controller}>{children}</VaultContext.Provider>;
}
