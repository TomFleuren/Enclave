import type { TotpConfig } from '../crypto/totp';
import type { TotpReading } from '../hooks/useTotp';

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Splits a code into two groups so it is easier to read and type: "123 456". */
export function formatCode(code: string): string {
  const middle = Math.ceil(code.length / 2);
  return `${code.slice(0, middle)} ${code.slice(middle)}`;
}

/** A ring that drains as the current code runs out of time. */
export function CountdownRing({ reading, size = 28 }: { reading: TotpReading; size?: number }) {
  const expiring = reading.remaining <= 5;
  return (
    <svg
      className={expiring ? 'ring is-expiring' : 'ring'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={`${reading.remaining} seconds left`}
    >
      <circle className="ring__track" cx="12" cy="12" r={RADIUS} />
      <circle
        className="ring__value"
        cx="12"
        cy="12"
        r={RADIUS}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - reading.progress)}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

export function CodeDigits({ reading, config }: { reading: TotpReading; config: TotpConfig }) {
  if (reading.code === '') {
    return <span className="code code--error">Invalid key</span>;
  }
  return (
    <span className={reading.remaining <= 5 ? 'code is-expiring' : 'code'}>
      {formatCode(reading.code ?? '•'.repeat(config.digits))}
    </span>
  );
}
