const googleLanguageCodes: Readonly<Record<string, string>> = {
  Arabic: 'ar',
  Chinese: 'zh-CN',
  Dutch: 'nl',
  English: 'en',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Japanese: 'ja',
  Korean: 'ko',
  Polish: 'pl',
  Portuguese: 'pt',
  Russian: 'ru',
  Spanish: 'es',
  Swedish: 'sv',
  Turkish: 'tr',
  Ukrainian: 'uk'
};

export const supportedTranslationLanguages = Object.keys(googleLanguageCodes);

export function googleTranslateTemplate(
  learningLanguage: string,
  translationLanguage: string
): string | undefined {
  const target = googleLanguageCodes[translationLanguage];
  if (!target) {
    return undefined;
  }
  const source = googleLanguageCodes[learningLanguage] ?? 'auto';
  return `https://translate.google.com/?sl=${source}&tl=${target}&text=###&op=translate`;
}

export function translationLanguageFromTemplate(
  template: string | undefined
): string | undefined {
  if (!template) {
    return undefined;
  }
  try {
    const target = new URL(template).searchParams.get('tl');
    return Object.entries(googleLanguageCodes).find(([, code]) => code === target)?.[0];
  } catch {
    return undefined;
  }
}
