import { describe, expect, it } from 'vitest';
import {
  googleTranslateTemplate,
  translationLanguageFromTemplate
} from './translations';

describe('googleTranslateTemplate', () => {
  it('builds an English to Portuguese translation template', () => {
    expect(googleTranslateTemplate('English', 'Portuguese')).toBe(
      'https://translate.google.com/?sl=en&tl=pt&text=###&op=translate'
    );
  });

  it('uses automatic source detection for a custom learning language', () => {
    expect(googleTranslateTemplate('Esperanto', 'English')).toBe(
      'https://translate.google.com/?sl=auto&tl=en&text=###&op=translate'
    );
  });

  it('rejects an unsupported target language', () => {
    expect(googleTranslateTemplate('English', 'Esperanto')).toBeUndefined();
  });

  it('reads the native language from an existing template', () => {
    expect(
      translationLanguageFromTemplate(
        'https://translate.google.com/?sl=en&tl=pt&text=###&op=translate'
      )
    ).toBe('Portuguese');
  });
});
