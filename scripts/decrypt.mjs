// Decrypts an Enclave backup without Enclave.
//
// Usage: node scripts/decrypt.mjs enclave-backup-2026-01-01.json
//
// It asks for the master password and prints the vault contents as JSON.
// The output contains every password and authenticator key in the clear, so
// think about where it ends up before redirecting it to a file.
//
// This script deliberately shares no code with the app. It follows
// docs/vault-format.md using nothing but Node's standard library, which makes
// it both a way out if the app is ever unavailable and a check that the
// format is what the documentation says it is.

import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

function askPassword() {
  // Piped input (for scripting): read one line, without a prompt.
  if (!process.stdin.isTTY) {
    return new Promise((done) => {
      const lines = createInterface({ input: process.stdin });
      lines.once('line', (line) => {
        lines.close();
        done(line);
      });
    });
  }

  // Interactive: prompt on stderr and do not echo what is typed.
  return new Promise((done) => {
    const prompt = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    prompt._writeToOutput = (text) => {
      if (text.includes('Master password')) process.stderr.write(text);
    };
    prompt.question('Master password: ', (answer) => {
      prompt.close();
      process.stderr.write('\n');
      done(answer);
    });
  });
}

const [file] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/decrypt.mjs <backup.json>');
  process.exit(2);
}

const envelope = JSON.parse(readFileSync(file, 'utf8'));
if (envelope.format !== 'enclave-vault' || envelope.version !== 1) {
  console.error('This is not a version 1 Enclave vault.');
  process.exit(1);
}

const password = await askPassword();
const { kdf, cipher } = envelope;

const key = pbkdf2Sync(
  password.normalize('NFKC'),
  Buffer.from(kdf.salt, 'base64'),
  kdf.iterations,
  32,
  'sha256',
);

// The last 16 bytes of the ciphertext are the GCM authentication tag.
const data = Buffer.from(envelope.ciphertext, 'base64');
const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(cipher.iv, 'base64'));
decipher.setAuthTag(data.subarray(data.length - 16));
decipher.setAAD(
  Buffer.from(`enclave-vault|1|PBKDF2|SHA-256|${kdf.iterations}|${kdf.salt}|AES-GCM`, 'utf8'),
);

let plaintext;
try {
  plaintext = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
} catch {
  console.error('Wrong master password, or the file has been modified.');
  process.exit(1);
}

console.log(JSON.stringify(JSON.parse(plaintext.toString('utf8')), null, 2));
