#!/usr/bin/env bash

set -euo pipefail

script_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repository_root=$(cd -- "$script_directory/.." && pwd)
default_signing_directory="${XDG_DATA_HOME:-${HOME}/.local/share}/lwt-signing"
output_path="${LWT_SIGNING_DIRECTORY:-$default_signing_directory}/lwt-updater.key"

usage() {
  printf '%s\n' \
    'Generate the password-protected Tauri updater key outside the repository.' \
    '' \
    'Usage: generate-updater-key.sh [--output <private-key-path>]' \
    '' \
    "Default: $output_path"
}

while (($# > 0)); do
  case "$1" in
    --output)
      if (($# < 2)) || [[ -z "$2" ]]; then
        printf '%s\n' 'Missing value for --output.' >&2
        exit 2
      fi
      output_path=$2
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

public_key_path="${output_path}.pub"
if [[ -e "$output_path" || -e "$public_key_path" ]]; then
  printf '%s\n' \
    "Refusing to overwrite an existing updater key:" \
    "  $output_path" \
    "  $public_key_path" >&2
  exit 1
fi

tauri_executable=${LWT_TAURI_EXECUTABLE:-$repository_root/node_modules/.bin/tauri}
if [[ ! -x "$tauri_executable" ]]; then
  command -v npm >/dev/null 2>&1 || {
    printf '%s\n' 'npm is required to install the Tauri CLI.' >&2
    exit 1
  }
  printf '%s\n' 'Tauri CLI is missing; installing locked development dependencies...'
  (cd "$repository_root" && npm ci --include=dev)
fi

if [[ ! -x "$tauri_executable" ]]; then
  printf 'Tauri CLI was not installed at %s\n' "$tauri_executable" >&2
  exit 1
fi

install -d -m 700 "$(dirname -- "$output_path")"

printf '%s\n' \
  'The Tauri CLI will ask for a password.' \
  'Use a unique password from a password manager and do not leave it blank.' \
  "Private key destination: $output_path"

env -u CI "$tauri_executable" signer generate --write-keys "$output_path"

if [[ ! -s "$output_path" || ! -s "$public_key_path" ]]; then
  printf '%s\n' 'Tauri did not create both expected key files.' >&2
  exit 1
fi

chmod 600 "$output_path"
chmod 644 "$public_key_path"

printf '%s\n' \
  '' \
  'Updater key pair generated successfully.' \
  "Private key: $output_path" \
  "Public key:  $public_key_path" \
  '' \
  'Keep an encrypted recovery copy. Never commit or share the private key.' \
  'GitHub environment secret: TAURI_SIGNING_PRIVATE_KEY' \
  'GitHub environment secret: TAURI_SIGNING_PRIVATE_KEY_PASSWORD' \
  'GitHub environment variable: TAURI_UPDATER_PUBLIC_KEY'
