import { describe, expect, it } from 'vitest';
import {
  audioImportError,
  buildExternalLookupUrl,
  detectAudioType,
  formatPlaybackTime,
  textImportError
} from './media';

describe('detectAudioType', () => {
  it('prefers the browser media type', () => {
    expect(detectAudioType({ name: 'lesson.bin', type: 'Audio/OGG' })).toBe('audio/ogg');
  });

  it('uses the file extension when the browser omits the type', () => {
    expect(detectAudioType({ name: 'lesson.MP3', type: '' })).toBe('audio/mpeg');
    expect(detectAudioType({ name: 'lesson.unknown', type: '' })).toBe(
      'application/octet-stream'
    );
  });

  it('uses the extension when the browser reports a generic binary type', () => {
    expect(detectAudioType({ name: 'lesson.wav', type: 'application/octet-stream' })).toBe(
      'audio/wav'
    );
  });
});

describe('buildExternalLookupUrl', () => {
  it('substitutes an encoded term in an HTTP template', () => {
    expect(buildExternalLookupUrl('https://dictionary.test/lookup?q=###', 'ice cream')).toBe(
      'https://dictionary.test/lookup?q=ice%20cream'
    );
  });

  it('builds the configured Google Translate lookup URL', () => {
    expect(
      buildExternalLookupUrl(
        'https://translate.google.com.br/?sl=en&tl=pt&text=###&op=translate',
        'everyone'
      )
    ).toBe('https://translate.google.com.br/?sl=en&tl=pt&text=everyone&op=translate');
  });

  it('rejects missing, malformed, and unsafe templates', () => {
    expect(buildExternalLookupUrl(undefined, 'word')).toBeUndefined();
    expect(buildExternalLookupUrl('not a URL', 'word')).toBeUndefined();
    expect(buildExternalLookupUrl('javascript:alert(###)', 'word')).toBeUndefined();
  });
});

describe('textImportError', () => {
  it('accepts UTF-8 text-file candidates regardless of filename case', () => {
    expect(textImportError({ name: 'Lesson.TXT', size: 12_000 })).toBeUndefined();
  });

  it('rejects other extensions and oversized text files', () => {
    expect(textImportError({ name: 'lesson.md', size: 1_000 })).toBe(
      'Choose a .txt plain-text file.'
    );
    expect(textImportError({ name: 'lesson.txt', size: 65_001 })).toBe(
      'The selected text file exceeds the 65 KB limit.'
    );
  });
});

describe('audioImportError', () => {
  it('accepts supported audio based on MIME type or extension', () => {
    expect(
      audioImportError({ name: 'lesson.bin', type: 'audio/ogg', size: 12_000 })
    ).toBeUndefined();
    expect(
      audioImportError({ name: 'lesson.MP3', type: '', size: 12_000 })
    ).toBeUndefined();
  });

  it('rejects empty, oversized, and unsupported files before saving text', () => {
    expect(audioImportError({ name: 'empty.mp3', type: 'audio/mpeg', size: 0 })).toBe(
      'Audio must be between 1 byte and 50 MB.'
    );
    expect(
      audioImportError({ name: 'large.mp3', type: 'audio/mpeg', size: 50_000_001 })
    ).toBe('Audio must be between 1 byte and 50 MB.');
    expect(audioImportError({ name: 'notes.txt', type: 'text/plain', size: 100 })).toBe(
      'Choose a supported MP3, M4A, MP4, OGG, WAV, WebM, or FLAC audio file.'
    );
  });
});

describe('formatPlaybackTime', () => {
  it('formats invalid, minute, and hour durations for the custom player', () => {
    expect(formatPlaybackTime(Number.NaN)).toBe('0:00');
    expect(formatPlaybackTime(65.9)).toBe('1:05');
    expect(formatPlaybackTime(3_661)).toBe('1:01:01');
  });
});
