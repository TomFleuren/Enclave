import { useEffect, useState } from 'react';
import type { TotpConfig } from '../crypto/totp';
import { totp } from '../crypto/totp';
import { useNowSeconds } from './useNowSeconds';

export interface TotpReading {
  /** The current code, or `null` for the instant it takes to compute one. */
  code: string | null;
  /** Seconds until the code changes. */
  remaining: number;
  /** Share of the period that is left, from 1 down to 0. */
  progress: number;
}

export function useTotp({ secret, algorithm, digits, period }: TotpConfig): TotpReading {
  const now = useNowSeconds();
  const counter = Math.floor(now / period);
  const key = `${secret}|${algorithm}|${digits}|${period}|${counter}`;

  const [computed, setComputed] = useState<{ key: string; code: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    totp({ secret, algorithm, digits, period }, counter * period * 1000)
      .then((code) => {
        if (!cancelled) setComputed({ key, code });
      })
      .catch(() => {
        if (!cancelled) setComputed({ key, code: '' });
      });
    return () => {
      cancelled = true;
    };
  }, [key, secret, algorithm, digits, period, counter]);

  const remaining = period - (now % period);

  return {
    // A code computed for an earlier period is never shown as current.
    code: computed?.key === key ? computed.code : null,
    remaining,
    progress: remaining / period,
  };
}
