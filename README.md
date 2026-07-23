# Learning with Texts Desktop

Learning with Texts (LWT) is now a local-first desktop application for reading,
tracking vocabulary, reviewing terms, and preserving a language-learning
library. It runs on SQLite inside a Tauri/Pake desktop shell; end users do not
install PHP, Apache, MySQL/MariaDB, XAMPP, MAMP, or Docker.

## Install

Signed Windows and Linux installers are produced from version tags by the
protected release workflow. macOS distribution is deferred until Apple build
and signing access is available. Until the first production run is verified,
use artifacts from the manual workflow only for testing; those artifacts are
explicitly unsigned. Release and verification details are in
[desktop/RELEASING.md](desktop/RELEASING.md).

Arch Linux users can install the native package with
`sudo pacman -U lwt-desktop-<version>-1-x86_64.pkg.tar.zst`.

Application data is stored in the operating system's per-user application-data
directory. Use **Backup** in the application to create a portable JSON snapshot
before upgrading or moving to another computer.

## Develop

Install Node.js 20.19 or newer, Rust, and the platform prerequisites from the
[Tauri documentation](https://v2.tauri.app/start/prerequisites/). Then run:

```bash
npm ci
npm run desktop:check
npm run desktop:test
npm run desktop:tauri:dev
```

`npm run desktop:build` creates the static Pake web bundle.
`npm run desktop:tauri:build` creates native installers with the custom SQLite
runtime. Packaged Linux end-to-end tests are available through
`npm run desktop:e2e` after installing the prerequisites in [desktop/E2E.md](desktop/E2E.md).

## Architecture and Migration

The TypeScript frontend is under `desktop/web/`; native commands, SQLite
migrations, and tests are under `desktop/src-tauri/`. The WebView receives only
typed, scoped commands—never raw SQL, shell access, or unrestricted filesystem
access. See [desktop/README.md](desktop/README.md) and
[desktop/MVP_PARITY.md](desktop/MVP_PARITY.md) for the implemented workflows and
runtime boundary.

Existing PHP LWT users should follow
[Migrating from Legacy PHP LWT](MIGRATING_FROM_LEGACY_PHP.md). The frozen
exporter remains available in the `legacy-php-migration-v25.10.0` tag and
`legacy-php-maintenance` branch; the maintained desktop branch contains no
legacy server runtime.

This project retains the upstream licensing files [LICENSE](LICENSE) and
[UNLICENSE.txt](UNLICENSE.txt).
