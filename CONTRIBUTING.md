# Contributing to Enclave

Thanks for wanting to help. Bug reports, fixes, documentation and ideas are all welcome.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

> Found a security problem? Please do not open an issue or a pull request for it. Follow the
> [security policy](SECURITY.md) instead.

## Getting set up

You need [Node.js](https://nodejs.org) 22.13 or later (the project is developed on Node 24) and
npm.

```bash
git clone https://github.com/TomFleuren/Enclave.git
cd Enclave
npm install
npm run dev
```

The dev server prints the address to open. To look around without creating a vault, add `#demo` to
that address: it loads an in-memory vault filled with made-up items. The demo exists only in
development and is left out of production builds.

## Commands

| Command            | What it does                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| `npm run dev`      | Start the dev server with hot reloading                                |
| `npm run check`    | Typecheck, lint, unit tests and production build, in that order        |
| `npm test`         | Unit tests (Vitest)                                                    |
| `npm run test:e2e` | Build the app and drive it through a real browser                      |
| `npm run lint`     | ESLint                                                                 |
| `npm run build`    | Typecheck and build into `dist/`                                       |
| `npm run preview`  | Serve the production build locally                                     |
| `npm run capture`  | Regenerate the README banner and screenshots                           |

`test:e2e` and `capture` need Chrome or Edge installed. They drive it directly over the DevTools
protocol, so there is nothing extra to install. Set `CHROME_PATH` if the browser is not found.

## Before opening a pull request

1. Run `npm run check` and `npm run test:e2e`. CI runs the same things.
2. Add or update tests for what you changed. Anything under `src/crypto` or `src/vault` needs
   tests; that code is the reason the project exists.
3. Keep the change focused. A small pull request that does one thing is reviewed much faster than
   a large one that does several.
4. Describe what you changed and how you checked it. The pull request template has prompts.

## Ground rules for this codebase

These are what keep Enclave trustworthy, so pull requests are held to them.

- **No network access.** The app makes no requests. The production build enforces that with a
  Content-Security-Policy, and the end-to-end test fails if the page trips it.
- **No new runtime dependencies without a very good reason.** React is the only one. Every
  dependency is code that runs next to people's passwords, so the bar is high. Development
  dependencies are less sensitive but should still earn their place.
- **No home-made cryptography.** Encryption, key derivation and HMAC come from the browser's Web
  Crypto API. Enclave decides how to combine them and nothing more.
- **Random means `crypto.getRandomValues`.** Never `Math.random` for anything a secret depends on.
- **The vault format is a contract.** If a change alters what is written to storage, update
  [docs/vault-format.md](docs/vault-format.md) and `scripts/decrypt.mjs`, and bump the format
  version if existing readers could not cope.
- **Treat vault contents as untrusted when rendering.** Item fields are shown as text. Links are
  only made from `http` and `https` URLs.

## Project layout

| Path              | What lives there                                                        |
| ----------------- | ----------------------------------------------------------------------- |
| `src/crypto/`     | Key derivation, encryption, one-time codes, password generation         |
| `src/vault/`      | The vault data model, storage, backups                                  |
| `src/state/`      | React providers: the vault session, toasts and the clipboard            |
| `src/hooks/`      | Auto-lock and one-time-code hooks                                       |
| `src/screens/`    | Setup, unlock and the unlocked workspace                                |
| `src/views/`      | Vault, authenticator, generator and settings                            |
| `src/components/` | Shared UI pieces                                                        |
| `src/dev/`        | The development-only demo vault                                         |
| `scripts/`        | End-to-end test, screenshot capture, stand-alone decryption             |
| `docs/`           | Vault format, banner source, screenshots                                |

`src/crypto` and `src/vault` have no React in them and can be read on their own.

## Style

TypeScript in strict mode, two-space indentation, single quotes. ESLint covers the rest. Comments
explain why something is the way it is; the code should already say what it does.

## Licence

Contributions are accepted under the project's [MIT licence](LICENSE).
