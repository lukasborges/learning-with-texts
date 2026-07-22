import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateReleaseVersion } from './validate-release-version.mjs';

async function createFixture(versions = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'lwt-release-version-'));
  await mkdir(path.join(root, 'desktop/src-tauri'), { recursive: true });
  const version = versions.default ?? '1.2.3';
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ version: versions.packageJson ?? version })
  );
  await writeFile(
    path.join(root, 'package-lock.json'),
    JSON.stringify({
      version: versions.packageLock ?? version,
      packages: { '': { version: versions.packageLockRoot ?? version } }
    })
  );
  await writeFile(
    path.join(root, 'desktop/src-tauri/Cargo.toml'),
    `[package]\nname = "lwt-desktop"\nversion = "${versions.cargoToml ?? version}"\n`
  );
  await writeFile(
    path.join(root, 'desktop/src-tauri/Cargo.lock'),
    `[[package]]\nname = "lwt-desktop"\nversion = "${versions.cargoLock ?? version}"\n`
  );
  await writeFile(
    path.join(root, 'desktop/src-tauri/tauri.conf.json'),
    JSON.stringify({ version: versions.tauri ?? version })
  );
  return root;
}

test('accepts synchronized application versions and the matching release tag', async () => {
  const root = await createFixture();
  try {
    assert.equal(await validateReleaseVersion(root, 'v1.2.3'), '1.2.3');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports every version source when manifests disagree', async () => {
  const root = await createFixture({ tauri: '1.2.4' });
  try {
    await assert.rejects(validateReleaseVersion(root), /tauri\.conf\.json: 1\.2\.4/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a tag that does not match the synchronized version', async () => {
  const root = await createFixture();
  try {
    await assert.rejects(validateReleaseVersion(root, 'v1.2.4'), /does not match version v1\.2\.3/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
