import { describe, expect, it } from 'vitest';
import { base32Encode, utf8Encode } from './encoding';
import type { TotpAlgorithm } from './totp';
import {
  hotp,
  normalizeSecret,
  parseOtpauthUri,
  parseTotpInput,
  secondsRemaining,
  totp,
} from './totp';

describe('hotp', () => {
  // RFC 4226, appendix D.
  const secret = utf8Encode('12345678901234567890');
  const expected = [
    '755224',
    '287082',
    '359152',
    '969429',
    '338314',
    '254676',
    '287922',
    '162583',
    '399871',
    '520489',
  ];

  it.each(expected.map((code, counter) => [counter, code] as const))(
    'counter %i gives %s',
    async (counter, code) => {
      expect(await hotp(secret, counter)).toBe(code);
    },
  );
});

describe('totp', () => {
  // RFC 6238, appendix B. Each algorithm uses a seed of its own hash length.
  const seeds: Record<TotpAlgorithm, string> = {
    'SHA-1': '12345678901234567890',
    'SHA-256': '12345678901234567890123456789012',
    'SHA-512': '1234567890123456789012345678901234567890123456789012345678901234',
  };

  const vectors: [number, TotpAlgorithm, string][] = [
    [59, 'SHA-1', '94287082'],
    [59, 'SHA-256', '46119246'],
    [59, 'SHA-512', '90693936'],
    [1111111109, 'SHA-1', '07081804'],
    [1111111109, 'SHA-256', '68084774'],
    [1111111109, 'SHA-512', '25091201'],
    [1111111111, 'SHA-1', '14050471'],
    [1111111111, 'SHA-256', '67062674'],
    [1111111111, 'SHA-512', '99943326'],
    [1234567890, 'SHA-1', '89005924'],
    [1234567890, 'SHA-256', '91819424'],
    [1234567890, 'SHA-512', '93441116'],
    [2000000000, 'SHA-1', '69279037'],
    [2000000000, 'SHA-256', '90698825'],
    [2000000000, 'SHA-512', '38618901'],
    [20000000000, 'SHA-1', '65353130'],
    [20000000000, 'SHA-256', '77737706'],
    [20000000000, 'SHA-512', '47863826'],
  ];

  it.each(vectors)('at %i seconds with %s gives %s', async (seconds, algorithm, code) => {
    const secret = base32Encode(utf8Encode(seeds[algorithm]));
    expect(await totp({ secret, algorithm, digits: 8, period: 30 }, seconds * 1000)).toBe(code);
  });

  it('keeps leading zeros', async () => {
    const secret = base32Encode(utf8Encode(seeds['SHA-1']));
    const code = await totp({ secret, algorithm: 'SHA-1', digits: 8, period: 30 }, 1111111109000);
    expect(code).toHaveLength(8);
    expect(code.startsWith('0')).toBe(true);
  });
});

describe('secondsRemaining', () => {
  it('counts down within a period', () => {
    expect(secondsRemaining(30, 0)).toBe(30);
    expect(secondsRemaining(30, 1_000)).toBe(29);
    expect(secondsRemaining(30, 29_999)).toBe(1);
    expect(secondsRemaining(30, 30_000)).toBe(30);
  });
});

describe('normalizeSecret', () => {
  it('strips spaces, hyphens and padding and upper-cases', () => {
    expect(normalizeSecret('jbsw y3dp-ehpk 3pxp==')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('rejects an empty secret', () => {
    expect(() => normalizeSecret('   ')).toThrow('empty');
  });

  it('rejects characters that are not base32', () => {
    expect(() => normalizeSecret('JBSWY3DPEHPK3PX1')).toThrow('base32');
  });
});

describe('parseOtpauthUri', () => {
  it('reads a full link', () => {
    const parsed = parseOtpauthUri(
      'otpauth://totp/Example%20Corp:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example%20Corp&algorithm=SHA256&digits=8&period=60',
    );
    expect(parsed).toEqual({
      config: { secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA-256', digits: 8, period: 60 },
      issuer: 'Example Corp',
      account: 'alice@example.com',
    });
  });

  it('applies the defaults and falls back to the issuer in the label', () => {
    const parsed = parseOtpauthUri('otpauth://totp/GitHub:octocat?secret=jbswy3dpehpk3pxp');
    expect(parsed).toEqual({
      config: { secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA-1', digits: 6, period: 30 },
      issuer: 'GitHub',
      account: 'octocat',
    });
  });

  it('rejects counter-based links', () => {
    expect(() => parseOtpauthUri('otpauth://hotp/Example?secret=JBSWY3DPEHPK3PXP&counter=1')).toThrow(
      'time-based',
    );
  });

  it('rejects a link without a secret', () => {
    expect(() => parseOtpauthUri('otpauth://totp/Example')).toThrow('empty');
  });

  it('rejects other schemes', () => {
    expect(() => parseOtpauthUri('https://example.com/?secret=JBSWY3DPEHPK3PXP')).toThrow(
      'otpauth',
    );
  });

  it('rejects out-of-range digits', () => {
    expect(() => parseOtpauthUri('otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&digits=12')).toThrow(
      '6 to 8',
    );
  });
});

describe('parseTotpInput', () => {
  it('accepts a bare secret', () => {
    expect(parseTotpInput(' jbsw y3dp ehpk 3pxp ').config).toEqual({
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
    });
  });

  it('accepts a link', () => {
    expect(parseTotpInput('otpauth://totp/x?secret=JBSWY3DPEHPK3PXP').config.secret).toBe(
      'JBSWY3DPEHPK3PXP',
    );
  });
});
