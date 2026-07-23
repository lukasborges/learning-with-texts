import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executeFile = promisify(execFile);

async function sourceFiles(directory, suffix) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(entryPath, suffix)));
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(entryPath);
    }
  }
  return files;
}

async function combinedContents(files) {
  return (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
}

test('desktop runtime has no PHP, server, shell, or MySQL sidecar', async () => {
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
  const scriptCommands = Object.values(packageJson.scripts).join('\n');
  assert.doesNotMatch(scriptCommands, /(^|[\s/])(php|mysqld?|mariadbd?|apache2?|httpd)([\s/]|$)/i);

  const tauriConfig = JSON.parse(
    await readFile(path.join(repositoryRoot, 'tauri.conf.json'), 'utf8')
  );
  assert.equal(tauriConfig.bundle.externalBin, undefined);

  const cargoManifest = await readFile(
    path.join(repositoryRoot, 'Cargo.toml'),
    'utf8'
  );
  assert.doesNotMatch(cargoManifest, /^\s*(mysql|mysql_async|sqlx)\s*=/im);

  const rust = await combinedContents(
    await sourceFiles(path.join(repositoryRoot, 'src'), '.rs')
  );
  assert.doesNotMatch(rust, /std::process|Command::new|\.php(?:\?|['"])/);

  const typescript = await combinedContents(
    await sourceFiles(path.join(repositoryRoot, 'web/src'), '.ts')
  );
  assert.doesNotMatch(typescript, /['"][^'"]+\.php(?:\?[^'"]*)?['"]/i);
  assert.doesNotMatch(typescript, /XMLHttpRequest|\bfetch\s*\(/);
});

test('maintained branch tracks no legacy server or browser runtime', async () => {
  const { stdout } = await executeFile(
    'git',
    ['-c', `safe.directory=${repositoryRoot}`, 'ls-files'],
    { cwd: repositoryRoot }
  );
  const files = stdout.trim().split('\n');
  const legacyFiles = files.filter(
    (file) =>
      /(?:^|\/)[^/]+\.php$/i.test(file) ||
      /(?:^|\/)[^/]+\.inc\.php$/i.test(file) ||
      /^(?:anki|css|icn|img|js|media|php-mobile-detect)\//.test(file)
  );
  assert.deepEqual(legacyFiles, []);
});
