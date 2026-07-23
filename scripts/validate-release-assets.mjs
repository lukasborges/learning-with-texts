import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIREMENTS = [
  ['Linux DEB installer', (name) => name.endsWith('.deb'), 1],
  ['Linux AppImage', (name) => name.endsWith('.AppImage'), 1],
  ['Linux updater signature', (name) => name.endsWith('.AppImage.sig'), 1],
  ['Windows MSI installer', (name) => name.endsWith('.msi'), 1],
  ['Windows NSIS installer', (name) => name.endsWith('-setup.exe'), 1],
  ['Windows MSI updater signature', (name) => name.endsWith('.msi.sig'), 1],
  ['Windows NSIS updater signature', (name) => name.endsWith('-setup.exe.sig'), 1],
  ['Arch Linux package', (name) => name.endsWith('.pkg.tar.zst'), 1],
  ['updater manifest', (name) => name === 'latest.json', 1],
  ['CycloneDX SBOMs', (name) => name.endsWith('.cdx.json'), 3],
  ['platform checksum manifests', (name) => name.endsWith('.SHA256SUMS'), 3]
];
const UPDATE_PLATFORMS = ['linux-x86_64', 'windows-x86_64'];

export async function validateReleaseAssets(directory, expectedVersion) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const missing = [];
  for (const [label, matches, minimum] of REQUIREMENTS) {
    const count = files.filter(matches).length;
    if (count < minimum) {
      missing.push(`${label}: found ${count}, require at least ${minimum}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Release asset inventory is incomplete:\n${missing.join('\n')}`);
  }

  const updater = JSON.parse(await readFile(path.join(directory, 'latest.json'), 'utf8'));
  if (expectedVersion && updater.version !== expectedVersion) {
    throw new Error(
      `Updater manifest version ${updater.version ?? 'missing'} does not match ${expectedVersion}`
    );
  }
  for (const platform of UPDATE_PLATFORMS) {
    const metadata = updater.platforms?.[platform];
    if (
      !metadata ||
      typeof metadata.signature !== 'string' ||
      metadata.signature.length === 0 ||
      typeof metadata.url !== 'string' ||
      !metadata.url.startsWith('https://')
    ) {
      throw new Error(`Updater manifest is missing signed HTTPS metadata for ${platform}`);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

const isCommandLine = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCommandLine) {
  try {
    const directory = process.argv[2];
    const version = process.argv[3];
    if (!directory || !version || process.argv.length !== 4) {
      throw new Error('Usage: validate-release-assets.mjs <release-assets-directory> <version>');
    }
    const files = await validateReleaseAssets(path.resolve(directory), version);
    process.stdout.write(`Validated ${files.length} release asset(s).\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
