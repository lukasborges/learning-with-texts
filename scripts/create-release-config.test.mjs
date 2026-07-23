import assert from 'node:assert/strict';
import test from 'node:test';
import { createReleaseConfiguration } from './create-release-config.mjs';

const publicKey = `untrusted comment: minisign public key
RWQxYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh`;

test('creates an updater-only release configuration by default', () => {
  const configuration = createReleaseConfiguration({ LWT_UPDATER_PUBLIC_KEY: publicKey });
  assert.equal(configuration.bundle.createUpdaterArtifacts, true);
  assert.equal(configuration.bundle.windows, undefined);
  assert.equal(configuration.plugins.updater.pubkey, publicKey);
  assert.deepEqual(configuration.plugins.updater.endpoints, [
    'https://github.com/lukasborges/learning-with-texts/releases/latest/download/latest.json'
  ]);
  assert.equal(configuration.plugins.updater.windows.installMode, 'passive');
});

test('rejects a missing updater public key', () => {
  assert.throws(() => createReleaseConfiguration({}), /LWT_UPDATER_PUBLIC_KEY/);
});
