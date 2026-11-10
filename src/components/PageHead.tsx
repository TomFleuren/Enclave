import type { ReactNode } from 'react';

interface PageHeadProps {
  /** The section's short name, shown as a path above the title. */
  tag: string;
  title: string;
  children?: ReactNode;
}

/** The label, title and one-line description at the top of each section. */
export function PageHead({ tag, title, children }: PageHeadProps) {
  return (
    <header className="page-head">
      <span className="tag">/{tag}</span>
      <h1 className="page-title">{title}</h1>
      {children && <p className="page-lead">{children}</p>}
    </header>
  );
}
