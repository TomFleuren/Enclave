import type { ReactNode } from 'react';
import { Brand } from '../components/Brand';

interface AuthLayoutProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** The centred card shared by the setup and unlock screens. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="auth">
      <div className="auth__card glass">
        <Brand size={32} />
        <h1 className="auth__title">{title}</h1>
        <p className="auth__subtitle">{subtitle}</p>
        {children}
      </div>
      {footer && <div className="auth__footer">{footer}</div>}
      <p className="auth__note">
        Encrypted in this browser with AES-256-GCM. Nothing is sent anywhere.
      </p>
    </main>
  );
}
