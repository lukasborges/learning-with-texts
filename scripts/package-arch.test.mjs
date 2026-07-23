import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
