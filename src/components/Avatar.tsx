import type { CSSProperties } from 'react';

/** A stable hue for a title, so an item keeps its colour between sessions. */
function hueFor(text: string): number {
  let hash = 0;
  for (const character of text) {
    hash = (hash * 31 + character.codePointAt(0)!) % 360;
  }
  return hash;
}

/** A coloured tile with the first letter of the item's title. */
export function Avatar({ title, size = 'medium' }: { title: string; size?: 'medium' | 'large' }) {
  const initial = [...title.trim()][0]?.toUpperCase() ?? '?';
  const style = { '--avatar-hue': hueFor(title) } as CSSProperties;

  return (
    <span className={`avatar avatar--${size}`} style={style} aria-hidden="true">
      {initial}
    </span>
  );
}
