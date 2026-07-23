import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateReleaseAssets } from './validate-release-assets.mjs';

const completeAssets = [
  'LWT_1.0.0_amd64.deb',
  'LWT_1.0.0_amd64.AppImage',
  'LWT_1.0.0_amd64.AppImage.sig',
  'LWT_1.0.0_x64_en-US.msi',
  'LWT_1.0.0_x64_en-US.msi.sig',
  'LWT_1.0.0_x64-setup.exe',
  'LWT_1.0.0_x64-setup.exe.sig',
  'lwt-desktop-1.0.0-1-x86_64.pkg.tar.zst',
  'latest.json',
  ...Array.from({ length: 3 }, (_, index) => `platform-${index}.cdx.json`),
  ...Array.from({ length: 3 }, (_, index) => `platform-${index}.SHA256SUMS`)
];
const updaterManifest = {
  version: '1.0.0',
  platforms: Object.fromEntries(
    ['linux-x86_64', 'windows-x86_64'].map(
      (platform) => [platform, { signature: `signed-${platform}`, url: `https://example.com/${platform}` }]
    )
  )
};

async function createAssets(names) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lwt-release-assets-'));
  await Promise.all(
    names.map((name) =>
      writeFile(
        path.join(directory, name),
        name === 'latest.json' ? JSON.stringify(updaterManifest) : name
      )
    )
  );
  return directory;
}

test('accepts the complete supported-platform signed release inventory', async () => {
  const directory = await createAssets(completeAssets);
  try {
    assert.equal((await validateReleaseAssets(directory, '1.0.0')).length, completeAssets.length);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects updater metadata that omits a supported platform', async () => {
  const directory = await createAssets(completeAssets);
  try {
    const incompleteUpdater = structuredClone(updaterManifest);
    delete incompleteUpdater.platforms['windows-x86_64'];
    await writeFile(path.join(directory, 'latest.json'), JSON.stringify(incompleteUpdater));
    await assert.rejects(
      validateReleaseAssets(directory, '1.0.0'),
      /missing signed HTTPS metadata for windows-x86_64/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reports every missing release asset category', async () => {
  const directory = await createAssets(['LWT_1.0.0_amd64.deb']);
  try {
    await assert.rejects(
      validateReleaseAssets(directory),
      /Linux AppImage: found 0, require at least 1[\s\S]*Windows MSI installer: found 0, require at least 1/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
