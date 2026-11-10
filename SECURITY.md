# Security Policy

Enclave stores credentials, so security reports are taken seriously and are very welcome.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub: go to the
[Security tab](https://github.com/TomFleuren/Enclave/security) of this repository and choose
**Report a vulnerability**. That opens a private advisory that only the maintainers can see.

If that option is not available to you, open an issue that says only that you have a security
report to make, with no details, and a maintainer will get in touch to arrange a private channel.

A useful report includes:

- what an attacker could do, and what they would need in order to do it
- the steps, or a proof of concept, that demonstrate it
- the browser and version you tested with, and the Enclave version or commit

You can expect an acknowledgement within a few days. This is a volunteer project, so there is no
bug bounty, but you will be credited in the fix and the release notes unless you would rather not
be.

## Supported versions

Enclave is in beta. Security fixes are made on the `main` branch and included in the next release;
older versions are not patched separately.

## What counts as a vulnerability

Enclave's promise is narrow, and it helps to be exact about it.

**In scope.** Anything that breaks one of these:

- The contents of a vault cannot be read from what Enclave stores, or from a backup file, without
  the master password.
- A stored vault or backup that has been modified does not decrypt.
- Enclave makes no network requests and sends nothing off the device.
- Content inside a vault (an item name, a note, a URL, an imported backup) cannot run script in the
  page or make it misbehave.

**Out of scope.** Enclave cannot defend against these, and says so in the
[README](README.md#security-model):

- malware, a keylogger or a hostile browser extension on the device
- someone using the browser while the vault is unlocked
- a weak or reused master password being guessed
- whoever hosts the page serving altered code; run it from a host you trust, or locally

Reports that boil down to one of the out-of-scope items are still welcome as hardening ideas in a
regular issue.

## A note on audits

Enclave has not had an independent security audit. It uses the browser's own implementations of
AES-GCM, PBKDF2 and HMAC rather than implementing any cryptography itself, and the way it uses
them is documented in [docs/vault-format.md](docs/vault-format.md) so that it can be reviewed.
Please weigh that when deciding what to keep in it.
