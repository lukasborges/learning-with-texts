import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function packageVersionFromToml(contents, fileName, packageName) {
  const sections = contents.split(/^\[\[?package\]?\]\s*$/m).slice(1);
  const section = packageName
    ? sections.find((candidate) => new RegExp(`^name\\s*=\\s*"${packageName}"\\s*$`, 'm').test(candidate))
    : sections[0];
  const version = section?.match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!version) {
    throw new Error(`Could not read the package version from ${fileName}`);
  }
  return version;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function validateReleaseVersion(root, expectedTag) {
  const packageJson = await readJson(path.join(root, 'package.json'));
  const packageLock = await readJson(path.join(root, 'package-lock.json'));
  const tauriConfig = await readJson(path.join(root, 'tauri.conf.json'));
  const cargoToml = await readFile(path.join(root, 'Cargo.toml'), 'utf8');
  const cargoLock = await readFile(path.join(root, 'Cargo.lock'), 'utf8');
  const versions = new Map([
    ['package.json', packageJson.version],
    ['package-lock.json', packageLock.version],
    ['package-lock.json root package', packageLock.packages?.['']?.version],
    ['Cargo.toml', packageVersionFromToml(cargoToml, 'Cargo.toml')],
    ['Cargo.lock', packageVersionFromToml(cargoLock, 'Cargo.lock', 'lwt-desktop')],
    ['tauri.conf.json', tauriConfig.version]
  ]);
  const uniqueVersions = new Set(versions.values());
  if (uniqueVersions.size !== 1 || uniqueVersions.has(undefined)) {
    const details = [...versions].map(([source, version]) => `${source}: ${version ?? 'missing'}`);
    throw new Error(`Release versions do not match:\n${details.join('\n')}`);
  }

  const [version] = uniqueVersions;
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  if (expectedTag && expectedTag !== `v${version}`) {
    throw new Error(`Release tag ${expectedTag} does not match version v${version}`);
  }
  return version;
}

function parseArguments(arguments_) {
  let root = process.cwd();
  let tag;
  for (let index = 0; index < arguments_.length; index += 1) {
    if (arguments_[index] === '--root') {
      root = arguments_[index + 1];
      index += 1;
    } else if (arguments_[index] === '--tag') {
      tag = arguments_[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arguments_[index]}`);
    }
  }
  if (!root || (arguments_.includes('--tag') && !tag)) {
    throw new Error('Usage: validate-release-version.mjs [--root <repository>] [--tag <vX.Y.Z>]');
  }
  return { root: path.resolve(root), tag };
}

const isCommandLine = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCommandLine) {
  try {
    const { root, tag } = parseArguments(process.argv.slice(2));
    const version = await validateReleaseVersion(root, tag);
    process.stdout.write(`Validated release version v${version}.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
