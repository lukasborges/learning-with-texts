export interface RecommendedDictionaryTemplates {
  readonly primaryName: string;
  readonly primaryUrl: string;
  readonly secondaryName: string;
  readonly secondaryUrl: string;
}

const wiktionaryLanguageCodes: Readonly<Record<string, string>> = {
  arabic: 'ar',
  chinese: 'zh',
  dutch: 'nl',
  french: 'fr',
  german: 'de',
  italian: 'it',
  japanese: 'ja',
  korean: 'ko',
  polish: 'pl',
  portuguese: 'pt',
  russian: 'ru',
  spanish: 'es',
  swedish: 'sv',
  turkish: 'tr',
  ukrainian: 'uk'
};

export function recommendedDictionaryTemplates(
  language: string,
  nativeLanguage = ''
): RecommendedDictionaryTemplates {
  const name = language.trim();
  const normalized = name.toLocaleLowerCase();
  if (normalized === 'english') {
    const native = nativeLanguage.trim();
    const cambridgeTranslationSlugs: Readonly<Record<string, string>> = {
      Arabic: 'arabic',
      Chinese: 'chinese-simplified',
      Dutch: 'dutch',
      French: 'french',
      German: 'german',
      Italian: 'italian',
      Japanese: 'japanese',
      Korean: 'korean',
      Polish: 'polish',
      Portuguese: 'portuguese',
      Russian: 'russian',
      Spanish: 'spanish',
      Swedish: 'swedish',
      Turkish: 'turkish',
      Ukrainian: 'ukrainian'
    };
    const translationSlug = cambridgeTranslationSlugs[native];
    if (translationSlug) {
      return {
        primaryName: 'Cambridge English Dictionary',
        primaryUrl: 'https://dictionary.cambridge.org/dictionary/english/###',
        secondaryName: `Cambridge English–${native}`,
        secondaryUrl: `https://dictionary.cambridge.org/dictionary/english-${translationSlug}/###`
      };
    }
    return {
      primaryName: 'Cambridge Dictionary',
      primaryUrl: 'https://dictionary.cambridge.org/dictionary/english/###',
      secondaryName: 'Merriam-Webster',
      secondaryUrl: 'https://www.merriam-webster.com/dictionary/###'
    };
  }

  const wiktionaryCode = wiktionaryLanguageCodes[normalized];
  if (wiktionaryCode) {
    return {
      primaryName: `${name} Wiktionary`,
      primaryUrl: `https://${wiktionaryCode}.wiktionary.org/wiki/###`,
      secondaryName: 'English Wiktionary',
      secondaryUrl: 'https://en.wiktionary.org/wiki/###'
    };
  }

  return {
    primaryName: 'English Wiktionary',
    primaryUrl: 'https://en.wiktionary.org/wiki/###',
    secondaryName: 'Google definitions',
    secondaryUrl: 'https://www.google.com/search?q=define%3A###'
  };
}
