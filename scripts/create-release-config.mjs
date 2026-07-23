import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UPDATE_ENDPOINT =
  'https://github.com/lukasborges/learning-with-texts/releases/latest/download/latest.json';

function outputPath(arguments_) {
  if (arguments_.length !== 2 || arguments_[0] !== '--output') {
    throw new Error('Usage: create-release-config.mjs --output <configuration-file>');
  }
  return path.resolve(arguments_[1]);
}

function updaterPublicKey(environment) {
  const publicKey = environment.LWT_UPDATER_PUBLIC_KEY?.trim();
  if (!publicKey || publicKey.length < 32) {
    throw new Error('LWT_UPDATER_PUBLIC_KEY must contain the Tauri signer public key');
  }
  return publicKey;
}

export function createReleaseConfiguration(environment = process.env) {
  return {
    bundle: {
      createUpdaterArtifacts: true
    },
    plugins: {
      updater: {
        pubkey: updaterPublicKey(environment),
        endpoints: [UPDATE_ENDPOINT],
        windows: {
          installMode: 'passive'
        }
      }
    }
  };
}

const isCommandLine = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCommandLine) {
  try {
    const destination = outputPath(process.argv.slice(2));
    const configuration = createReleaseConfiguration();
    await writeFile(destination, `${JSON.stringify(configuration, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    });
    process.stdout.write(`Release configuration written to ${destination}.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
