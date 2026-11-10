import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KDF_MIN_ITERATIONS } from '../crypto/kdf';
import { addItem, createEmptyVault, EMPTY_DRAFT } from './model';
import { createVault } from './vault';

// scripts/decrypt.mjs is the documented way to read a backup without the
// app. It is written against the format description alone, so running it on
// a vault the app produced checks the documentation and the code against
// each other.

const PASSWORD = 'correct horse battery staple';
const data = addItem(createEmptyVault(), {
  ...EMPTY_DRAFT,
  title: 'Example',
  username: 'alice@example.com',
  password: 'hunter2',
});

let directory: string;
let backup: string;

function decrypt(file: string, password: string) {
  return spawnSync(process.execPath, ['scripts/decrypt.mjs', file], {
    input: `${password}\n`,
    encoding: 'utf8',
  });
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'enclave-decrypt-'));
  backup = join(directory, 'backup.json');
  const { envelope } = await createVault(PASSWORD, data, KDF_MIN_ITERATIONS);
  writeFileSync(backup, JSON.stringify(envelope, null, 2));
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('scripts/decrypt.mjs', () => {
  it('prints the vault contents given the right password', () => {
    const result = decrypt(backup, PASSWORD);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(data);
  });

  it('fails without printing anything given the wrong password', () => {
    const result = decrypt(backup, 'wrong password');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Wrong master password');
  });

  it('rejects a file that is not a vault', () => {
    const other = join(directory, 'other.json');
    writeFileSync(other, JSON.stringify({ hello: 'world' }));
    const result = decrypt(other, PASSWORD);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not a version 1 Enclave vault');
  });
});
