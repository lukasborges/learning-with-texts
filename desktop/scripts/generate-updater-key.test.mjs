import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = path.resolve('desktop/scripts/generate-updater-key.sh');
const skipsPosixPermissionChecks = process.platform === 'win32';

async function createFakeTauri(directory) {
  const executable = path.join(directory, 'tauri');
  await writeFile(
    executable,
    `#!/usr/bin/env bash
set -euo pipefail
output_path="\${4}"
printf 'private-key' > "$output_path"
printf 'public-key' > "\${output_path}.pub"
`
  );
  await chmod(executable, 0o700);
  return executable;
}

test('generates protected updater keys outside the repository', { skip: skipsPosixPermissionChecks }, async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lwt-updater-key-'));
  try {
    const signingDirectory = path.join(temporaryDirectory, 'signing');
    const fakeTauri = await createFakeTauri(temporaryDirectory);
    const result = spawnSync('bash', [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        LWT_SIGNING_DIRECTORY: signingDirectory,
        LWT_TAURI_EXECUTABLE: fakeTauri
      }
    });
    assert.equal(result.status, 0, result.stderr);

    const privateKey = path.join(signingDirectory, 'lwt-updater.key');
    const publicKey = `${privateKey}.pub`;
    assert.equal(await readFile(privateKey, 'utf8'), 'private-key');
    assert.equal(await readFile(publicKey, 'utf8'), 'public-key');
    assert.equal((await stat(privateKey)).mode & 0o777, 0o600);
    assert.equal((await stat(publicKey)).mode & 0o777, 0o644);
    assert.match(result.stdout, /Never commit or share the private key/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('refuses to overwrite an existing updater key', async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lwt-updater-key-'));
  try {
    const output = path.join(temporaryDirectory, 'existing.key');
    await writeFile(output, 'keep-me');
    const fakeTauri = await createFakeTauri(temporaryDirectory);
    const result = spawnSync('bash', [script, '--output', output], {
      encoding: 'utf8',
      env: { ...process.env, LWT_TAURI_EXECUTABLE: fakeTauri }
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing to overwrite/);
    assert.equal(await readFile(output, 'utf8'), 'keep-me');
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
