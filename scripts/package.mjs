import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')
);
const pakeExecutable = resolve(
  repositoryRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'pake.cmd' : 'pake'
);

const result = spawnSync(
  pakeExecutable,
  [
    '--config',
    'pake.json',
    '--app-version',
    packageJson.version,
    '--json',
    ...process.argv.slice(2)
  ],
  {
    cwd: repositoryRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
);

if (result.error) {
  console.error(`Unable to start Pake: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
