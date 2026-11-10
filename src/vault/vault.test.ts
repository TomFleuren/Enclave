import { describe, expect, it } from 'vitest';
import { DecryptionError } from '../crypto/envelope';
import { KDF_DEFAULT_ITERATIONS, KDF_MIN_ITERATIONS } from '../crypto/kdf';
import type { VaultItemDraft } from './model';
import {
  addItem,
  createEmptyVault,
  DEFAULT_SETTINGS,
  EMPTY_DRAFT,
  parseVaultData,
  removeItem,
  searchItems,
  sortItems,
  updateItem,
  updateSettings,
} from './model';
import { createMemoryStorage } from './storage';
import { createVault, sealVault, unlockVault } from './vault';

const ITERATIONS = KDF_MIN_ITERATIONS;

const draft: VaultItemDraft = {
  ...EMPTY_DRAFT,
  title: 'Example',
  username: 'alice@example.com',
  password: 'hunter2',
  url: 'https://example.com',
  totp: { secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA-1', digits: 6, period: 30 },
};

describe('vault lifecycle', () => {
  it('creates an empty vault that unlocks with the same password', async () => {
    const created = await createVault('master password', undefined, ITERATIONS);
    const unlocked = await unlockVault(created.envelope, 'master password');
    expect(unlocked.data.items).toEqual([]);
    expect(unlocked.data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('uses the recommended work factor by default', async () => {
    const created = await createVault('master password');
    expect(created.envelope.kdf.iterations).toBe(KDF_DEFAULT_ITERATIONS);
    expect(KDF_DEFAULT_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it('refuses the wrong password', async () => {
    const created = await createVault('master password', undefined, ITERATIONS);
    await expect(unlockVault(created.envelope, 'Master password')).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('persists items across a save and an unlock', async () => {
    const created = await createVault('master password', undefined, ITERATIONS);
    const data = addItem(created.data, draft);
    const envelope = await sealVault(created.session, data);

    const unlocked = await unlockVault(envelope, 'master password');
    expect(unlocked.data).toEqual(data);
  });

  it('never writes item contents to storage in the clear', async () => {
    const created = await createVault('master password', undefined, ITERATIONS);
    const storage = createMemoryStorage();
    storage.save(await sealVault(created.session, addItem(created.data, draft)));

    const stored = JSON.stringify(storage.load());
    for (const secret of ['hunter2', 'alice@example.com', 'JBSWY3DPEHPK3PXP', 'Example']) {
      expect(stored).not.toContain(secret);
    }
  });

  it('changes the master password by re-encrypting under a new salt', async () => {
    const original = await createVault('old password', undefined, ITERATIONS);
    const data = addItem(original.data, draft);
    const changed = await createVault('new password', data, ITERATIONS);

    expect(changed.envelope.kdf.salt).not.toBe(original.envelope.kdf.salt);
    await expect(unlockVault(changed.envelope, 'old password')).rejects.toBeInstanceOf(
      DecryptionError,
    );
    expect((await unlockVault(changed.envelope, 'new password')).data).toEqual(data);
  });
});

describe('item operations', () => {
  it('adds, updates and removes without mutating the input', () => {
    const empty = createEmptyVault(1000);
    const added = addItem(empty, draft, 2000);
    expect(empty.items).toHaveLength(0);
    expect(added.items).toHaveLength(1);

    const item = added.items[0]!;
    expect(item).toMatchObject({ ...draft, createdAt: 2000, updatedAt: 2000 });
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);

    const updated = updateItem(added, item.id, { ...draft, password: 'changed' }, 3000);
    expect(updated.items[0]).toMatchObject({ password: 'changed', createdAt: 2000, updatedAt: 3000 });
    expect(added.items[0]!.password).toBe('hunter2');

    const removed = removeItem(updated, item.id, 4000);
    expect(removed.items).toHaveLength(0);
    expect(removed.updatedAt).toBe(4000);
  });

  it('merges settings', () => {
    const data = updateSettings(createEmptyVault(), { autoLockMinutes: 15 });
    expect(data.settings).toEqual({ ...DEFAULT_SETTINGS, autoLockMinutes: 15 });
  });

  it('sorts favourites first, then by title', () => {
    let data = createEmptyVault();
    data = addItem(data, { ...draft, title: 'banana' });
    data = addItem(data, { ...draft, title: 'Apple' });
    data = addItem(data, { ...draft, title: 'cherry', favorite: true });
    expect(sortItems(data.items).map((item) => item.title)).toEqual(['cherry', 'Apple', 'banana']);
  });

  it('searches title, username and URL, but not secrets', () => {
    const { items } = addItem(createEmptyVault(), draft);
    expect(searchItems(items, 'EXAMPLE')).toHaveLength(1);
    expect(searchItems(items, 'alice')).toHaveLength(1);
    expect(searchItems(items, '  ')).toHaveLength(1);
    expect(searchItems(items, 'hunter2')).toHaveLength(0);
  });
});

describe('parseVaultData', () => {
  it('round-trips a vault', () => {
    const data = addItem(createEmptyVault(), draft);
    expect(parseVaultData(JSON.stringify(data))).toEqual(data);
  });

  it('fills in defaults for missing or malformed fields', () => {
    const parsed = parseVaultData(
      JSON.stringify({
        items: [
          { title: 'Only a title' },
          'not an item',
          { title: 'Bad totp', totp: { secret: '!!!' } },
        ],
        settings: { autoLockMinutes: 7, lockOnHide: 'yes' },
      }),
      5000,
    );

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({
      title: 'Only a title',
      username: '',
      password: '',
      totp: null,
      favorite: false,
      createdAt: 5000,
    });
    expect(parsed.items[0]!.id).not.toBe('');
    expect(parsed.items[1]!.totp).toBeNull();
    expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
    expect(parsed.createdAt).toBe(5000);
  });

  it('rejects contents that are not an object', () => {
    expect(() => parseVaultData('[]')).toThrow('recognised format');
  });
});
