import type { ReactNode } from 'react';
import { Header, SourceLink } from '../components/Header';

interface AuthLayoutProps {
  /** The page heading. */
  title: string;
  cardTitle: string;
  cardText: ReactNode;
  /** The form, or whatever else belongs in the card. */
  children?: ReactNode;
  /** Shown below the card, across the full width of the page. */
  after?: ReactNode;
}

/** The page shared by every screen that is shown while the vault is locked. */
export function AuthLayout({ title, cardTitle, cardText, children, after }: AuthLayoutProps) {
  return (
    <>
      <Header action={<SourceLink />} />
      <main className="auth">
        <div className="auth__column">
          <h1 className="auth__title">{title}</h1>
          <section className="card auth__card">
            <h2 className="auth__card-title">{cardTitle}</h2>
            <p className="auth__card-text">{cardText}</p>
            {children}
          </section>
          <p className="hint auth__note">
            Encrypted in this browser with AES-256-GCM. Nothing is sent anywhere.
          </p>
        </div>
        {after}
      </main>
    </>
  );
}
