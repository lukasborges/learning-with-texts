# LWT Desktop

This directory contains the maintained local-first application. It packages a
TypeScript interface with a Tauri/Pake shell and a native Rust/SQLite runtime;
no legacy web server is started or bundled.

## Commands

```bash
npm install
npm run desktop:dev
npm run desktop:check
npm run desktop:test
npm run desktop:e2e
npm run desktop:build
npm run desktop:package:debug
npm run desktop:tauri:dev
npm run desktop:tauri:build
```

`desktop:build` writes a static, offline-capable web bundle to `dist-desktop/`. The package commands then use the pinned Pake CLI to wrap that directory in a native Tauri WebView. Native artifacts are written into this directory and ignored by Git.

`desktop:e2e` builds the custom Tauri DEB and drives first launch, reading,
review, statistics, backup, and restore through the native WebView. See
[E2E.md](E2E.md) for local and CI prerequisites.

Release CI produces Linux, Windows, and Intel/Apple Silicon macOS installers.
The manual matrix is unsigned; version tags use the protected signing,
notarization, SBOM, checksum, and updater workflow. See
[RELEASING.md](RELEASING.md) and [SIGNING.md](SIGNING.md).

SQLite versions 1 through 10 have explicit upgrade and rollback coverage. See
[SCHEMA_MIGRATIONS.md](SCHEMA_MIGRATIONS.md) for the data introduced by each
version and its test evidence.

## Current Boundary

The interface reads data through `LibraryGateway`. `MockLibraryGateway` supports browser development and automated tests. Tauri-mode builds use `TauriLibraryGateway` and native typed commands backed by SQLite.

No PHP sidecar is used. The generic Pake package proves that navigation, static assets, and typed contracts can run independently of the legacy runtime; the custom Tauri package adds native SQLite access.

## Legacy Data Migration

Using the frozen migration tag, open **Backup/Restore/Empty Database** in the legacy application and choose **Download Desktop Migration JSON**. In LWT Desktop, open **Backup**, select that JSON file, and confirm the restore. The import preserves languages, active texts, language settings, terms, translations, romanization, status dates, tags, tag assignments, and source references. Supported audio inside the legacy LWT directory is embedded in the migration file; remote, missing, oversized, and unsupported audio is reported. See [the complete migration guide](../MIGRATING_FROM_LEGACY_PHP.md).

The JSON reports unsupported data after import. Active and archived texts, their metadata, tag assignments, and applicable application preferences are preserved; colliding IDs from the two legacy text tables are remapped safely. Saved compound-term occurrences in active texts are reconstructed from their sentence and word ordinals and verified against the desktop parser; unmatched occurrences produce a restore warning instead of an incorrect link. Review-event history cannot be reconstructed. Keep the original SQL backup until the migrated library has been verified. See [SETTINGS_PARITY.md](SETTINGS_PARITY.md) for the complete legacy preference mapping.

## Runtime Status

The first Linux Pake packaging run completed successfully on July 22, 2026, producing both DEB and AppImage artifacts. PHP and MySQL are not started or bundled.

The custom runtime under `src-tauri/` is the foundation for native features that the generic Pake CLI cannot provide. It creates `lwt.sqlite3` in the platform application-data directory, applies transactional migrations, enables foreign keys, and exposes text CRUD commands. Texts can be pasted or loaded from UTF-8 `.txt` files, edited, tagged, archived/restored, given local audio, and deleted; languages are created on first use. Audio bytes are copied into transactional app-data storage and played without exposing arbitrary filesystem access. A Unicode-aware Rust parser stores ordered sentences, terms, and separators. Language settings support dictionary and translation links, reading text size, character substitutions, custom sentence terminators, per-character terms, space removal, and right-to-left reading; parsing changes reprocess affected texts transactionally. Application settings control library and tag pagination, visible word counts, and review pacing. The reading view persists shared term states, translations, romanization, tags, and compound expressions. Review sessions reveal answers, accept four ratings, schedule the next review, and retain an event history. The statistics view reports term and review progress by language and compares the current queue with an estimate from the legacy PHP score formula. The estimate is diagnostic only; the deterministic desktop scheduler remains authoritative. A versioned JSON backup round-trips the complete library, settings, and embedded media without exposing raw filesystem or SQL access to the WebView; restore validates relationships and rolls back on failure. Browser/Pake builds continue to use in-memory fixtures, while custom Tauri builds persist to SQLite. `desktop:check` and `desktop:test` validate both the web and Rust code.
