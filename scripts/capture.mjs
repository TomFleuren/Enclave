// Regenerates the images used in the README:
//
//   docs/banner.png              rendered from docs/banner.html
//   docs/screenshots/*.png       the running app, filled with demo data
//
// Usage: npm run capture
//
// It starts the Vite dev server, opens the app's development demo (/#demo) in
// a headless browser and saves what it sees.

import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { launchBrowser, sleep } from './lib/browser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');

async function save(page, file) {
  // Wait for the fonts, so that no shot is taken in the fallback typeface.
  await page.evaluate(
    `Promise.all([...document.fonts].map((font) => font.load())).then(() => document.fonts.ready).then(() => true)`,
  );
  await page.screenshot(file);
  console.log(`wrote ${relative(root, file).replaceAll('\\', '/')}`);
}

async function captureBanner(browser) {
  const page = await browser.openPage({ width: 1280, height: 640, scale: 2 });
  await page.goto(pathToFileURL(join(docs, 'banner.html')).href);
  await page.waitForSelector('.banner');
  await save(page, join(docs, 'banner.png'));
  await page.close();
}

async function captureApp(browser, origin) {
  const shots = join(docs, 'screenshots');
  const openSection = (label) =>
    page.evaluate(
      `[...document.querySelectorAll('.nav-item')].find((item) => item.textContent.includes(${JSON.stringify(label)})).click()`,
    );

  // One-time codes turn red in their last seconds. Start early in a 30-second
  // period, so that the shots show them as they look most of the time.
  const intoPeriod = Date.now() % 30_000;
  if (intoPeriod > 12_000) await sleep(30_000 - intoPeriod);

  const page = await browser.openPage({ width: 1440, height: 900, scale: 2 });
  await page.goto(`${origin}/#demo`);
  await page.waitForSelector('.item');

  await page.evaluate(`document.querySelector('.item').click()`);
  await page.waitForSelector('.detail .code');
  await save(page, join(shots, 'vault.png'));

  await openSection('Authenticator');
  await page.waitForSelector('.code-card');
  await save(page, join(shots, 'authenticator.png'));

  await openSection('Generator');
  await page.waitForSelector('.generator__output');
  await save(page, join(shots, 'generator.png'));

  await page.close();
}

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await launchBrowser();

try {
  await captureBanner(browser);
  await captureApp(browser, origin);
} finally {
  await browser.close();
  await server.close();
}
