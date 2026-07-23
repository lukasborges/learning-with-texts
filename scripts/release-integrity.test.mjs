import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createChecksumManifest } from './release-integrity.mjs';

test('creates a stable manifest for distributable artifacts and the SBOM', async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lwt-release-integrity-'));
  const bundleRoot = path.join(temporaryDirectory, 'bundle');
  const manifest = path.join(bundleRoot, 'SHA256SUMS');

  try {
    await mkdir(path.join(bundleRoot, 'linux'), { recursive: true });
    await writeFile(path.join(bundleRoot, 'linux', 'LWT.AppImage'), 'app-image');
    await writeFile(path.join(bundleRoot, 'linux', 'LWT.AppImage.tar.gz'), 'updater');
    await writeFile(path.join(bundleRoot, 'lwt.cdx.json'), '{"bomFormat":"CycloneDX"}');
    await writeFile(path.join(bundleRoot, 'linux', 'build-metadata.txt'), 'not distributed');

    const artifacts = await createChecksumManifest(bundleRoot, manifest);
    assert.deepEqual(artifacts, [
      'linux/LWT.AppImage',
      'linux/LWT.AppImage.tar.gz',
      'lwt.cdx.json'
    ]);

    const expectedHash = createHash('sha256').update('app-image').digest('hex');
    const contents = await readFile(manifest, 'utf8');
    assert.match(contents, new RegExp(`^${expectedHash}  linux/LWT\\.AppImage$`, 'm'));
    assert.match(contents, /lwt\.cdx\.json$/m);
    assert.doesNotMatch(contents, /build-metadata/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('checksums every downloaded release asset for the global manifest', async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lwt-release-integrity-'));
  const manifest = path.join(temporaryDirectory, 'SHA256SUMS');
  try {
    await writeFile(path.join(temporaryDirectory, 'latest.json'), '{"version":"1.2.3"}');
    await writeFile(path.join(temporaryDirectory, 'release-notes.txt'), 'release metadata');
    const artifacts = await createChecksumManifest(temporaryDirectory, manifest, {
      allFiles: true
    });
    assert.deepEqual(artifacts, ['latest.json', 'release-notes.txt']);
    assert.doesNotMatch(await readFile(manifest, 'utf8'), /SHA256SUMS/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('refuses to create an empty release manifest', async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lwt-release-integrity-'));
  try {
    await assert.rejects(
      createChecksumManifest(temporaryDirectory, path.join(temporaryDirectory, 'SHA256SUMS')),
      /No release artifacts/
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
