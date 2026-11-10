// End-to-end test of the production build in a real browser.
//
// Usage: npm run test:e2e
//
// Builds the app, serves the result (with its Content-Security-Policy) and
// walks through the things a person does with it: create a vault, add an
// item, reload, unlock, export a backup, change the master password, delete
// the vault and restore it from the backup. Along the way it checks that
// nothing readable reaches storage or the backup file, and that the page
// neither logs an error nor trips its own security policy.

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { launchBrowser, sleep } from './lib/browser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MASTER = 'Harbor-Quartz-88-Meadow?';
const NEW_MASTER = 'Juniper-Velvet-17-Canyon!';
const ITEM_PASSWORD = 'S3cret-Value-For-Test';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const TOTP_SECRET_BYTES = Buffer.from('48656c6c6f21deadbeef', 'hex');
const OTPAUTH = `otpauth://totp/Example%20Corp:alice@example.com?secret=${TOTP_SECRET}&issuer=Example%20Corp`;
const STORAGE_KEY = 'enclave.vault';

/** An independent TOTP implementation, to check the codes the app displays. */
function expectedCodes(now = Date.now()) {
  const counter = Math.floor(now / 30_000);
  // Either side of the current step too, in case the clock ticks over mid-test.
  return [counter - 1, counter, counter + 1].map((step) => {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(step));
    const mac = createHmac('sha1', TOTP_SECRET_BYTES).update(message).digest();
    const offset = mac[mac.length - 1] & 0x0f;
    return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
  });
}

// Helpers that run inside the page. Prepended to every script sent to it.
const PAGE_HELPERS = `
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const find = (selector, text) =>
    [...document.querySelectorAll(selector)].find((element) =>
      text === undefined ? true : element.textContent.trim().includes(text));
  const until = async (test, what) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const value = test();
      if (value) return value;
      await wait(50);
    }
    throw new Error('Timed out waiting for ' + what);
  };
  const click = async (selector, text) => {
    const element = await until(() => {
      const candidate = find(selector, text);
      return candidate && !candidate.disabled ? candidate : null;
    }, selector + ' ' + (text ?? ''));
    element.click();
  };
  const field = (label) =>
    until(() => {
      const caption = [...document.querySelectorAll('.field__label')].find(
        (element) => element.textContent === label);
      return caption?.closest('label').querySelector('input, textarea');
    }, 'field ' + label);
  const type = async (label, value) => {
    const input = await field(label);
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const text = (selector) => document.querySelector(selector)?.textContent ?? null;
  const alertText = () => until(() => text('[role=alert]'), 'an error message');
`;

let passed = 0;
async function step(name, body) {
  try {
    await body();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

await build({ root, logLevel: 'error' });
const server = await preview({ root, logLevel: 'error', preview: { port: 0, host: '127.0.0.1' } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const downloads = await mkdtemp(join(tmpdir(), 'enclave-e2e-'));
const browser = await launchBrowser();

try {
  const page = await browser.openPage({ width: 1280, height: 860 });
  const run = (body) => page.evaluate(`(async () => { ${PAGE_HELPERS} ${body} })()`);
  const stored = () => run(`return localStorage.getItem(${JSON.stringify(STORAGE_KEY)});`);
  const load = async () => {
    await page.goto(origin);
    await page.waitForSelector('.auth__card');
  };
  const unlockWith = (password) =>
    run(`await type('Master password', ${JSON.stringify(password)}); await click('button', 'Unlock');`);
  const openSection = (label) => run(`await click('.nav-item', ${JSON.stringify(label)});`);

  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await load();

  await step('ships a Content-Security-Policy that forbids network access', async () => {
    const policy = await run(`return document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;`);
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /connect-src 'none'/);
  });

  await step('starts with nothing in storage', async () => {
    assert.equal(await run(`return text('.auth__title');`), 'Create your vault');
    assert.equal(await run(`return localStorage.length;`), 0);
  });

  await step('refuses a short master password', async () => {
    const message = await run(`
      await type('Master password', 'short');
      await type('Confirm master password', 'short');
      document.querySelector('.callout input[type=checkbox]').click();
      await click('button', 'Create vault');
      return alertText();
    `);
    assert.match(message, /at least 10 characters/);
    assert.equal(await stored(), null);
  });

  await step('refuses passwords that do not match', async () => {
    const message = await run(`
      await type('Master password', ${JSON.stringify(MASTER)});
      await type('Confirm master password', ${JSON.stringify(MASTER + 'x')});
      await click('button', 'Create vault');
      await wait(100);
      return alertText();
    `);
    assert.match(message, /do not match/);
    assert.equal(await stored(), null);
  });

  await step('creates a vault with the documented parameters', async () => {
    await run(`
      await type('Confirm master password', ${JSON.stringify(MASTER)});
      await click('button', 'Create vault');
    `);
    await page.waitForSelector('.workspace');

    const envelope = JSON.parse(await stored());
    assert.deepEqual(Object.keys(envelope), ['format', 'version', 'kdf', 'cipher', 'ciphertext']);
    assert.equal(envelope.format, 'enclave-vault');
    assert.equal(envelope.version, 1);
    assert.deepEqual({ ...envelope.kdf, salt: null }, {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 600_000,
      salt: null,
    });
    assert.equal(Buffer.from(envelope.kdf.salt, 'base64').length, 16);
    assert.equal(envelope.cipher.name, 'AES-GCM');
    assert.equal(Buffer.from(envelope.cipher.iv, 'base64').length, 12);
    assert.equal(await run(`return localStorage.length;`), 1);
  });

  await step('adds an item from an otpauth link and shows a correct one-time code', async () => {
    await run(`
      await click('button', 'New item');
      await type('Password', ${JSON.stringify(ITEM_PASSWORD)});
      await type('Website', 'example.com/login');
      await type('Authenticator key', ${JSON.stringify(OTPAUTH)});
      await type('Notes', 'first line\\n<b>not markup</b>');
      await click('.editor button', 'Save');
    `);
    await page.waitForSelector('.detail .code');
    await page.waitFor(`/^\\d{3} \\d{3}$/.test(document.querySelector('.detail .code').textContent)`, 'a code');

    // The name and username were left blank and come from the link.
    assert.equal(await run(`return text('.detail__title');`), 'Example Corp');
    assert.equal(await run(`return text('.detail-row__value');`), 'alice@example.com');

    const shown = (await run(`return text('.detail .code');`)).replace(' ', '');
    assert.ok(expectedCodes().includes(shown), `unexpected code ${shown}`);
  });

  await step('keeps the password out of the page until it is revealed', async () => {
    assert.equal(await run(`return document.body.innerHTML.includes(${JSON.stringify(ITEM_PASSWORD)});`), false);
    await run(`await click('button[aria-label="Show password"]');`);
    await page.waitFor(`document.querySelector('.secret').textContent === ${JSON.stringify(ITEM_PASSWORD)}`, 'the revealed password');
  });

  await step('renders notes as text and never links a non-web URL', async () => {
    assert.equal(await run(`return document.querySelector('.notes b') === null;`), true);
    assert.match(await run(`return text('.notes');`), /<b>not markup<\/b>/);
    assert.equal(await run(`return document.querySelector('.detail a').protocol;`), 'https:');

    await run(`
      await click('button[aria-label="Edit"]');
      await type('Website', 'javascript:alert(1)');
      await click('.editor button', 'Save');
    `);
    await page.waitForSelector('.detail');
    assert.equal(await run(`return document.querySelector('.detail a') === null;`), true);
  });

  await step('writes only ciphertext to storage', async () => {
    // Give the queued save a moment to land.
    await sleep(500);
    const text = await stored();
    for (const secret of [ITEM_PASSWORD, TOTP_SECRET, 'alice', 'Example', 'example.com', 'not markup']) {
      assert.equal(text.includes(secret), false, `storage contains "${secret}"`);
    }
  });

  await step('locks on reload and rejects the wrong password', async () => {
    await load();
    assert.equal(await run(`return text('.auth__title');`), 'Welcome back');
    assert.equal(await run(`return document.body.innerHTML.includes('Example Corp');`), false);

    await unlockWith(MASTER.toLowerCase());
    assert.match(await run(`return alertText();`), /not right/);
  });

  await step('unlocks with the right password and still has the item', async () => {
    await unlockWith(MASTER);
    await page.waitForSelector('.item');
    assert.equal(await run(`return text('.item__title');`), 'Example Corp');
  });

  await step('copies secrets and wipes them from the clipboard afterwards', async () => {
    // The real clipboard belongs to whoever is running the tests, so the page
    // gets a recording stand-in, and the wipe delay is cut from seconds to
    // milliseconds.
    await run(`
      window.clipboardWrites = [];
      Clipboard.prototype.writeText = async (value) => { window.clipboardWrites.push(value); };
      window.realSetTimeout = window.setTimeout;
      window.setTimeout = (callback, delay, ...rest) =>
        window.realSetTimeout(callback, delay >= 10_000 ? 200 : delay, ...rest);
    `);
    const writes = () => run(`return window.clipboardWrites;`);

    await run(`await click('.item'); await click('button[aria-label="Copy username"]');`);
    await page.waitFor(`document.querySelector('.toast')`, 'a toast');
    assert.equal(await run(`return text('.toast');`), 'Username copied.');
    await sleep(500);
    assert.deepEqual(await writes(), ['alice@example.com'], 'a username is not wiped');

    await run(`await click('button[aria-label="Copy password"]');`);
    await page.waitFor(`document.querySelector('.toast').textContent.startsWith('Password')`, 'a toast');
    assert.equal(await run(`return text('.toast');`), 'Password copied. Clipboard clears in 30s.');
    await page.waitFor(`window.clipboardWrites.length === 3`, 'the clipboard to be wiped');
    assert.deepEqual(await writes(), ['alice@example.com', ITEM_PASSWORD, '']);

    // Locking with a secret still on the clipboard wipes it straight away,
    // without waiting for the timer (which is back to its real length here).
    await run(`window.setTimeout = window.realSetTimeout;`);
    await run(`await click('button[aria-label="Copy code"]');`);
    await page.waitFor(`window.clipboardWrites.length === 4`, 'the code to be copied');
    await openSection('Lock');
    await page.waitFor(`window.clipboardWrites.length === 5`, 'the clipboard to be wiped on lock');
    assert.equal((await writes())[4], '');

    await unlockWith(MASTER);
    await page.waitForSelector('.item');
  });

  let backupFile;
  await step('exports a backup that is the same ciphertext as storage', async () => {
    await openSection('Settings');
    await run(`await click('button', 'Export');`);

    for (let attempt = 0; attempt < 50 && !backupFile; attempt += 1) {
      const name = (await readdir(downloads)).find((file) => /^enclave-backup-\d{4}-\d{2}-\d{2}\.json$/.test(file));
      if (name) backupFile = join(downloads, name);
      else await sleep(100);
    }
    assert.ok(backupFile, 'no backup file was downloaded');

    const backup = await readFile(backupFile, 'utf8');
    assert.deepEqual(JSON.parse(backup), JSON.parse(await stored()));
    assert.equal(backup.includes(ITEM_PASSWORD) || backup.includes('alice'), false);
  });

  await step('changes the master password only when the current one is known', async () => {
    const message = await run(`
      await click('button', 'Change');
      await type('Current password', 'not the password');
      await type('New password', ${JSON.stringify(NEW_MASTER)});
      await type('Confirm new password', ${JSON.stringify(NEW_MASTER)});
      await click('dialog button', 'Change password');
      return alertText();
    `);
    assert.match(message, /current password is not right/);

    const before = JSON.parse(await stored());
    await run(`
      await type('Current password', ${JSON.stringify(MASTER)});
      await click('dialog button', 'Change password');
    `);
    await page.waitFor(`!document.querySelector('dialog')`, 'the dialog to close');

    const after = JSON.parse(await stored());
    assert.notEqual(after.kdf.salt, before.kdf.salt);
    assert.notEqual(after.ciphertext, before.ciphertext);
  });

  await step('opens with the new password and no longer with the old one', async () => {
    await load();
    await unlockWith(MASTER);
    assert.match(await run(`return alertText();`), /not right/);

    await unlockWith(NEW_MASTER);
    await page.waitForSelector('.item');
  });

  await step('lock removes the decrypted contents from the page', async () => {
    await openSection('Lock');
    await page.waitForSelector('.auth__card');
    assert.equal(await run(`return document.body.innerHTML.includes('Example Corp');`), false);
    await unlockWith(NEW_MASTER);
    await page.waitForSelector('.item');
  });

  await step('deletes the vault from the browser', async () => {
    await openSection('Settings');
    await run(`
      await click('.settings-group--danger button', 'Delete');
      await click('dialog button', 'Delete vault');
    `);
    await page.waitFor(`document.querySelector('.auth__title')?.textContent === 'Create your vault'`, 'the setup screen');
    assert.equal(await run(`return localStorage.length;`), 0);
  });

  await step('restores a backup only once its password has opened it', async () => {
    const { result } = await page.call('Runtime.evaluate', {
      expression: `document.querySelector('input[type=file]')`,
    });
    await page.call('DOM.setFileInputFiles', { files: [backupFile], objectId: result.objectId });

    const message = await run(`
      await type('Backup password', 'not the password');
      await click('dialog button', 'Restore');
      return alertText();
    `);
    assert.match(message, /does not open this backup/);
    assert.equal(await stored(), null, 'a failed restore must not write anything');

    // The backup predates the password change, so it opens with the old one.
    await run(`
      await type('Backup password', ${JSON.stringify(MASTER)});
      await click('dialog button', 'Restore');
    `);
    await page.waitForSelector('.item');
    assert.equal(await run(`return text('.item__title');`), 'Example Corp');
    assert.deepEqual(JSON.parse(await stored()), JSON.parse(await readFile(backupFile, 'utf8')));
  });

  await step('refuses a file that is not a backup', async () => {
    await openSection('Settings');
    const { result } = await page.call('Runtime.evaluate', {
      expression: `document.querySelector('input[type=file]')`,
    });
    await page.call('DOM.setFileInputFiles', {
      files: [join(root, 'package.json')],
      objectId: result.objectId,
    });
    await page.waitFor(`document.querySelector('.toast--error')`, 'an error toast');
    assert.match(await run(`return text('.toast--error');`), /not an Enclave vault/);
    assert.equal(await run(`return document.querySelector('dialog') === null;`), true);
  });

  const lockScreenNotice = async (target = page) => {
    await target.waitFor(`document.querySelector('.auth__title')?.textContent === 'Welcome back'`, 'the lock screen');
    return target.evaluate(`document.querySelector('.callout')?.textContent ?? null`);
  };

  await step('locks by itself after the idle limit', async () => {
    // Move the page's clock past the default five minutes instead of waiting.
    await run(`window.realNow = Date.now; Date.now = () => window.realNow() + 5 * 60_000 + 1_000;`);
    assert.match(await lockScreenNotice(), /inactivity/);
    await run(`Date.now = window.realNow;`);
    await unlockWith(MASTER);
    await page.waitForSelector('.item');
  });

  await step('locks when the tab is hidden, once that setting is on', async () => {
    const hide = `
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    `;
    const lockOnHideSwitch = `find('label.setting', 'Lock when the tab is hidden').querySelector('.switch')`;

    // Off by default: hiding the tab does nothing.
    await run(hide);
    await sleep(300);
    assert.equal(await run(`return document.querySelector('.workspace') !== null;`), true);

    await openSection('Settings');
    await run(`${lockOnHideSwitch}.click();`);
    await sleep(500);
    await run(hide);
    assert.match(await lockScreenNotice(), /tab was hidden/);

    // The setting lives inside the encrypted vault, so it survives the lock.
    await unlockWith(MASTER);
    await openSection('Settings');
    assert.equal(await run(`return ${lockOnHideSwitch}.checked;`), true);
    await run(`${lockOnHideSwitch}.click();`);
    await sleep(500);
  });

  await step('locks a tab whose vault was changed in another tab', async () => {
    const other = await browser.openPage({ width: 1280, height: 860 });
    const runOther = (body) => other.evaluate(`(async () => { ${PAGE_HELPERS} ${body} })()`);
    await other.goto(origin);
    await other.waitForSelector('.auth__card');
    await runOther(`await type('Master password', ${JSON.stringify(MASTER)}); await click('button', 'Unlock');`);
    await other.waitForSelector('.item');
    await runOther(`
      await click('button', 'New item');
      await type('Name', 'Added elsewhere');
      await click('.editor button', 'Save');
    `);

    assert.match(await lockScreenNotice(), /changed in another tab/);
    await unlockWith(MASTER);
    await page.waitFor(`document.querySelectorAll('.item').length === 2`, 'both items');
    assert.deepEqual(other.errors, []);
    await other.close();
  });

  await step('generates passwords that follow the chosen options', async () => {
    await openSection('Generator');
    await page.waitForSelector('.generator__output');
    const first = await run(`return text('.generator__output');`);
    assert.equal(first.length, 20);

    await run(`await click('button', 'Regenerate');`);
    await page.waitFor(`document.querySelector('.generator__output').textContent !== ${JSON.stringify(first)}`, 'a new password');

    // Turn off everything except digits.
    await run(`
      for (const index of [0, 1, 3]) {
        document.querySelectorAll('.settings-group .switch')[index].click();
        await wait(30);
      }
    `);
    assert.match(await run(`return text('.generator__output');`), /^\d{20}$/);
    // The last remaining character set cannot be switched off.
    assert.equal(await run(`return document.querySelectorAll('.settings-group .switch')[2].disabled;`), true);
  });

  await step('logs no errors and never trips its own security policy', async () => {
    assert.deepEqual(page.errors, []);
  });

  await page.close();
  console.log(`\n${passed} end-to-end checks passed.`);
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
  await rm(downloads, { recursive: true, force: true });
}
