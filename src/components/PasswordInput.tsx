import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useState } from 'react';
import { Icon } from './Icon';

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** Forwarded to the underlying input, for moving focus to it. */
  ref?: Ref<HTMLInputElement>;
  /** Extra buttons shown inside the field, after the reveal toggle. */
  actions?: ReactNode;
  /** Renders the value in a monospaced face, for generated passwords and keys. */
  monospace?: boolean;
}

/** A password field with a show/hide toggle. */
export function PasswordInput({
  value,
  onChange,
  actions,
  monospace = false,
  className,
  ...inputProps
}: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="input-group">
      <input
        {...inputProps}
        className={['input', monospace && revealed ? 'input--mono' : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <div className="input-group__actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? 'Hide' : 'Show'}
          aria-pressed={revealed}
          title={revealed ? 'Hide' : 'Show'}
        >
          <Icon name={revealed ? 'eyeOff' : 'eye'} />
        </button>
        {actions}
      </div>
    </div>
  );
}
