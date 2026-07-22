import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_SUFFIXES = [
  '.AppImage',
  '.app.tar.gz',
  '.cdx.json',
  '.deb',
  '.dmg',
  '.msi',
  '.nsis.zip',
  '.pkg.tar.zst',
  '.sig',
  '-setup.exe'
];

function parseArguments(arguments_) {
  let root;
  let output;

  for (let index = 0; index < arguments_.length; index += 1) {
    const value = arguments_[index];
    if (value === '--root') {
      root = arguments_[index + 1];
      index += 1;
    } else if (value === '--output') {
      output = arguments_[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!root || !output) {
    throw new Error('Usage: release-integrity.mjs --root <bundle-directory> --output <manifest>');
  }

  return { root: path.resolve(root), output: path.resolve(output) };
}

function isReleaseArtifact(fileName) {
  return RELEASE_SUFFIXES.some((suffix) => fileName.endsWith(suffix));
}

async function collectArtifacts(directory, output) {
  const entries = await readdir(directory, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      artifacts.push(...(await collectArtifacts(entryPath, output)));
    } else if (entry.isFile() && entryPath !== output && isReleaseArtifact(entry.name)) {
      artifacts.push(entryPath);
    }
  }

  return artifacts;
}

async function sha256(filePath) {
  const contents = await readFile(filePath);
  return createHash('sha256').update(contents).digest('hex');
}

export async function createChecksumManifest(root, output) {
  const rootStats = await stat(root);
  if (!rootStats.isDirectory()) {
    throw new Error(`Bundle root is not a directory: ${root}`);
  }

  const files = await collectArtifacts(root, output);
  const records = files
    .map((filePath) => ({
      filePath,
      relativePath: path.relative(root, filePath).split(path.sep).join('/')
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en'));

  if (records.length === 0) {
    throw new Error(`No release artifacts were found under ${root}`);
  }

  for (const { relativePath } of records) {
    if (/\r|\n/.test(relativePath)) {
      throw new Error(`Artifact path contains a line break: ${relativePath}`);
    }
  }

  const lines = await Promise.all(
    records.map(async ({ filePath, relativePath }) => `${await sha256(filePath)}  ${relativePath}`)
  );
  await writeFile(output, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o644 });
  return records.map(({ relativePath }) => relativePath);
}

const isCommandLine = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCommandLine) {
  try {
    const { root, output } = parseArguments(process.argv.slice(2));
    const artifacts = await createChecksumManifest(root, output);
    process.stdout.write(`Checksummed ${artifacts.length} release artifact(s).\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
