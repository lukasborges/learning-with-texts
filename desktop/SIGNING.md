# Desktop Release Trust

Production releases are created only by `Signed Desktop Release` for a `v*`
tag. The workflow targets the protected `desktop-production` GitHub Environment,
creates a draft release, signs supported update bundles, Authenticode
signs Windows installers, and signs/notarizes macOS DMGs. The manual `Desktop
Release Artifacts` workflow is an unsigned packaging test and must never be
promoted as a trusted release.

## Secret Contract

Configure required reviewers and allow only protected `v*` tags in the
`desktop-production` Environment. Store the following there, not as repository
or organization-wide secrets:

| Name | Scope and purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater private key; release job only. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for that updater key. |
| `WINDOWS_CERTIFICATE_BASE64` | Base64 PFX containing the Windows code-signing key. |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the PFX. |
| `APPLE_CERTIFICATE` | Base64 Developer ID Application `.p12`. |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12`. |
| `APPLE_KEYCHAIN_PASSWORD` | Ephemeral CI keychain password. |
| `APPLE_API_PRIVATE_KEY` | App Store Connect notarization `.p8` contents. |
| `APPLE_API_ISSUER` | App Store Connect API issuer. |
| `APPLE_API_KEY_ID` | App Store Connect API key identifier. |

Add `TAURI_UPDATER_PUBLIC_KEY` as an Environment variable. It is public and is
embedded in the application. Grant the App Store Connect key only Developer
access. Prefer a dedicated, export-restricted Windows signing identity when the
provider supports it. The workflow uses only the generated `GITHUB_TOKEN` with
`contents: write`; do not create a personal access token. CI imports credentials
into temporary stores and removes them immediately after packaging, before any
SBOM action runs.

## Release and Verification

1. Update the version consistently in `package.json`, `Cargo.toml`, and
   `tauri.conf.json`; commit it before creating `vX.Y.Z`.
2. Push the tag and approve all four jobs in `desktop-production`.
3. Keep the GitHub release as a draft until every job succeeds. Confirm that
   installers (including the Arch `.pkg.tar.zst`), updater bundles, `.sig`
   files, `latest.json`, per-platform
   `*.SHA256SUMS`, and CycloneDX SBOMs are attached.
4. Verify hashes with `sha256sum --check <platform>.SHA256SUMS`. On Windows run
   `Get-AuthenticodeSignature <installer>` and require `Status: Valid`. On macOS
   run `codesign --verify --deep --strict <app>`, `spctl --assess --type open
   <dmg>`, and `xcrun stapler validate <dmg>`.
5. Install the draft on clean target systems, test backup/restore and an update
   from the previous version, then publish it.

Arch installations are updated by pacman/AUR, not by the AppImage updater. The
package is built only after all signed platform jobs succeed and is attached to
the same protected draft with its checksum and SBOM.

## Rotation and Recovery

Rotate platform certificates before expiry and validate a draft on clean
machines. Updater-key rotation requires a bridge release: sign it with the old
private key while embedding the new public key, wait for adoption, then destroy
the old key. Keep encrypted, access-logged recovery copies offline until that
bridge window closes.

If any signing key may be compromised, stop the workflow, leave/delete affected
drafts, revoke the platform credential, and audit workflow history. Never use a
suspect updater key for a bridge release; publish a clean, newly signed manual
installer and require users to reinstall. Restore a deleted release only from a
verified tag and reproducible clean build, then regenerate SBOMs and checksums.
