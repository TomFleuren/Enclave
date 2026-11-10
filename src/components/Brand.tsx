import { useId } from 'react';

interface BrandProps {
  size?: number;
  /** Hides the wordmark and shows the mark alone. */
  markOnly?: boolean;
}

export function Brand({ size = 28, markOnly = false }: BrandProps) {
  // Unique per instance, so two marks on one page never share a gradient.
  const gradientId = useId();
  const paint = `url(#${gradientId})`;

  return (
    <span className="brand">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a5b1ff" />
            <stop offset="1" stopColor="#5b6cff" />
          </linearGradient>
        </defs>
        <path
          d="M32 8l20 7.5V31c0 13-8.2 22.8-20 26-11.8-3.2-20-13-20-26V15.5z"
          fill="none"
          stroke={paint}
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="28" r="5.5" fill={paint} />
        <path d="M32 32v10" stroke={paint} strokeWidth="5" strokeLinecap="round" />
      </svg>
      {!markOnly && <span className="brand__name">Enclave</span>}
    </span>
  );
}
