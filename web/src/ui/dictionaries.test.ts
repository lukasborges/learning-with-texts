import { describe, expect, it } from 'vitest';
import { recommendedDictionaryTemplates } from './dictionaries';

describe('recommendedDictionaryTemplates', () => {
  it('recommends learner-friendly English dictionaries', () => {
    expect(recommendedDictionaryTemplates('English')).toEqual({
      primaryName: 'Cambridge Dictionary',
      primaryUrl: 'https://dictionary.cambridge.org/dictionary/english/###',
      secondaryName: 'Merriam-Webster',
      secondaryUrl: 'https://www.merriam-webster.com/dictionary/###'
    });
  });

  it('recommends a bilingual dictionary for the native language', () => {
    expect(recommendedDictionaryTemplates('English', 'Portuguese')).toEqual({
      primaryName: 'Cambridge English Dictionary',
      primaryUrl: 'https://dictionary.cambridge.org/dictionary/english/###',
      secondaryName: 'Cambridge English–Portuguese',
      secondaryUrl:
        'https://dictionary.cambridge.org/dictionary/english-portuguese/###'
    });
  });

  it('uses the native and English Wiktionary editions for supported languages', () => {
    expect(recommendedDictionaryTemplates('Portuguese')).toEqual({
      primaryName: 'Portuguese Wiktionary',
      primaryUrl: 'https://pt.wiktionary.org/wiki/###',
      secondaryName: 'English Wiktionary',
      secondaryUrl: 'https://en.wiktionary.org/wiki/###'
    });
  });

  it('provides multilingual fallbacks for a custom language', () => {
    expect(recommendedDictionaryTemplates('Esperanto')).toMatchObject({
      primaryName: 'English Wiktionary',
      secondaryName: 'Google definitions'
    });
  });
});
