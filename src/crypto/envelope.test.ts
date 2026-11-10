import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Envelope } from './envelope';
import {
  createSession,
  DecryptionError,
  EnvelopeFormatError,
  open,
  parseEnvelope,
  parseEnvelopeText,
  seal,
} from './envelope';
import { fromBase64, toBase64 } from './encoding';
import { KDF_MIN_ITERATIONS } from './kdf';

// The lowest work factor a vault may use, to keep the suite fast.
const ITERATIONS = KDF_MIN_ITERATIONS;
const PASSWORD = 'correct horse battery staple';

async function sealed(plaintext = 'secret contents'): Promise<Envelope> {
  return seal(await createSession(PASSWORD, ITERATIONS), plaintext);
}

function flipFirstByte(base64: string): string {
  const bytes = fromBase64(base64);
  bytes[0] = bytes[0]! ^ 0x01;
  return toBase64(bytes);
}

describe('seal and open', () => {
  it('round-trips with the right password', async () => {
    const envelope = await sealed('héllo 🔐');
    const { plaintext } = await open(envelope, PASSWORD);
    expect(plaintext).toBe('héllo 🔐');
  });

  it('rejects the wrong password', async () => {
    const envelope = await sealed();
    await expect(open(envelope, 'correct horse battery stapler')).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('treats differently composed forms of a password as equal', async () => {
    const session = await createSession('caf\u00e9', ITERATIONS);
    const envelope = await seal(session, 'x');
    const { plaintext } = await open(envelope, 'cafe\u0301');
    expect(plaintext).toBe('x');
  });

  it('does not contain the plaintext', async () => {
    const envelope = await sealed('a very recognisable string');
    expect(JSON.stringify(envelope)).not.toContain('recognisable');
    expect(atob(envelope.ciphertext)).not.toContain('recognisable');
  });

  it('uses a new IV for every save and a new salt for every session', async () => {
    const session = await createSession(PASSWORD, ITERATIONS);
    const first = await seal(session, 'same');
    const second = await seal(session, 'same');
    expect(first.cipher.iv).not.toBe(second.cipher.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.kdf.salt).toBe(second.kdf.salt);

    const other = await seal(await createSession(PASSWORD, ITERATIONS), 'same');
    expect(other.kdf.salt).not.toBe(first.kdf.salt);
  });

  it('lets the session returned by open re-seal for the same password', async () => {
    const { session } = await open(await sealed('one'), PASSWORD);
    const { plaintext } = await open(await seal(session, 'two'), PASSWORD);
    expect(plaintext).toBe('two');
  });
});

describe('tamper detection', () => {
  it('rejects modified ciphertext', async () => {
    const envelope = await sealed();
    const tampered = { ...envelope, ciphertext: flipFirstByte(envelope.ciphertext) };
    await expect(open(tampered, PASSWORD)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects a modified IV', async () => {
    const envelope = await sealed();
    const tampered = { ...envelope, cipher: { ...envelope.cipher, iv: flipFirstByte(envelope.cipher.iv) } };
    await expect(open(tampered, PASSWORD)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects a modified salt', async () => {
    const envelope = await sealed();
    const tampered = { ...envelope, kdf: { ...envelope.kdf, salt: flipFirstByte(envelope.kdf.salt) } };
    await expect(open(tampered, PASSWORD)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects a modified work factor', async () => {
    const envelope = await sealed();
    const tampered = { ...envelope, kdf: { ...envelope.kdf, iterations: ITERATIONS + 1 } };
    await expect(open(tampered, PASSWORD)).rejects.toBeInstanceOf(DecryptionError);
  });
});

describe('interoperability', () => {
  it('produces a vault that an independent implementation can decrypt', async () => {
    // Decrypts with node:crypto instead of Web Crypto, following only the
    // format description, to pin down what is actually written to storage.
    const envelope = await sealed('portable');

    const key = pbkdf2Sync(
      PASSWORD.normalize('NFKC'),
      Buffer.from(envelope.kdf.salt, 'base64'),
      envelope.kdf.iterations,
      32,
      'sha256',
    );
    const raw = Buffer.from(envelope.ciphertext, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.cipher.iv, 'base64'));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    decipher.setAAD(
      Buffer.from(
        `enclave-vault|1|PBKDF2|SHA-256|${envelope.kdf.iterations}|${envelope.kdf.salt}|AES-GCM`,
      ),
    );
    const plaintext = Buffer.concat([
      decipher.update(raw.subarray(0, raw.length - 16)),
      decipher.final(),
    ]).toString('utf8');

    expect(plaintext).toBe('portable');
  });
});

describe('parseEnvelope', () => {
  it('accepts what seal produces, after a trip through JSON', async () => {
    const envelope = await sealed();
    expect(parseEnvelopeText(JSON.stringify(envelope))).toEqual(envelope);
  });

  it('drops unknown fields', async () => {
    const envelope = await sealed();
    expect(parseEnvelope({ ...envelope, extra: true })).toEqual(envelope);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseEnvelopeText('not json')).toThrow(EnvelopeFormatError);
  });

  it.each([null, 42, 'text', [], {}, { format: 'something-else' }])('rejects %j', (input) => {
    expect(() => parseEnvelope(input)).toThrow(EnvelopeFormatError);
  });

  it('rejects a newer version', async () => {
    const envelope = await sealed();
    expect(() => parseEnvelope({ ...envelope, version: 2 })).toThrow('newer version');
  });

  it('rejects a work factor below the minimum', async () => {
    const envelope = await sealed();
    const weak = { ...envelope, kdf: { ...envelope.kdf, iterations: 1000 } };
    expect(() => parseEnvelope(weak)).toThrow('work factor');
  });

  it('rejects a work factor above the maximum', async () => {
    const envelope = await sealed();
    const hostile = { ...envelope, kdf: { ...envelope.kdf, iterations: 2 ** 40 } };
    expect(() => parseEnvelope(hostile)).toThrow('work factor');
  });

  it('rejects another key derivation function or cipher', async () => {
    const envelope = await sealed();
    expect(() => parseEnvelope({ ...envelope, kdf: { ...envelope.kdf, hash: 'SHA-1' } })).toThrow(
      'key derivation',
    );
    expect(() => parseEnvelope({ ...envelope, cipher: { ...envelope.cipher, name: 'AES-CBC' } })).toThrow(
      'cipher',
    );
  });

  it('rejects a malformed salt, IV or ciphertext', async () => {
    const envelope = await sealed();
    expect(() => parseEnvelope({ ...envelope, kdf: { ...envelope.kdf, salt: 'AAAA' } })).toThrow('salt');
    expect(() => parseEnvelope({ ...envelope, cipher: { ...envelope.cipher, iv: 'AAAA' } })).toThrow('IV');
    expect(() => parseEnvelope({ ...envelope, ciphertext: 'AAAA' })).toThrow('ciphertext');
    expect(() => parseEnvelope({ ...envelope, ciphertext: 12 })).toThrow('ciphertext');
  });
});
