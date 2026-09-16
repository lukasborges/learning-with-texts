import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagingDirectory = path.join(repositoryRoot, 'packaging', 'arch');

const iconInstallations = [
  { source: '16x16.png', size: '16x16' },
  { source: '32x32.png', size: '32x32' },
  { source: '48x48.png', size: '48x48' },
  { source: '64x64.png', size: '64x64' },
  { source: '128x128.png', size: '128x128' },
  { source: '128x128@2x.png', size: '256x256' },
  { source: 'icon.png', size: '512x512' }
];

function parseArguments(arguments_) {
  const options = { build: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--build') {
      options.build = true;
    } else if (argument === '--binary' || argument === '--output') {
      options[argument.slice(2)] = arguments_[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.binary || !options.output) {
    throw new Error('Usage: package-arch.mjs --binary <path> --output <directory> [--build]');
  }
  return options;
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function pkgbuild(version, checksums) {
  if (!/^\d+\.\d+\.\d+(?:[._+-][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid Arch package version: ${version}`);
  }
  const iconInstallLines = iconInstallations
    .map(
      ({ size }) =>
        `  install -Dm644 "${'${srcdir}'}/lwt-desktop-${size}.png" "${'${pkgdir}'}/usr/share/icons/hicolor/${size}/apps/lwt-desktop.png"`
    )
    .join('\n');
  const iconSourceEntries = iconInstallations
    .map(({ size }) => `'lwt-desktop-${size}.png'`)
    .join(' ');
  const iconShaEntries = iconInstallations
    .map(({ size }) => `'${checksums[`icon.${size}`]}'`)
    .join(' ');
  return `# Generated from the repository-pinned desktop binary. Do not edit by hand.
pkgname=lwt-desktop
pkgver=${version}
pkgrel=1
pkgdesc="Local-first language reading and vocabulary practice"
arch=('x86_64')
url="https://github.com/lukasborges/learning-with-texts"
license=('Unlicense')
depends=('cairo' 'desktop-file-utils' 'gdk-pixbuf2' 'glib2' 'gtk3' 'hicolor-icon-theme' 'libsoup3' 'pango' 'webkit2gtk-4.1')
optdepends=('gst-plugins-good: common audio codecs' 'gst-plugins-bad: additional audio codecs' 'gst-libav: FFmpeg audio codecs')
options=('!strip' '!debug' '!emptydirs')
install=lwt-desktop.install
source=('lwt-desktop' 'lwt-desktop.desktop' ${iconSourceEntries})
sha256sums=('${checksums.binary}' '${checksums.desktop}' ${iconShaEntries})

package() {
  install -Dm755 "${'${srcdir}'}/lwt-desktop" "${'${pkgdir}'}/usr/bin/lwt-desktop"
  install -Dm644 "${'${srcdir}'}/lwt-desktop.desktop" "${'${pkgdir}'}/usr/share/applications/lwt-desktop.desktop"
${iconInstallLines}
}
`;
}

export async function stageArchPackage({ binary, output, version }) {
  const destination = path.resolve(output);
  await mkdir(destination, { recursive: true });

  const stagedBinary = path.join(destination, 'lwt-desktop');
  const stagedDesktop = path.join(destination, 'lwt-desktop.desktop');
  await copyFile(path.resolve(binary), stagedBinary);
  await chmod(stagedBinary, 0o755);
  await copyFile(path.join(packagingDirectory, 'lwt-desktop.desktop'), stagedDesktop);
  await copyFile(
    path.join(packagingDirectory, 'lwt-desktop.install'),
    path.join(destination, 'lwt-desktop.install')
  );

  const checksums = {
    binary: await sha256(stagedBinary),
    desktop: await sha256(stagedDesktop)
  };
  for (const { source, size } of iconInstallations) {
    const stagedIcon = path.join(destination, `lwt-desktop-${size}.png`);
    await copyFile(path.join(repositoryRoot, 'icons', source), stagedIcon);
    checksums[`icon.${size}`] = await sha256(stagedIcon);
  }

  await writeFile(path.join(destination, 'PKGBUILD'), pkgbuild(version, checksums), 'utf8');
  return destination;
}

function runMakepkg(directory) {
  const result = spawnSync('makepkg', ['--force', '--clean', '--noconfirm'], {
    cwd: directory,
    encoding: 'utf8',
    stdio: 'inherit'
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`makepkg exited with status ${result.status}`);
  }
  const sourceInfo = spawnSync('makepkg', ['--printsrcinfo'], {
    cwd: directory,
    encoding: 'utf8'
  });
  if (sourceInfo.error || sourceInfo.status !== 0) {
    throw sourceInfo.error ?? new Error('Unable to generate .SRCINFO');
  }
  return writeFile(path.join(directory, '.SRCINFO'), sourceInfo.stdout, 'utf8');
}

const isCommandLine = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCommandLine) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
    const directory = await stageArchPackage({
      binary: options.binary,
      output: options.output,
      version: packageJson.version
    });
    if (options.build) {
      await runMakepkg(directory);
    }
    process.stdout.write(`Arch package files are ready in ${directory}.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
