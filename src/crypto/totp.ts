import type { Bytes } from './encoding';
import { base32Decode } from './encoding';

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface TotpConfig {
  /** Base32 shared secret, upper case without spaces or padding. */
  secret: string;
  algorithm: TotpAlgorithm;
  digits: number;
  /** Seconds each code is valid for. */
  period: number;
}

export const TOTP_DEFAULTS = {
  algorithm: 'SHA-1',
  digits: 6,
  period: 30,
} as const satisfies Omit<TotpConfig, 'secret'>;

/**
 * Cleans up a secret as a person would type or paste it and checks that it is
 * valid base32. Throws when it is not.
 */
export function normalizeSecret(input: string): string {
  const secret = input.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();
  if (secret.length === 0) {
    throw new Error('The authenticator secret is empty.');
  }
  if (!/^[A-Z2-7]+$/.test(secret)) {
    throw new Error('The authenticator secret is not valid base32 (A-Z and 2-7).');
  }
  if (base32Decode(secret).length === 0) {
    throw new Error('The authenticator secret is too short.');
  }
  return secret;
}

/** HOTP, RFC 4226. */
export async function hotp(
  secret: Bytes,
  counter: number,
  digits: number = TOTP_DEFAULTS.digits,
  algorithm: TotpAlgorithm = TOTP_DEFAULTS.algorithm,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );

  const counterBytes = new Uint8Array(8);
  new DataView(counterBytes.buffer).setBigUint64(0, BigInt(counter));

  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));

  // Dynamic truncation: the low nibble of the last byte picks a 4-byte window.
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary =
    ((mac[offset]! & 0x7f) << 24) |
    (mac[offset + 1]! << 16) |
    (mac[offset + 2]! << 8) |
    mac[offset + 3]!;

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** TOTP, RFC 6238: HOTP with the counter taken from the clock. */
export function totp(config: TotpConfig, timestampMs: number = Date.now()): Promise<string> {
  const counter = Math.floor(timestampMs / 1000 / config.period);
  return hotp(base32Decode(config.secret), counter, config.digits, config.algorithm);
}

/** Seconds until the current code stops being valid. */
export function secondsRemaining(period: number, timestampMs: number = Date.now()): number {
  return period - (Math.floor(timestampMs / 1000) % period);
}

export interface ParsedOtpauth {
  config: TotpConfig;
  issuer: string;
  account: string;
}

const ALGORITHMS: Record<string, TotpAlgorithm> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
};

/**
 * Parses an `otpauth://totp/...` URI, the payload of the QR code a service
 * shows when two-factor authentication is set up.
 */
export function parseOtpauthUri(uri: string): ParsedOtpauth {
  let url: URL;
  try {
    url = new URL(uri.trim());
  } catch {
    throw new Error('This is not a valid otpauth:// link.');
  }
  if (url.protocol !== 'otpauth:') {
    throw new Error('This is not a valid otpauth:// link.');
  }

  // Browsers disagree on whether "totp" lands in host or in pathname for a
  // non-special scheme, so both are handled.
  const path = `${url.host}${url.pathname}`.replace(/^\/+/, '');
  const separator = path.indexOf('/');
  const type = (separator === -1 ? path : path.slice(0, separator)).toLowerCase();
  if (type !== 'totp') {
    throw new Error('Only time-based (TOTP) codes are supported.');
  }

  const label = decodeURIComponent(separator === -1 ? '' : path.slice(separator + 1));
  const labelSeparator = label.indexOf(':');
  const labelIssuer = labelSeparator === -1 ? '' : label.slice(0, labelSeparator).trim();
  const account = (labelSeparator === -1 ? label : label.slice(labelSeparator + 1)).trim();

  const secret = normalizeSecret(url.searchParams.get('secret') ?? '');

  const algorithmParam = (url.searchParams.get('algorithm') ?? 'SHA1').toUpperCase().replace('-', '');
  const algorithm = ALGORITHMS[algorithmParam];
  if (!algorithm) {
    throw new Error(`Unsupported algorithm "${algorithmParam}".`);
  }

  const digits = Number(url.searchParams.get('digits') ?? TOTP_DEFAULTS.digits);
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new Error('Codes must be 6 to 8 digits long.');
  }

  const period = Number(url.searchParams.get('period') ?? TOTP_DEFAULTS.period);
  if (!Number.isInteger(period) || period < 1 || period > 3600) {
    throw new Error('The code period is invalid.');
  }

  return {
    config: { secret, algorithm, digits, period },
    issuer: (url.searchParams.get('issuer') ?? labelIssuer).trim(),
    account,
  };
}

/**
 * Accepts either an `otpauth://` link or a bare base32 secret, which are the
 * two things a service offers during two-factor setup.
 */
export function parseTotpInput(input: string): ParsedOtpauth {
  const trimmed = input.trim();
  if (/^otpauth:/i.test(trimmed)) {
    return parseOtpauthUri(trimmed);
  }
  return {
    config: { secret: normalizeSecret(trimmed), ...TOTP_DEFAULTS },
    issuer: '',
    account: '',
  };
}
