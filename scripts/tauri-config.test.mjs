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

test('custom titlebar grants only its required window commands', async () => {
  const configuration = JSON.parse(
    await readFile(path.join(repositoryRoot, 'tauri.conf.json'), 'utf8')
  );
  const capability = JSON.parse(
    await readFile(path.join(repositoryRoot, 'capabilities', 'default.json'), 'utf8')
  );

  assert.equal(configuration.app.windows[0].decorations, false);
  assert.equal(configuration.app.windows[0].transparent, true);
  assert.equal(configuration.app.windows[0].resizable, true);
  assert.equal(configuration.app.windows[0].minWidth, 420);
  assert.deepEqual(
    capability.permissions.filter((permission) => permission.startsWith('core:window:allow-')),
    [
      'core:window:allow-close',
      'core:window:allow-is-maximized',
      'core:window:allow-minimize',
      'core:window:allow-start-dragging',
      'core:window:allow-start-resize-dragging',
      'core:window:allow-toggle-maximize'
    ]
  );
});

test('dictionary lookups can create an isolated auxiliary webview window', async () => {
  const capability = JSON.parse(
    await readFile(path.join(repositoryRoot, 'capabilities', 'default.json'), 'utf8')
  );

  assert.ok(capability.permissions.includes('core:webview:allow-create-webview-window'));
  assert.deepEqual(capability.windows, ['main']);
});
