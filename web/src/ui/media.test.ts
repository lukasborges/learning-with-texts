import { describe, expect, it } from 'vitest';
import { buildExternalLookupUrl, detectAudioType } from './media';

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
});

describe('buildExternalLookupUrl', () => {
  it('substitutes an encoded term in an HTTP template', () => {
    expect(buildExternalLookupUrl('https://dictionary.test/lookup?q=###', 'ice cream')).toBe(
      'https://dictionary.test/lookup?q=ice%20cream'
    );
  });

  it('rejects missing, malformed, and unsafe templates', () => {
    expect(buildExternalLookupUrl(undefined, 'word')).toBeUndefined();
    expect(buildExternalLookupUrl('not a URL', 'word')).toBeUndefined();
    expect(buildExternalLookupUrl('javascript:alert(###)', 'word')).toBeUndefined();
  });
});
