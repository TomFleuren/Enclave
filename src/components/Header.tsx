import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { Icon } from './Icon';

const REPOSITORY_URL = 'https://github.com/TomFleuren/Enclave';

interface HeaderProps {
  /** The section links, shown only while the vault is unlocked. */
  nav?: ReactNode;
  /** The button at the end of the bar. */
  action: ReactNode;
}

/** The bar that floats at the top of every screen. */
export function Header({ nav, action }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__bar">
        <Brand />
        {nav}
        <div className="header__end">{action}</div>
      </div>
    </header>
  );
}

/** Where to read the code. Shown in the header while the vault is locked. */
export function SourceLink() {
  return (
    <a className="pill-button" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
      <Icon name="code" size={16} />
      GitHub
    </a>
  );
}
