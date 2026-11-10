import type { TotpAlgorithm, TotpConfig } from '../crypto/totp';
import { normalizeSecret, TOTP_DEFAULTS } from '../crypto/totp';

export interface VaultItem {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  totp: TotpConfig | null;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

/** The fields a person edits; everything else on an item is bookkeeping. */
export type VaultItemDraft = Pick<
  VaultItem,
  'title' | 'username' | 'password' | 'url' | 'notes' | 'totp' | 'favorite'
>;

export interface VaultSettings {
  /** Minutes without activity before the vault locks. 0 turns the timer off. */
  autoLockMinutes: number;
  /** Seconds before a copied secret is wiped from the clipboard. 0 turns it off. */
  clipboardClearSeconds: number;
  /** Lock as soon as the tab is hidden or the window is minimised. */
  lockOnHide: boolean;
}

/** The plaintext of a vault. This is what gets encrypted. */
export interface VaultData {
  items: VaultItem[];
  settings: VaultSettings;
  createdAt: number;
  updatedAt: number;
}

/**
 * The master password is the only thing standing between a copy of the
 * encrypted vault and its contents, so short ones are refused outright.
 */
export const MASTER_PASSWORD_MIN_LENGTH = 10;

export const AUTO_LOCK_OPTIONS = [1, 5, 15, 60, 0] as const;
export const CLIPBOARD_CLEAR_OPTIONS = [15, 30, 60, 0] as const;

export const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 5,
  clipboardClearSeconds: 30,
  lockOnHide: false,
};

export const EMPTY_DRAFT: VaultItemDraft = {
  title: '',
  username: '',
  password: '',
  url: '',
  notes: '',
  totp: null,
  favorite: false,
};

export function createEmptyVault(now: number = Date.now()): VaultData {
  return { items: [], settings: { ...DEFAULT_SETTINGS }, createdAt: now, updatedAt: now };
}

export function createItem(draft: VaultItemDraft, now: number = Date.now()): VaultItem {
  return { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}

export function insertItem(data: VaultData, item: VaultItem): VaultData {
  return { ...data, items: [...data.items, item], updatedAt: item.updatedAt };
}

export function addItem(data: VaultData, draft: VaultItemDraft, now: number = Date.now()): VaultData {
  return insertItem(data, createItem(draft, now));
}

/** Flips the favourite flag. Not counted as an edit, so `updatedAt` on the item stays put. */
export function toggleFavorite(data: VaultData, id: string, now: number = Date.now()): VaultData {
  return {
    ...data,
    items: data.items.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)),
    updatedAt: now,
  };
}

export function updateItem(
  data: VaultData,
  id: string,
  draft: VaultItemDraft,
  now: number = Date.now(),
): VaultData {
  return {
    ...data,
    items: data.items.map((item) => (item.id === id ? { ...item, ...draft, updatedAt: now } : item)),
    updatedAt: now,
  };
}

export function removeItem(data: VaultData, id: string, now: number = Date.now()): VaultData {
  return { ...data, items: data.items.filter((item) => item.id !== id), updatedAt: now };
}

export function updateSettings(
  data: VaultData,
  settings: Partial<VaultSettings>,
  now: number = Date.now(),
): VaultData {
  return { ...data, settings: { ...data.settings, ...settings }, updatedAt: now };
}

/** Favourites first, then alphabetical by title. */
export function sortItems(items: readonly VaultItem[]): VaultItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  );
}

export function searchItems(items: readonly VaultItem[], query: string): VaultItem[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...items];
  return items.filter((item) =>
    [item.title, item.username, item.url].some((field) => field.toLowerCase().includes(needle)),
  );
}

// ---------------------------------------------------------------------------
// Reading decrypted data back in
//
// A vault that decrypts is authentic, but it may have been written by a
// different version of Enclave. Every field is checked and defaulted rather
// than trusted, so an unexpected shape cannot crash the UI.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asTimestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asOption(value: unknown, options: readonly number[], fallback: number): number {
  return typeof value === 'number' && options.includes(value) ? value : fallback;
}

const TOTP_ALGORITHMS: readonly TotpAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-512'];

function parseTotp(value: unknown): TotpConfig | null {
  if (!isRecord(value)) return null;
  try {
    const digits = Number(value.digits);
    const period = Number(value.period);
    return {
      secret: normalizeSecret(asString(value.secret)),
      algorithm: TOTP_ALGORITHMS.includes(value.algorithm as TotpAlgorithm)
        ? (value.algorithm as TotpAlgorithm)
        : TOTP_DEFAULTS.algorithm,
      digits: Number.isInteger(digits) && digits >= 6 && digits <= 8 ? digits : TOTP_DEFAULTS.digits,
      period: Number.isInteger(period) && period >= 1 && period <= 3600 ? period : TOTP_DEFAULTS.period,
    };
  } catch {
    return null;
  }
}

function parseItem(value: unknown, now: number): VaultItem | null {
  if (!isRecord(value)) return null;
  const createdAt = asTimestamp(value.createdAt, now);
  return {
    id: asString(value.id) || crypto.randomUUID(),
    title: asString(value.title),
    username: asString(value.username),
    password: asString(value.password),
    url: asString(value.url),
    notes: asString(value.notes),
    totp: parseTotp(value.totp),
    favorite: value.favorite === true,
    createdAt,
    updatedAt: asTimestamp(value.updatedAt, createdAt),
  };
}

export function parseVaultData(text: string, now: number = Date.now()): VaultData {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error('The vault contents are not in a recognised format.');
  }

  const settings = isRecord(parsed.settings) ? parsed.settings : {};
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const createdAt = asTimestamp(parsed.createdAt, now);

  return {
    items: items.map((item) => parseItem(item, now)).filter((item) => item !== null),
    settings: {
      autoLockMinutes: asOption(
        settings.autoLockMinutes,
        AUTO_LOCK_OPTIONS,
        DEFAULT_SETTINGS.autoLockMinutes,
      ),
      clipboardClearSeconds: asOption(
        settings.clipboardClearSeconds,
        CLIPBOARD_CLEAR_OPTIONS,
        DEFAULT_SETTINGS.clipboardClearSeconds,
      ),
      lockOnHide: settings.lockOnHide === true,
    },
    createdAt,
    updatedAt: asTimestamp(parsed.updatedAt, createdAt),
  };
}
