import { estimateStrength } from '../crypto/password';

/** A five-step bar with a label. Shown only once something has been typed. */
export function StrengthMeter({ password }: { password: string }) {
  if (password === '') return null;
  const { score, label } = estimateStrength(password);

  return (
    <div className={`strength strength--${score}`} aria-live="polite">
      <div className="strength__bars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((step) => (
          <span key={step} className={step <= score ? 'strength__bar is-on' : 'strength__bar'} />
        ))}
      </div>
      <span className="strength__label">{label}</span>
    </div>
  );
}
