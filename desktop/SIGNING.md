# Desktop Release Trust

Production releases are created only by `Signed Desktop Release` for a `v*`
tag. The workflow targets the protected `desktop-production` GitHub Environment,
creates a draft release, signs supported update bundles, Authenticode
signs Windows installers, and publishes Linux packages. macOS distribution is
deferred. The manual `Desktop Release Artifacts` workflow is an unsigned
packaging test and must never be promoted as a trusted release.

## Secret Contract

Configure required reviewers and allow only protected `v*` tags in the
`desktop-production` Environment. Store the following there, not as repository
or organization-wide secrets:

The environment and tag policy were provisioned on July 22, 2026. The
`lukasborges` account must approve each deployment. The updater private key,
password, and matching public variable are configured. Only the Windows
code-signing identity remains before creating the first version tag.

| Name | Scope and purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater private key; release job only. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for that updater key. |
| `WINDOWS_CERTIFICATE_BASE64` | Base64 PFX containing the Windows code-signing key. |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the PFX. |

The publisher is an individual resident in Brazil. The PFX contract applies
only if the chosen certificate provider supplies an exportable identity;
otherwise replace it with that provider's supported remote-signing integration
before the first release.

Add `TAURI_UPDATER_PUBLIC_KEY` as an Environment variable. It is public and is
embedded in the application. Prefer a dedicated, export-restricted Windows
signing identity when the provider supports it. The workflow uses only the
generated `GITHUB_TOKEN` with `contents: write`; do not create a personal access
token. CI imports credentials into temporary stores and removes them immediately
after packaging, before any SBOM action runs.

Generate the updater key interactively from the repository root with
`npm run desktop:generate:updater-key`. The helper installs the locked Tauri CLI
when necessary, writes the key pair under the user's local data directory,
refuses to overwrite an existing key, and restricts private-key permissions.
Keep a separate encrypted recovery copy before adding its contents to GitHub.

## Release and Verification

1. Update the version consistently in `package.json`, `package-lock.json`,
   `Cargo.toml`, `Cargo.lock`, and `tauri.conf.json`; commit it before creating
   `vX.Y.Z`. Run `npm run desktop:validate:release -- --tag vX.Y.Z` locally;
   the protected workflow repeats this check before accessing credentials.
2. Push the tag and approve the protected `desktop-production` deployments.
3. Keep the GitHub release as a draft until every job succeeds. Confirm that
   installers (including the Arch `.pkg.tar.zst`), updater bundles, `.sig`
   files, `latest.json`, per-platform
   `*.SHA256SUMS`, the release-wide `SHA256SUMS`, and CycloneDX SBOMs are
   attached.
4. Verify every attached asset with `sha256sum --check SHA256SUMS`; use the
   platform manifests for focused checks. On Windows run
   `Get-AuthenticodeSignature <installer>` and require `Status: Valid`. The
   workflow runs this check before its integrity jobs.
5. Install the draft on clean target systems, test backup/restore and an update
   from the previous version, then publish it.

Arch installations are updated by pacman/AUR, not by the AppImage updater. The
package is built only after all signed platform jobs succeed and is attached to
the same protected draft with its checksum and SBOM.

macOS is not a supported release target in the current scope. Reintroducing it
requires Apple build access, Developer ID signing, notarization, both target
architectures, and clean-machine acceptance evidence before changing the
support statement.

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
