import type { Envelope, Session } from '../crypto/envelope';
import { createSession, open, seal } from '../crypto/envelope';
import type { VaultData } from './model';
import { createEmptyVault, parseVaultData } from './model';

export interface UnlockedVault {
  data: VaultData;
  session: Session;
  envelope: Envelope;
}

/**
 * Creates a vault protected by `password`.
 *
 * Also used to change the master password: passing the existing `data` yields
 * a new salt, a new key and a fresh encryption of the same contents.
 */
export async function createVault(
  password: string,
  data: VaultData = createEmptyVault(),
  iterations?: number,
): Promise<UnlockedVault> {
  const session = await createSession(password, iterations);
  const envelope = await seal(session, JSON.stringify(data));
  return { data, session, envelope };
}

/** Decrypts a vault. Throws `DecryptionError` when the password is wrong. */
export async function unlockVault(envelope: Envelope, password: string): Promise<UnlockedVault> {
  const { plaintext, session } = await open(envelope, password);
  return { data: parseVaultData(plaintext), session, envelope };
}

/** Re-encrypts the vault contents under the session key with a fresh IV. */
export function sealVault(session: Session, data: VaultData): Promise<Envelope> {
  return seal(session, JSON.stringify(data));
}
