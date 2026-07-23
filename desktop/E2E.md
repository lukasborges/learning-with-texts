# Packaged-App End-to-End Tests

The Linux suite drives the real Tauri binary produced by the debug DEB build.
It launches with an isolated `XDG_DATA_HOME`, verifies an empty first launch,
creates and reads a text, saves and reviews a term, checks statistics, exports a
backup, and restores the legacy migration fixture.

## Prerequisites

- Node.js 20.19 or newer and the repository dependencies (`npm ci`).
- Rust and the standard Tauri Linux build dependencies.
- `WebKitWebDriver` (`webkit2gtk-driver` on Debian/Ubuntu).
- `tauri-driver` 2.0.6: `cargo install tauri-driver --version 2.0.6 --locked`.
- A graphical session, or `xvfb-run -a` in CI.

Run the packaged build and suite together:

```bash
npm run desktop:e2e
```

To reuse an existing debug binary, run `npm run desktop:test:e2e`. Set
`LWT_E2E_BINARY` when the binary is not at
`desktop/src-tauri/target/debug/lwt-desktop`. Set `TAURI_DRIVER` if the driver
is not installed in Cargo's default binary directory.

Linux and Windows can use the official `tauri-driver`. macOS distribution and
its WKWebView test strategy are deferred until Apple build and signing access
is available.
