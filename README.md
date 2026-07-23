# Learning with Texts Desktop

Learning with Texts (LWT) is a local-first application for reading, vocabulary
tracking, spaced review, and language-learning library management. Your library
stays on your computer, and the main learning workflow is available offline.

## Install

Protected version tags produce Windows MSI/NSIS installers, Linux DEB and
AppImage packages, and an Arch Linux package. Windows installers are unsigned
and may display an unknown-publisher warning. Always download from the official
release and verify the supplied SHA-256 manifest. See
[Release Builds](docs/RELEASING.md) for installation and verification details.

Application data stays in the operating system's per-user application-data
directory. Create a portable JSON backup from **Backup** before upgrades or
moving to another computer.

## Develop

Install Node.js 20.19 or newer, Rust, and the platform dependencies listed by
[Tauri](https://v2.tauri.app/start/prerequisites/). Then run:

```bash
npm ci
npm run check
npm test
npm run dev
```

Use `npm run build` for native installers, `npm run package:arch` for the Arch
package, and `npm run test:e2e` for the packaged Linux workflow. Additional
requirements are documented in [End-to-End Tests](docs/E2E.md). Release
candidates should also follow the complete [QA Test Scenarios](docs/QA_TEST_SCENARIOS.md).

## Repository Layout

- `src/`: Rust commands, persistence, parsing, and schema orchestration.
- `migrations/`: ordered SQLite migrations embedded in the native binary.
- `web/`: TypeScript domain contracts, gateways, UI modules, and styles.
- `tests/` and `e2e/`: fixtures and packaged-application tests.
- `scripts/` and `packaging/`: release validation and native package recipes.
- `docs/`: architecture, release, security, QA, and operational guidance.

The WebView receives typed, scoped commands and never raw SQL, shell access, or
unrestricted filesystem access. See [Architecture](docs/ARCHITECTURE.md) and
[Legacy Import](docs/LEGACY_IMPORT.md) for implementation and data-transfer
details.

This project retains the upstream [LICENSE](LICENSE) and
[UNLICENSE.txt](UNLICENSE.txt).
