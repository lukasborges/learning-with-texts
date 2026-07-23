const AUDIO_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm'
};
const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-wav'
]);

type NamedMedia = Pick<File, 'name' | 'type'>;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(''));
}

export function detectAudioType(file: NamedMedia): string {
  const browserType = file.type.toLocaleLowerCase();
  if (SUPPORTED_AUDIO_TYPES.has(browserType)) {
    return browserType;
  }
  const extension = file.name.split('.').pop()?.toLocaleLowerCase() ?? '';
  return AUDIO_TYPES_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

export function buildExternalLookupUrl(
  template: string | undefined,
  term: string
): string | undefined {
  if (!template?.trim()) {
    return undefined;
  }
  try {
    const url = new URL(template.replaceAll('###', encodeURIComponent(term)));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function textImportError(file: Pick<File, 'name' | 'size'>): string | undefined {
  if (!/\.txt$/iu.test(file.name)) {
    return 'Choose a .txt plain-text file.';
  }
  if (file.size > 65_000) {
    return 'The selected text file exceeds the 65 KB limit.';
  }
  return undefined;
}

export function audioImportError(
  file: Pick<File, 'name' | 'size' | 'type'>
): string | undefined {
  if (file.size === 0 || file.size > 50_000_000) {
    return 'Audio must be between 1 byte and 50 MB.';
  }
  if (detectAudioType(file) === 'application/octet-stream') {
    return 'Choose a supported MP3, M4A, MP4, OGG, WAV, WebM, or FLAC audio file.';
  }
  return undefined;
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const remainder = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
