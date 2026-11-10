import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  fromBase64,
  randomBytes,
  toBase64,
  utf8Decode,
  utf8Encode,
} from './encoding';

describe('base64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = randomBytes(1000);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('round-trips a buffer larger than one chunk', () => {
    const bytes = new Uint8Array(100_000).map((_, index) => index % 251);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('matches known values', () => {
    expect(toBase64(utf8Encode('foobar'))).toBe('Zm9vYmFy');
    expect(utf8Decode(fromBase64('Zm9vYg=='))).toBe('foob');
  });

  it('rejects input that is not base64', () => {
    expect(() => fromBase64('not base64!')).toThrow('Invalid base64');
  });
});

describe('base32', () => {
  // RFC 4648, section 10.
  const vectors: [string, string][] = [
    ['', ''],
    ['f', 'MY'],
    ['fo', 'MZXQ'],
    ['foo', 'MZXW6'],
    ['foob', 'MZXW6YQ'],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI'],
  ];

  it.each(vectors)('encodes %j as %j', (plain, encoded) => {
    expect(base32Encode(utf8Encode(plain))).toBe(encoded);
  });

  it.each(vectors)('decodes %j from %j', (plain, encoded) => {
    expect(utf8Decode(base32Decode(encoded))).toBe(plain);
  });

  it('tolerates padding, lower case, spaces and hyphens', () => {
    expect(utf8Decode(base32Decode('mzxw 6ytb-oi======'))).toBe('foobar');
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => base32Decode('MZXW1')).toThrow('Invalid base32');
  });
});

describe('utf8', () => {
  it('round-trips text outside the basic multilingual plane', () => {
    const text = 'pässwörd 密码 🔐';
    expect(utf8Decode(utf8Encode(text))).toBe(text);
  });
});
