import { createContext, useContext } from 'react';
import type { Envelope } from '../crypto/envelope';
import type { VaultData } from '../vault/model';

export type VaultState =
  /** Nothing has been stored in this browser yet. */
  | { status: 'empty' }
  /** Something is stored under the vault key, but it is not a readable vault. */
  | { status: 'unreadable'; message: string }
  | { status: 'locked'; envelope: Envelope; notice: string | null }
  | { status: 'unlocked'; envelope: Envelope; data: VaultData };

export interface VaultController {
  state: VaultState;
  /** Creates a new, empty vault and unlocks it. */
  create(password: string): Promise<void>;
  /** Throws `DecryptionError` when the password is wrong. */
  unlock(password: string): Promise<void>;
  /** Drops the key and the decrypted contents from memory. */
  lock(notice?: string): void;
  /** Applies a change to the vault and saves the re-encrypted result. */
  mutate(change: (data: VaultData) => VaultData): Promise<void>;
  /** Re-encrypts the vault under a new master password. */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /**
   * Replaces the vault in this browser with a backup, but only after the
   * backup has been decrypted successfully with `password`.
   */
  restore(backup: Envelope, password: string): Promise<void>;
  /** Permanently deletes the vault from this browser. */
  destroy(): void;
}

export const VaultContext = createContext<VaultController | null>(null);

export function useVault(): VaultController {
  const controller = useContext(VaultContext);
  if (!controller) {
    throw new Error('useVault must be used inside a VaultProvider');
  }
  return controller;
}

/** The decrypted vault. Only call from components rendered while unlocked. */
export function useUnlockedVault(): { data: VaultData; envelope: Envelope } {
  const { state } = useVault();
  if (state.status !== 'unlocked') {
    throw new Error('The vault is locked');
  }
  return state;
}
