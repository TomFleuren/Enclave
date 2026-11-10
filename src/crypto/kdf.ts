import type { Bytes } from './encoding';
import { utf8Encode } from './encoding';

/**
 * PBKDF2-HMAC-SHA-256 work factor for new vaults. 600,000 is the figure OWASP
 * recommends for this construction (Password Storage Cheat Sheet).
 */
export const KDF_DEFAULT_ITERATIONS = 600_000;

/**
 * Bounds accepted when opening an existing vault or backup.
 *
 * The lower bound stops a tampered file from quietly downgrading the work
 * factor. The upper bound stops a hostile file from freezing the tab.
 */
export const KDF_MIN_ITERATIONS = 100_000;
export const KDF_MAX_ITERATIONS = 10_000_000;

export const KDF_SALT_BYTES = 16;

/**
 * Stretches the master password into a 256-bit AES-GCM key.
 *
 * The resulting key is non-extractable: it can be used to encrypt and decrypt,
 * but its raw bytes cannot be read back out by script.
 */
export async function deriveKey(
  password: string,
  salt: Bytes,
  iterations: number,
): Promise<CryptoKey> {
  // NFKC, so the same password typed on a different keyboard or operating
  // system produces the same bytes.
  const passwordBytes = utf8Encode(password.normalize('NFKC'));

  const baseKey = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
