/**
 * Turns what a person typed into the website field into a link that is safe
 * to open, or `null` when it is not one.
 *
 * Only http and https are allowed through. Anything else, `javascript:` in
 * particular, must never end up in an href.
 */
export function toWebUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** The host name of a website field, for display. Falls back to the raw text. */
export function displayHost(input: string): string {
  const href = toWebUrl(input);
  return href ? new URL(href).host.replace(/^www\./, '') : input.trim();
}
