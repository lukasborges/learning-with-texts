# Desktop Release Builds

The `Desktop Release Artifacts` workflow builds unsigned native installers on
their target operating systems. It runs manually or for tags matching `v*`.

| Artifact | Runner | Bundles |
| --- | --- | --- |
| `lwt-desktop-linux-x86_64` | Ubuntu 24.04 | DEB, AppImage |
| `lwt-desktop-windows-x86_64` | Windows 2025 | MSI, NSIS setup |
| `lwt-desktop-macos-aarch64` | macOS 15 ARM | DMG |
| `lwt-desktop-macos-x86_64` | macOS 15 Intel | DMG |

Every matrix job installs from `package-lock.json`, runs TypeScript/Rust checks
and tests, then builds with the repository-pinned Tauri CLI. Artifacts use stable
names and are retained for 30 days. Linux AppImages bundle the WebKit media
framework required for local audio playback. The separate Linux E2E workflow
continues to test first launch and core workflows through the native WebView.

## Local Build

Install the platform prerequisites, run `npm ci`, and build from `desktop/`:

```bash
# Linux
NO_STRIP=1 npx tauri build --bundles deb,appimage

# Windows
npx tauri build --bundles msi,nsis

# macOS
npx tauri build --bundles dmg
```

These artifacts are intentionally unsigned. Do not present them as trusted
production releases until the signing, notarization, checksum, SBOM, and updater
stage is complete.

`NO_STRIP=1` avoids the old `linuxdeploy` strip binary rejecting modern RELR
sections while still allowing Rust's release profile to optimize the app binary.
