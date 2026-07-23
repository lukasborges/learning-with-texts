# Desktop Release Builds

The `Desktop Release Artifacts` workflow builds unsigned native installers on
their target operating systems. It runs only when manually dispatched.

| Artifact | Runner | Bundles |
| --- | --- | --- |
| `lwt-desktop-linux-x86_64` | Ubuntu 24.04 | DEB, AppImage |
| `lwt-desktop-arch-x86_64` | Arch Linux container | pacman `.pkg.tar.zst` |
| `lwt-desktop-windows-x86_64` | Windows 2025 | MSI, NSIS setup |

Every matrix job installs from `package-lock.json`, runs TypeScript/Rust checks
and tests, then builds with the repository-pinned Tauri CLI. Each retained
artifact set includes a CycloneDX JSON SBOM and `SHA256SUMS`; the latter covers
every installer and the SBOM. Artifacts use stable names and are retained for 30
days. The Linux jobs install and remove the generated DEB and pacman packages in
their clean runners before publishing them. Linux AppImages bundle the WebKit
media framework required for local audio playback. The separate Linux E2E
workflow continues to test first launch and core workflows through the native
WebView.

## Local Build

Install the platform prerequisites, run `npm ci`, and build from the repository root.
Linux AppImage builds also require `patchelf` (the CI workflows install it):

```bash
# Linux
NO_STRIP=1 npx tauri build --bundles deb,appimage

# Arch Linux (run from the repository root)
npm run package:arch

# Windows
npx tauri build --bundles msi,nsis
```

These artifacts are intentionally unsigned. Do not present them as trusted
production releases until the signing and updater stage is complete. macOS is
not part of the current release matrix and remains deferred until Apple build
and signing access is available.

Windows MSI and NSIS installers intentionally have no Authenticode publisher
signature and can show an unknown-publisher or SmartScreen warning. Users must
download them from the official release and verify `SHA256SUMS`. Tauri updater
artifacts remain cryptographically signed independently of Authenticode.

Production `v*` tags instead invoke `Signed Desktop Release`. That protected
workflow creates a draft GitHub release with signed updater bundles and a
user-visible update channel. Provisioning, approval, verification, rotation,
and recovery procedures are in [SIGNING.md](SIGNING.md).

After every signed platform and Arch job succeeds, a final integrity job
downloads all assets from the draft and rejects incomplete platform, updater,
SBOM, or checksum inventories. It then verifies a complete `SHA256SUMS`
covering installers, updater bundles and signatures, SBOMs, per-platform
manifests, and `latest.json`, and attaches that global manifest to the draft.

Before publishing a production release, complete the independent
[nontechnical user acceptance test](USER_ACCEPTANCE.md) and retain its test
records with the release evidence.

The Arch package is built natively from source and installed with
`sudo pacman -U lwt-desktop-<version>-1-x86_64.pkg.tar.zst`. It intentionally
uses pacman/AUR upgrades instead of Tauri's AppImage updater. Its PKGBUILD input
files are hashed, and the resulting package is covered by the release checksum
and SBOM like every other artifact.

## Verify an Artifact

Keep the downloaded files and `SHA256SUMS` in the same directory structure as
the workflow artifact. From that artifact's root directory, run:

```bash
sha256sum --check SHA256SUMS
```

On Windows, compare an individual entry with
`Get-FileHash -Algorithm SHA256 <installer>`. A missing file, unexpected file,
or hash mismatch must stop installation and release promotion. The
`*.cdx.json` file is the machine-readable dependency and package inventory for
security review and incident response.

`NO_STRIP=1` avoids the old `linuxdeploy` strip binary rejecting modern RELR
sections while still allowing Rust's release profile to optimize the app binary.
