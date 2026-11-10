import type { Bytes } from './encoding';
import { fromBase64, randomBytes, toBase64, utf8Decode, utf8Encode } from './encoding';
import {
  deriveKey,
  KDF_DEFAULT_ITERATIONS,
  KDF_MAX_ITERATIONS,
  KDF_MIN_ITERATIONS,
  KDF_SALT_BYTES,
} from './kdf';

export const ENVELOPE_FORMAT = 'enclave-vault';
export const ENVELOPE_VERSION = 1;

const IV_BYTES = 12;

/**
 * What is written to storage and to backup files. Everything in here is safe
 * to disclose: the salt, the IV and the work factor are not secrets, and the
 * ciphertext is useless without the master password.
 */
export interface Envelope {
  format: typeof ENVELOPE_FORMAT;
  version: typeof ENVELOPE_VERSION;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    /** Base64, 16 random bytes, new for every master password. */
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    /** Base64, 12 random bytes, new for every save. */
    iv: string;
  };
  /** Base64 AES-256-GCM output, including the 128-bit authentication tag. */
  ciphertext: string;
}

/**
 * The unlocked state: a derived key and the parameters it was derived with.
 * It only ever lives in memory.
 */
export interface Session {
  key: CryptoKey;
  salt: Bytes;
  iterations: number;
}

/** The password did not decrypt the vault, or the vault was modified. */
export class DecryptionError extends Error {
  constructor() {
    super('Wrong master password, or the vault data has been corrupted.');
    this.name = 'DecryptionError';
  }
}

/** The data is not a vault this version of Enclave can read. */
export class EnvelopeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvelopeFormatError';
  }
}

/**
 * The header is fed to AES-GCM as additional authenticated data, so the
 * format, version and key derivation parameters cannot be altered without
 * decryption failing.
 */
function associatedData(salt: string, iterations: number): Bytes {
  return utf8Encode(
    [ENVELOPE_FORMAT, ENVELOPE_VERSION, 'PBKDF2', 'SHA-256', iterations, salt, 'AES-GCM'].join(
      '|',
    ),
  );
}

export async function createSession(
  password: string,
  iterations: number = KDF_DEFAULT_ITERATIONS,
): Promise<Session> {
  const salt = randomBytes(KDF_SALT_BYTES);
  const key = await deriveKey(password, salt, iterations);
  return { key, salt, iterations };
}

/** Encrypts `plaintext` under the session key with a fresh random IV. */
export async function seal(session: Session, plaintext: string): Promise<Envelope> {
  const iv = randomBytes(IV_BYTES);
  const salt = toBase64(session.salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: associatedData(salt, session.iterations) },
    session.key,
    utf8Encode(plaintext),
  );

  return {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: session.iterations, salt },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Derives the key from `password` and decrypts the envelope.
 *
 * AES-GCM cannot tell a wrong key from modified data: both fail the
 * authentication check, and both surface as a `DecryptionError`.
 */
export async function open(
  envelope: Envelope,
  password: string,
): Promise<{ plaintext: string; session: Session }> {
  const salt = fromBase64(envelope.kdf.salt);
  const key = await deriveKey(password, salt, envelope.kdf.iterations);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(envelope.cipher.iv),
        additionalData: associatedData(envelope.kdf.salt, envelope.kdf.iterations),
      },
      key,
      fromBase64(envelope.ciphertext),
    );
  } catch {
    throw new DecryptionError();
  }

  return {
    plaintext: utf8Decode(new Uint8Array(decrypted)),
    session: { key, salt, iterations: envelope.kdf.iterations },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function base64Length(value: unknown): number {
  if (typeof value !== 'string') return -1;
  try {
    return fromBase64(value).length;
  } catch {
    return -1;
  }
}

/**
 * Validates untrusted input (storage contents or an imported backup file)
 * before any of it is handed to the crypto functions.
 */
export function parseEnvelope(input: unknown): Envelope {
  if (!isRecord(input) || input.format !== ENVELOPE_FORMAT) {
    throw new EnvelopeFormatError('This is not an Enclave vault.');
  }
  if (input.version !== ENVELOPE_VERSION) {
    throw new EnvelopeFormatError(
      'This vault was written by a newer version of Enclave and cannot be opened here.',
    );
  }

  const { kdf, cipher, ciphertext } = input;

  if (!isRecord(kdf) || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') {
    throw new EnvelopeFormatError('The vault uses an unsupported key derivation function.');
  }
  const iterations = kdf.iterations;
  if (
    typeof iterations !== 'number' ||
    !Number.isInteger(iterations) ||
    iterations < KDF_MIN_ITERATIONS ||
    iterations > KDF_MAX_ITERATIONS
  ) {
    throw new EnvelopeFormatError('The vault has an invalid key derivation work factor.');
  }
  if (base64Length(kdf.salt) < KDF_SALT_BYTES) {
    throw new EnvelopeFormatError('The vault has an invalid salt.');
  }

  if (!isRecord(cipher) || cipher.name !== 'AES-GCM') {
    throw new EnvelopeFormatError('The vault uses an unsupported cipher.');
  }
  if (base64Length(cipher.iv) !== IV_BYTES) {
    throw new EnvelopeFormatError('The vault has an invalid IV.');
  }

  // 16 bytes is the authentication tag alone, so anything shorter is truncated.
  if (base64Length(ciphertext) < 16) {
    throw new EnvelopeFormatError('The vault ciphertext is missing or truncated.');
  }

  return {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: kdf.salt as string },
    cipher: { name: 'AES-GCM', iv: cipher.iv as string },
    ciphertext: ciphertext as string,
  };
}

/** Parses the JSON text of a stored vault or a backup file. */
export function parseEnvelopeText(text: string): Envelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new EnvelopeFormatError('This is not an Enclave vault.');
  }
  return parseEnvelope(parsed);
}
