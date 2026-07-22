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

## Proof-of-Concept Status

The first Linux Pake packaging run completed successfully on July 22, 2026, producing both DEB and AppImage artifacts. PHP and MySQL are not started or bundled.

The custom runtime under `src-tauri/` is the foundation for native features that the generic Pake CLI cannot provide. It creates `lwt.sqlite3` in the platform application-data directory, applies transactional migrations, enables foreign keys, and exposes text CRUD commands. Texts can be pasted or loaded from UTF-8 `.txt` files, edited, and deleted; languages are created on first use. A Unicode-aware Rust parser stores ordered sentences, terms, and separators. The reading view renders those items and persists shared per-language term states using the legacy status codes for Learning, Known, and Ignored. Browser/Pake builds continue to use in-memory fixtures, while custom Tauri builds persist to SQLite. `desktop:check` and `desktop:test` validate both the web and Rust code.
