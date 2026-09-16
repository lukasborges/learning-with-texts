import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stageArchPackage } from './package-arch.mjs';

test('stages a checksummed Arch package recipe', async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lwt-arch-package-'));
  const binary = path.join(temporaryDirectory, 'input-binary');
  const output = path.join(temporaryDirectory, 'output');
  try {
    await writeFile(binary, 'native-binary');
    await stageArchPackage({ binary, output, version: '1.2.3' });
    const recipe = await readFile(path.join(output, 'PKGBUILD'), 'utf8');
    const binaryHash = createHash('sha256').update('native-binary').digest('hex');
    assert.match(recipe, /^pkgname=lwt-desktop$/m);
    assert.match(recipe, /^pkgver=1\.2\.3$/m);
    assert.match(recipe, new RegExp(binaryHash));
    assert.match(recipe, /webkit2gtk-4\.1/);
    assert.match(recipe, /usr\/bin\/lwt-desktop/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('stages every hicolor icon size with checksums', async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lwt-arch-package-'));
  const binary = path.join(temporaryDirectory, 'input-binary');
  const output = path.join(temporaryDirectory, 'output');
  try {
    await writeFile(binary, 'native-binary');
    await stageArchPackage({ binary, output, version: '1.2.3' });
    const recipe = await readFile(path.join(output, 'PKGBUILD'), 'utf8');
    const files = await readdir(output);
    const expectedSizes = ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512'];
    for (const size of expectedSizes) {
      assert.ok(
        files.includes(`lwt-desktop-${size}.png`),
        `expected staged icon ${size} (${files.join(', ')})`
      );
      assert.match(
        recipe,
        new RegExp(`lwt-desktop-${size}\\.png.*usr/share/icons/hicolor/${size}/apps/lwt-desktop\\.png`),
        `expected PKGBUILD to install hicolor/${size} icon`
      );
      assert.match(
        recipe,
        new RegExp(`sha256sums=\\('[^']+'[^']+'[^']+'`),
        `expected PKGBUILD sha256sums to include icon entries`
      );
    }
    const shaMatches = [...recipe.matchAll(/'([0-9a-f]{64})'/g)].map((match) => match[1]);
    assert.equal(shaMatches.length, expectedSizes.length + 2, 'binary, desktop, and every icon checksum');
    for (const hash of shaMatches) {
      assert.match(hash, /^[0-9a-f]{64}$/, `expected 64-char hex hash, got ${hash}`);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});