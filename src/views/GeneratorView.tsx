import { useState } from 'react';
import { Icon } from '../components/Icon';
import type { GeneratorOptions } from '../crypto/password';
import {
  generatePassword,
  GENERATOR_DEFAULTS,
  GENERATOR_MAX_LENGTH,
  GENERATOR_MIN_LENGTH,
  generatorEntropyBits,
} from '../crypto/password';
import { useFeedback } from '../state/feedback-context';

type CharacterOption = 'lowercase' | 'uppercase' | 'digits' | 'symbols';

const CHARACTER_OPTIONS: { key: CharacterOption; label: string; sample: string }[] = [
  { key: 'lowercase', label: 'Lowercase', sample: 'a-z' },
  { key: 'uppercase', label: 'Uppercase', sample: 'A-Z' },
  { key: 'digits', label: 'Digits', sample: '0-9' },
  { key: 'symbols', label: 'Symbols', sample: '!@#$' },
];

/** Colours each character by its class so a password is easier to read back. */
function characterClass(character: string): string {
  if (/[0-9]/.test(character)) return 'char char--digit';
  if (/[^a-zA-Z]/.test(character)) return 'char char--symbol';
  return 'char';
}

export function GeneratorView() {
  const { copy } = useFeedback();
  const [options, setOptions] = useState<GeneratorOptions>(GENERATOR_DEFAULTS);
  const [password, setPassword] = useState(() => generatePassword(GENERATOR_DEFAULTS));

  // Options and password change together, so the password on screen always
  // matches the settings beside it.
  const update = (next: GeneratorOptions) => {
    setOptions(next);
    setPassword(generatePassword(next));
  };

  const enabledCount = CHARACTER_OPTIONS.filter(({ key }) => options[key]).length;
  const bits = Math.round(generatorEntropyBits(options));

  return (
    <div className="page page--narrow">
      <header className="view-header">
        <div>
          <h1 className="view-title">Generator</h1>
          <p className="view-subtitle">
            Random passwords from your browser&apos;s cryptographic random number generator.
          </p>
        </div>
      </header>

      <section className="panel glass generator">
        <output className="generator__output selectable" aria-label="Generated password">
          {[...password].map((character, index) => (
            <span key={index} className={characterClass(character)}>
              {character}
            </span>
          ))}
        </output>

        <div className="generator__actions">
          <span className="generator__entropy" title="How hard this password is to guess">
            {bits} bits of entropy
          </span>
          <button type="button" className="button" onClick={() => setPassword(generatePassword(options))}>
            <Icon name="refresh" />
            Regenerate
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void copy(password, 'Password', { sensitive: true })}
          >
            <Icon name="copy" />
            Copy
          </button>
        </div>
      </section>

      <section className="panel glass settings-group">
        <label className="setting setting--stacked">
          <span className="setting__text">
            <span className="setting__label">Length</span>
            <span className="setting__value">{options.length} characters</span>
          </span>
          <input
            className="slider"
            type="range"
            min={GENERATOR_MIN_LENGTH}
            max={GENERATOR_MAX_LENGTH}
            value={options.length}
            onChange={(event) => update({ ...options, length: Number(event.target.value) })}
          />
        </label>

        {CHARACTER_OPTIONS.map(({ key, label, sample }) => (
          <label key={key} className="setting">
            <span className="setting__text">
              <span className="setting__label">{label}</span>
              <span className="setting__hint">{sample}</span>
            </span>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              checked={options[key]}
              // The last remaining set cannot be turned off.
              disabled={options[key] && enabledCount === 1}
              onChange={(event) => update({ ...options, [key]: event.target.checked })}
            />
          </label>
        ))}

        <label className="setting">
          <span className="setting__text">
            <span className="setting__label">Avoid look-alike characters</span>
            <span className="setting__hint">Leaves out l, I, 1, O, 0 and o</span>
          </span>
          <input
            className="switch"
            type="checkbox"
            role="switch"
            checked={options.avoidAmbiguous}
            onChange={(event) => update({ ...options, avoidAmbiguous: event.target.checked })}
          />
        </label>
      </section>
    </div>
  );
}
