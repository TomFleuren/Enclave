/** The Enclave mark: a rounded block with a keyhole cut out of it. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8 2h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6zm4 5.25a2.75 2.75 0 0 0-1.45 5.09L9.9 16.6a.6.6 0 0 0 .6.7h3a.6.6 0 0 0 .6-.7l-.65-4.26A2.75 2.75 0 0 0 12 7.25z"
      />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <Mark />
      <span className="brand__name">Enclave</span>
    </span>
  );
}
