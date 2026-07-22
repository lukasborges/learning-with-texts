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
```

`desktop:build` writes a static, offline-capable web bundle to `dist-desktop/`. The package commands then use the pinned Pake CLI to wrap that directory in a native Tauri WebView. Native artifacts are written into this directory and ignored by Git.

## Current Boundary

The shell displays fixture data through `LibraryGateway`. `MockLibraryGateway` supports development and automated tests without PHP. `TauriLibraryGateway` defines the future native command boundary but is not activated until the Rust/SQLite layer exists.

This first slice deliberately contains no database access and no PHP sidecar. It proves that navigation, static assets, typed data contracts, and Pake packaging can exist independently of the legacy runtime.

## Proof-of-Concept Status

The first Linux packaging run completed successfully on July 22, 2026, producing both DEB and AppImage artifacts. The application renders offline fixture data; PHP and MySQL are not started or bundled. The next slice is the SQLite/Rust foundation required to replace the mock gateway.
