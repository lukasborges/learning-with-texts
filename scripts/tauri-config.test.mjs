import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('local builds initialize the updater with an inert configuration', async () => {
  const configuration = JSON.parse(
    await readFile(path.join(repositoryRoot, 'tauri.conf.json'), 'utf8')
  );
  assert.deepEqual(configuration.plugins.updater, {
    pubkey: '',
    endpoints: []
  });
});
