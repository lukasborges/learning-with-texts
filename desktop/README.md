# LWT Desktop Shell

This directory contains the isolated desktop migration scaffold. It does not change or serve the legacy PHP application.

## Commands

```bash
npm install
npm run desktop:dev
npm run desktop:check
npm run desktop:test
npm run desktop:build
npm run desktop:package:debug
npm run desktop:tauri:dev
npm run desktop:tauri:build
```

`desktop:build` writes a static, offline-capable web bundle to `dist-desktop/`. The package commands then use the pinned Pake CLI to wrap that directory in a native Tauri WebView. Native artifacts are written into this directory and ignored by Git.

## Current Boundary

The shell reads data through `LibraryGateway`. `MockLibraryGateway` supports browser development and automated tests without PHP. Tauri-mode builds use `TauriLibraryGateway` and the native `list_texts` command backed by SQLite.

No PHP sidecar is used. The generic Pake package proves that navigation, static assets, and typed contracts can run independently of the legacy runtime; the custom Tauri package adds native SQLite access.

## Legacy Data Migration

In the legacy PHP application, open **Backup/Restore/Empty Database** and choose **Download Desktop Migration JSON**. In LWT Desktop, open **Backup**, select that JSON file, and confirm the restore. The import preserves languages, active texts, language settings, terms, translations, romanization, status dates, tags, tag assignments, and media/source references.

The JSON reports unsupported data after import. Active and archived texts, their metadata, and tag assignments are preserved; colliding IDs from the two legacy text tables are remapped safely. Saved compound-term occurrences in active texts are reconstructed from their sentence and word ordinals and verified against the desktop parser; unmatched occurrences produce a restore warning instead of an incorrect link. Review-event history cannot be reconstructed. Keep the original SQL backup until the migrated library has been verified.

## Proof-of-Concept Status

The first Linux Pake packaging run completed successfully on July 22, 2026, producing both DEB and AppImage artifacts. PHP and MySQL are not started or bundled.

The custom runtime under `src-tauri/` is the foundation for native features that the generic Pake CLI cannot provide. It creates `lwt.sqlite3` in the platform application-data directory, applies transactional migrations, enables foreign keys, and exposes text CRUD commands. Texts can be pasted or loaded from UTF-8 `.txt` files, edited, tagged, archived/restored, and deleted; languages are created on first use. A Unicode-aware Rust parser stores ordered sentences, terms, and separators. Language settings support character substitutions, custom sentence terminators, per-character terms, space removal, and right-to-left reading; parsing changes reprocess affected texts transactionally. The reading view persists shared term states, translations, romanization, tags, and compound expressions. Review sessions reveal answers, accept four ratings, schedule the next review, and retain an event history. The statistics view reports term and review progress by language and compares the current queue with an estimate from the legacy PHP score formula. The estimate is diagnostic only; the deterministic desktop scheduler remains authoritative. A versioned JSON backup round-trips the complete library without exposing raw filesystem or SQL access to the WebView; restore validates relationships and rolls back on failure. Browser/Pake builds continue to use in-memory fixtures, while custom Tauri builds persist to SQLite. `desktop:check` and `desktop:test` validate both the web and Rust code.
