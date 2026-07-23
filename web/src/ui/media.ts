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
