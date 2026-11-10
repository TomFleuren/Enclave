/**
 * Byte and text encoding helpers.
 *
 * `Bytes` is pinned to a plain `ArrayBuffer` backing store because that is what
 * the Web Crypto API accepts; a `SharedArrayBuffer`-backed view is rejected.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export function utf8Encode(text: string): Bytes {
  return encoder.encode(text) as Bytes;
}

export function utf8Decode(bytes: Bytes): string {
  return decoder.decode(bytes);
}

export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64(bytes: Bytes): string {
  let binary = '';
  // Chunked so a large vault does not overflow the argument limit of fromCharCode.
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Bytes {
  let binary: string;
  try {
    binary = atob(text);
  } catch {
    throw new Error('Invalid base64 data');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes RFC 4648 base32, the encoding authenticator secrets are shared in.
 * Spaces, hyphens, lower case and missing padding are all tolerated, because
 * that is how services tend to display the secret for manual entry.
 */
export function base32Decode(text: string): Bytes {
  const cleaned = text.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();
  const output = new Uint8Array(Math.floor((cleaned.length * 5) / 8));

  let buffer = 0;
  let bitsInBuffer = 0;
  let outputIndex = 0;

  for (const character of cleaned) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value === -1) {
      throw new Error(`Invalid base32 character "${character}"`);
    }
    buffer = (buffer << 5) | value;
    bitsInBuffer += 5;
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      output[outputIndex] = (buffer >>> bitsInBuffer) & 0xff;
      outputIndex += 1;
    }
  }

  return output;
}

export function base32Encode(bytes: Bytes): string {
  let output = '';
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsInBuffer += 8;
    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      output += BASE32_ALPHABET[(buffer >>> bitsInBuffer) & 31];
    }
  }
  if (bitsInBuffer > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bitsInBuffer)) & 31];
  }

  return output;
}
