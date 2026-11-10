import { describe, expect, it } from 'vitest';
import { displayHost, toWebUrl } from './url';

describe('toWebUrl', () => {
  it('keeps http and https links', () => {
    expect(toWebUrl('https://example.com/login')).toBe('https://example.com/login');
    expect(toWebUrl('http://intranet.local')).toBe('http://intranet.local/');
  });

  it('assumes https when no scheme was typed', () => {
    expect(toWebUrl('example.com')).toBe('https://example.com/');
    expect(toWebUrl('  example.com/path  ')).toBe('https://example.com/path');
  });

  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<p>x</p>', 'file:///etc/passwd'])(
    'refuses %s',
    (input) => {
      expect(toWebUrl(input)).toBeNull();
    },
  );

  it('refuses text that is not a URL', () => {
    expect(toWebUrl('')).toBeNull();
    expect(toWebUrl('   ')).toBeNull();
    expect(toWebUrl('not a url')).toBeNull();
  });
});

describe('displayHost', () => {
  it('shows the host without www', () => {
    expect(displayHost('https://www.example.com/login?x=1')).toBe('example.com');
  });

  it('falls back to the text as typed', () => {
    expect(displayHost(' office wifi ')).toBe('office wifi');
  });
});
