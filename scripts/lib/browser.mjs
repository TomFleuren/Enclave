// A very small headless-browser driver, shared by the capture and end-to-end
// scripts. It speaks the DevTools protocol to a locally installed Chrome or
// Edge over a websocket, which keeps the project free of a browser-automation
// dependency. Set CHROME_PATH if your browser is somewhere unusual.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) {
    throw new Error('No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser.');
  }
  return found;
}

async function connect(port) {
  let endpoint;
  for (let attempt = 0; attempt < 75 && !endpoint; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      endpoint = (await response.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  if (!endpoint) throw new Error('The browser did not open its debugging port.');

  const socket = new WebSocket(endpoint);
  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined) {
      for (const listener of listeners) listener(message);
      return;
    }
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.fail(new Error(`${waiter.method}: ${message.error.message}`));
    else waiter.done(message.result);
  });

  return {
    send: (method, params = {}, sessionId) =>
      new Promise((done, fail) => {
        const id = nextId++;
        pending.set(id, { done, fail, method });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      }),
    onEvent: (listener) => listeners.add(listener),
    close: () => socket.close(),
  };
}

/**
 * Starts a headless browser with a throwaway profile.
 * Call `close()` on the result when done; it also removes the profile.
 */
export async function launchBrowser() {
  const profile = await mkdtemp(join(tmpdir(), 'enclave-browser-'));
  const port = 9300 + Math.floor(Math.random() * 600);
  const child = spawn(
    findBrowser(),
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      // Hosted CI runners do not allow the browser to set up its sandbox.
      // Only pages served from this repository are ever loaded there.
      ...(process.env.CI ? ['--no-sandbox'] : []),
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let connection;
  try {
    connection = await connect(port);
  } catch (error) {
    child.kill();
    throw error;
  }

  return {
    send: connection.send,
    onEvent: connection.onEvent,
    /** Opens a tab at the given size and returns helpers for driving it. */
    async openPage({ width, height, scale = 1 }) {
      const { send, onEvent } = connection;
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const call = (method, params) => send(method, params, sessionId);

      // Uncaught errors and console.error output, for tests to assert on.
      const errors = [];
      onEvent((message) => {
        if (message.sessionId !== sessionId) return;
        if (message.method === 'Runtime.exceptionThrown') {
          const details = message.params.exceptionDetails;
          errors.push(details.exception?.description ?? details.text);
        }
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
          errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
        }
        // Browser-generated errors, which is where a blocked request or a
        // Content-Security-Policy violation is reported.
        if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
          errors.push(message.params.entry.text);
        }
      });

      await call('Page.enable');
      await call('Runtime.enable');
      await call('Log.enable');
      await call('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: scale,
        mobile: false,
      });

      const evaluate = async (expression) => {
        const { result, exceptionDetails } = await call('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
        });
        if (exceptionDetails) {
          throw new Error(exceptionDetails.exception?.description ?? 'evaluate failed');
        }
        return result.value;
      };

      const waitFor = async (condition, description = condition) => {
        for (let attempt = 0; attempt < 150; attempt += 1) {
          if (await evaluate(`Boolean(${condition})`)) return;
          await sleep(100);
        }
        throw new Error(`Timed out waiting for: ${description}`);
      };

      return {
        call,
        errors,
        evaluate,
        waitFor,
        waitForSelector: (selector) =>
          waitFor(`document.querySelector(${JSON.stringify(selector)})`, selector),
        goto: (url) => call('Page.navigate', { url }),
        async screenshot(file) {
          // Let entrance animations settle before the shutter.
          await sleep(700);
          const { data } = await call('Page.captureScreenshot', { format: 'png' });
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, Buffer.from(data, 'base64'));
        },
        close: () => send('Target.closeTarget', { targetId }),
      };
    },
    async close() {
      connection.close();
      child.kill();
      // The browser needs a moment to let go of its profile directory.
      await sleep(500);
      await rm(profile, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
    },
  };
}
