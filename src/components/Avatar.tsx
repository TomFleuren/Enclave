const TONES = 5;

/** A stable colour for a title, so an item keeps its colour between sessions. */
function toneFor(text: string): number {
  let hash = 0;
  for (const character of text) {
    hash = (hash * 37 + character.codePointAt(0)!) % 10007;
  }
  return hash % TONES;
}

/** A coloured disc with the first letter of the item's title. */
export function Avatar({ title, size = 'medium' }: { title: string; size?: 'medium' | 'large' }) {
  const initial = [...title.trim()][0]?.toUpperCase() ?? '?';

  return (
    <span className={`avatar avatar--${size} avatar--tone-${toneFor(title)}`} aria-hidden="true">
      {initial}
    </span>
  );
}
