# Vault format

This is the complete description of what Enclave stores. It is short on purpose: the format is
meant to be simple enough to read in one sitting and to decrypt without Enclave.

The same JSON document is used in two places:

- in the browser, under the `localStorage` key `enclave.vault`
- in backup files (`enclave-backup-YYYY-MM-DD.json`)

A backup is a copy of what is in storage, byte for byte apart from whitespace.

## Envelope

```json
{
  "format": "enclave-vault",
  "version": 1,
  "kdf": {
    "name": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 600000,
    "salt": "<base64, 16 bytes>"
  },
  "cipher": {
    "name": "AES-GCM",
    "iv": "<base64, 12 bytes>"
  },
  "ciphertext": "<base64>"
}
```

Nothing in the envelope is secret. The salt, the IV and the iteration count can be public; the
ciphertext is unreadable without the master password.

| Field            | Meaning                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `format`         | Always `enclave-vault`.                                                            |
| `version`        | Format version. Currently `1`. A reader must refuse versions it does not know.     |
| `kdf.iterations` | PBKDF2 iteration count. New vaults use 600,000. Readers accept 100,000 to 10,000,000. |
| `kdf.salt`       | 16 random bytes. A new one is generated whenever the master password is set.       |
| `cipher.iv`      | 12 random bytes. A new one is generated for every save.                            |
| `ciphertext`     | AES-256-GCM output: the encrypted vault followed by the 16-byte authentication tag. |

## Deriving the key

1. Normalise the master password to Unicode NFKC and encode it as UTF-8.
2. Run PBKDF2-HMAC-SHA-256 over it with `kdf.salt` and `kdf.iterations`, producing 32 bytes.

Those 32 bytes are the AES-256 key. Nothing else is derived from the password, and neither the
password nor the key is ever stored.

## Decrypting

Decrypt `ciphertext` with AES-256-GCM using the key, `cipher.iv`, and this string, UTF-8 encoded,
as additional authenticated data:

```text
enclave-vault|1|PBKDF2|SHA-256|<kdf.iterations>|<kdf.salt>|AES-GCM
```

`<kdf.iterations>` is the number in decimal and `<kdf.salt>` is the base64 text exactly as it
appears in the envelope. Binding the header in this way means the format, the version and the key
derivation parameters cannot be changed without decryption failing.

A wrong password and a modified file fail in the same way: the authentication tag does not verify.
AES-GCM cannot tell the two apart, so neither can Enclave.

## Contents

The plaintext is UTF-8 JSON:

```json
{
  "items": [
    {
      "id": "0b9c1f6e-6f0e-4c3a-9d55-0d6d7b1f4a0e",
      "title": "Example",
      "username": "alice@example.com",
      "password": "…",
      "url": "https://example.com",
      "notes": "",
      "totp": { "secret": "JBSWY3DPEHPK3PXP", "algorithm": "SHA-1", "digits": 6, "period": 30 },
      "favorite": false,
      "createdAt": 1767225600000,
      "updatedAt": 1767225600000
    }
  ],
  "settings": {
    "autoLockMinutes": 5,
    "clipboardClearSeconds": 30,
    "lockOnHide": false
  },
  "createdAt": 1767225600000,
  "updatedAt": 1767225600000
}
```

- Timestamps are milliseconds since the Unix epoch.
- `totp` is `null` when an item has no authenticator key. `secret` is base32 (RFC 4648) without
  padding, `algorithm` is `SHA-1`, `SHA-256` or `SHA-512`, `digits` is 6 to 8, and `period` is in
  seconds. Codes follow RFC 6238.
- `autoLockMinutes` and `clipboardClearSeconds` use `0` to mean never.

When reading, Enclave treats every field as optional and falls back to a default for anything
missing or malformed, so a vault written by a later version with extra fields still opens.

## Decrypting without Enclave

[`scripts/decrypt.mjs`](../scripts/decrypt.mjs) implements everything above as one short Node
script, using only the standard library and sharing no code with the app:

```bash
node scripts/decrypt.mjs enclave-backup-2026-01-01.json
```

It asks for the master password and prints the contents as JSON. The test suite runs it against
vaults the app produces, so this document, the script and the app are checked against one another
on every change.

## Changing the format

Any change that an existing reader could not handle needs a new `version`, an update to this
document, and a migration path for existing vaults. Additive changes inside the encrypted contents
(a new optional field on an item, for example) do not.
