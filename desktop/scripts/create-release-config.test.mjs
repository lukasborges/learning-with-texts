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

test('adds a validated Windows signing certificate to the release configuration', () => {
  const configuration = createReleaseConfiguration({
    LWT_UPDATER_PUBLIC_KEY: publicKey,
    WINDOWS_CERTIFICATE_THUMBPRINT: '1234567890abcdef1234567890abcdef12345678'
  });
  assert.deepEqual(configuration.bundle.windows, {
    certificateThumbprint: '1234567890ABCDEF1234567890ABCDEF12345678',
    digestAlgorithm: 'sha256',
    timestampUrl: 'http://timestamp.digicert.com'
  });
});

test('rejects missing keys and malformed certificate thumbprints', () => {
  assert.throws(() => createReleaseConfiguration({}), /LWT_UPDATER_PUBLIC_KEY/);
  assert.throws(
    () =>
      createReleaseConfiguration({
        LWT_UPDATER_PUBLIC_KEY: publicKey,
        WINDOWS_CERTIFICATE_THUMBPRINT: 'not-a-thumbprint'
      }),
    /40 hexadecimal/
  );
});
