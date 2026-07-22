import type {
  BackupSummary,
  CreateTagInput,
  CreateTextInput,
  CreateExpressionInput,
  CreatedExpression,
  LanguageSettings,
  LibraryText,
  ReadingItem,
  ReadingText,
  RecordReviewInput,
  ReviewCard,
  ReviewOutcome,
  ReviewStatistics,
  SaveTermInput,
  SavedTerm,
  SetTermStatusInput,
  SetTermTagsInput,
  SetTextTagsInput,
  Tag,
  TermDetails,
  TermProgress,
  TermStatus,
  TextDetails,
  UpdateLanguageInput,
  UpdateTextInput
} from '../domain/library';
import type { LibraryGateway } from './library_gateway';

const sampleTexts: readonly TextDetails[] = [
  {
    id: 1,
    title: 'The Man and the Dog',
    language: 'English',
    knownTerms: 138,
    totalTerms: 184,
    lastOpened: 'Today',
    content: 'A man and his dog walked along the road.'
  },
  {
    id: 2,
    title: 'Die Leiden des jungen Werthers',
    language: 'German',
    knownTerms: 92,
    totalTerms: 241,
    lastOpened: 'Yesterday',
    content: 'Was ich von der Geschichte des armen Werthers nur habe auffinden können.'
  },
  {
    id: 3,
    title: 'Don du sang',
    language: 'French',
    knownTerms: 64,
    totalTerms: 117,
    lastOpened: '3 days ago',
    content: 'Le don du sang est un geste simple et généreux.'
  }
];

interface MockBackup {
  readonly format: 'lwt-desktop-backup';
  readonly version: 1;
  readonly texts: TextDetails[];
  readonly languageSettings: Array<[string, LanguageSettings]>;
  readonly terms: Array<[string, TermDetails]>;
  readonly expressions: Array<CreatedExpression & { textId: number }>;
  readonly termIds: Array<[string, number]>;
  readonly dueTerms: string[];
  readonly nextTermId: number;
  readonly reviewHistory: Array<{ key: string; rating: number }>;
  readonly tags: Tag[];
  readonly nextTagId: number;
  readonly textTagIds: Array<[number, number[]]>;
  readonly termTagIds: Array<[string, number[]]>;
}

function countUniqueTerms(content: string): number {
  return new Set(normalizedTerms(content)).size;
}

function normalizedTerms(content: string): readonly string[] {
  return (
    content
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}_]+(?:['’‐‑-][\p{L}\p{N}_]+)*/gu) ?? []
  );
}

function createReadingItems(
  content: string,
  statusFor: (normalized: string) => TermStatus,
  splitEachCharacter = false
): readonly ReadingItem[] {
  const parts = splitEachCharacter
    ? [...content]
    : content
        .split(/([\p{L}\p{N}_]+(?:['’‐‑-][\p{L}\p{N}_]+)*)/gu)
        .filter(Boolean);
  return parts.map((surface, index) => {
    const isWord = /^[\p{L}\p{N}_]+(?:['’‐‑-][\p{L}\p{N}_]+)*$/u.test(surface);
    const normalized = isWord ? surface.toLocaleLowerCase() : '';
    return {
      position: index + 1,
      surface,
      normalized,
      isWord,
      status: isWord ? statusFor(normalized) : 0
    };
  });
}

export class MockLibraryGateway implements LibraryGateway {
  private readonly texts = sampleTexts.map((text) => ({ ...text }));
  private readonly terms = new Map<string, TermDetails>();
  private readonly expressions: Array<CreatedExpression & { textId: number }> = [];
  private readonly termIds = new Map<string, number>();
  private readonly dueTerms = new Set<string>();
  private nextTermId = 1;
  private readonly reviewHistory: Array<{ key: string; rating: number }> = [];
  private readonly languageSettings = new Map<string, LanguageSettings>();
  private readonly tags: Tag[] = [];
  private nextTagId = 1;
  private readonly textTagIds = new Map<number, Set<number>>();
  private readonly termTagIds = new Map<string, Set<number>>();

  private settingsFor(language: string): LanguageSettings {
    const key = language.toLocaleLowerCase();
    const existing = this.languageSettings.get(key);
    if (existing) {
      return existing;
    }
    const settings: LanguageSettings = {
      id: this.languageSettings.size + 1,
      name: language,
      characterSubstitutions: '',
      sentenceTerminators: '',
      splitEachCharacter: false,
      removeSpaces: false,
      rightToLeft: false,
      textCount: 0
    };
    this.languageSettings.set(key, settings);
    return settings;
  }

  private configuredContent(text: TextDetails): string {
    const settings = this.settingsFor(text.language);
    return settings.characterSubstitutions
      .split('|')
      .filter(Boolean)
      .reduce((content, pair) => {
        const [from, to = ''] = pair.split('=', 2).map((part) => part.trim());
        return from ? content.replaceAll(from, to) : content;
      }, text.content);
  }

  private normalizedTermsFor(text: TextDetails): readonly string[] {
    const content = this.configuredContent(text);
    if (!this.settingsFor(text.language).splitEachCharacter) {
      return normalizedTerms(content);
    }
    return [...content.toLocaleLowerCase()].filter((character) => /[\p{L}\p{N}_]/u.test(character));
  }

  private termKey(language: string, normalized: string): string {
    return `${language.toLocaleLowerCase()}\u0000${normalized}`;
  }

  private trackTerm(key: string, status: TermStatus): void {
    if (!this.termIds.has(key)) {
      this.termIds.set(key, this.nextTermId++);
    }
    if (status >= 1 && status <= 5) {
      this.dueTerms.add(key);
    } else {
      this.dueTerms.delete(key);
    }
  }

  private withProgress(text: TextDetails): TextDetails {
    const terms = new Set(this.normalizedTermsFor(text));
    const knownTerms = [...terms].filter((term) => {
      const status = this.terms.get(this.termKey(text.language, term))?.status ?? 0;
      return status === 5 || status === 99;
    }).length;
    return { ...text, knownTerms, totalTerms: terms.size };
  }

  async listTexts(): Promise<readonly LibraryText[]> {
    return this.texts.map((text) => this.withProgress(text));
  }

  async listLanguages(): Promise<readonly LanguageSettings[]> {
    for (const text of this.texts) {
      this.settingsFor(text.language);
    }
    return [...this.languageSettings.values()]
      .map((settings) => ({
        ...settings,
        textCount: this.texts.filter(
          ({ language }) => language.toLocaleLowerCase() === settings.name.toLocaleLowerCase()
        ).length
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async updateLanguage(input: UpdateLanguageInput): Promise<LanguageSettings> {
    await this.listLanguages();
    const entry = [...this.languageSettings.entries()].find(([, value]) => value.id === input.id);
    if (!entry) {
      throw new Error('Language was not found');
    }
    const [key, previous] = entry;
    const updated = { ...previous, ...input };
    this.languageSettings.set(key, updated);
    return {
      ...updated,
      textCount: this.texts.filter(
        ({ language }) => language.toLocaleLowerCase() === previous.name.toLocaleLowerCase()
      ).length
    };
  }

  async exportBackup(): Promise<string> {
    await this.listLanguages();
    const backup: MockBackup = {
      format: 'lwt-desktop-backup',
      version: 1,
      texts: this.texts,
      languageSettings: [...this.languageSettings],
      terms: [...this.terms],
      expressions: this.expressions,
      termIds: [...this.termIds],
      dueTerms: [...this.dueTerms],
      nextTermId: this.nextTermId,
      reviewHistory: this.reviewHistory,
      tags: this.tags,
      nextTagId: this.nextTagId,
      textTagIds: [...this.textTagIds].map(([id, values]) => [id, [...values]]),
      termTagIds: [...this.termTagIds].map(([key, values]) => [key, [...values]])
    };
    return JSON.stringify(backup, null, 2);
  }

  async restoreBackup(payload: string): Promise<BackupSummary> {
    if (payload.length === 0 || payload.length > 200_000_000) {
      throw new Error('Backup must be between 1 byte and 200 MB');
    }
    let backup: Partial<MockBackup>;
    try {
      backup = JSON.parse(payload) as Partial<MockBackup>;
    } catch {
      throw new Error('Backup JSON is invalid');
    }
    if (backup.format !== 'lwt-desktop-backup') {
      throw new Error('This is not an LWT desktop backup');
    }
    if (backup.version !== 1) {
      throw new Error(`Backup version ${String(backup.version)} is not supported`);
    }
    if (
      !Array.isArray(backup.texts) ||
      !Array.isArray(backup.languageSettings) ||
      !Array.isArray(backup.terms) ||
      !Array.isArray(backup.expressions) ||
      !Array.isArray(backup.termIds) ||
      !Array.isArray(backup.dueTerms) ||
      !Array.isArray(backup.reviewHistory) ||
      !Array.isArray(backup.tags) ||
      !Array.isArray(backup.textTagIds) ||
      !Array.isArray(backup.termTagIds) ||
      typeof backup.nextTagId !== 'number' ||
      typeof backup.nextTermId !== 'number'
    ) {
      throw new Error('Backup content is incomplete');
    }
    this.texts.splice(0, this.texts.length, ...backup.texts);
    this.languageSettings.clear();
    backup.languageSettings.forEach(([key, value]) => this.languageSettings.set(key, value));
    this.terms.clear();
    backup.terms.forEach(([key, value]) => this.terms.set(key, value));
    this.expressions.splice(0, this.expressions.length, ...backup.expressions);
    this.termIds.clear();
    backup.termIds.forEach(([key, value]) => this.termIds.set(key, value));
    this.dueTerms.clear();
    backup.dueTerms.forEach((key) => this.dueTerms.add(key));
    this.nextTermId = backup.nextTermId;
    this.reviewHistory.splice(0, this.reviewHistory.length, ...backup.reviewHistory);
    this.tags.splice(0, this.tags.length, ...backup.tags);
    this.nextTagId = backup.nextTagId;
    this.textTagIds.clear();
    backup.textTagIds.forEach(([id, values]) => this.textTagIds.set(id, new Set(values)));
    this.termTagIds.clear();
    backup.termTagIds.forEach(([key, values]) => this.termTagIds.set(key, new Set(values)));
    return {
      languages: this.languageSettings.size,
      texts: this.texts.length,
      terms: this.terms.size,
      tags: this.tags.length,
      expressions: this.expressions.length,
      reviews: this.reviewHistory.length,
      warnings: []
    };
  }

  async listTags(): Promise<readonly Tag[]> {
    return this.tags
      .map((tag) => ({
        ...tag,
        termCount: [...this.termTagIds.values()].filter((ids) => ids.has(tag.id)).length,
        textCount: [...this.textTagIds.values()].filter((ids) => ids.has(tag.id)).length
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async createTag(input: CreateTagInput): Promise<Tag> {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Tag name is required');
    }
    if (this.tags.some((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('Unable to create the tag: name already exists');
    }
    const tag = {
      id: this.nextTagId++,
      name,
      comment: input.comment.trim(),
      termCount: 0,
      textCount: 0
    };
    this.tags.push(tag);
    return tag;
  }

  async listTextTagIds(textId: number): Promise<readonly number[]> {
    if (!this.texts.some(({ id }) => id === textId)) {
      throw new Error('Text was not found');
    }
    return [...(this.textTagIds.get(textId) ?? [])];
  }

  async setTextTags(input: SetTextTagsInput): Promise<readonly number[]> {
    await this.listTextTagIds(input.textId);
    const ids = this.validTagIds(input.tagIds);
    this.textTagIds.set(input.textId, new Set(ids));
    return ids;
  }

  async listTermTagIds(textId: number, normalized: string): Promise<readonly number[]> {
    const text = this.texts.find(({ id }) => id === textId);
    if (!text) {
      throw new Error('Text was not found');
    }
    return [...(this.termTagIds.get(this.termKey(text.language, normalized)) ?? [])];
  }

  async setTermTags(input: SetTermTagsInput): Promise<readonly number[]> {
    const text = this.texts.find(({ id }) => id === input.textId);
    if (!text) {
      throw new Error('Text was not found');
    }
    const key = this.termKey(text.language, input.normalized);
    if (!this.terms.has(key)) {
      throw new Error('Save the term before assigning tags');
    }
    const ids = this.validTagIds(input.tagIds);
    this.termTagIds.set(key, new Set(ids));
    return ids;
  }

  private validTagIds(tagIds: readonly number[]): number[] {
    const ids = [...new Set(tagIds)];
    if (ids.some((id) => !this.tags.some((tag) => tag.id === id))) {
      throw new Error('A selected tag was not found');
    }
    return ids;
  }

  async createText(input: CreateTextInput): Promise<LibraryText> {
    const text: TextDetails = {
      id: Math.max(0, ...this.texts.map(({ id }) => id)) + 1,
      title: input.title.trim(),
      language: input.language.trim(),
      knownTerms: 0,
      totalTerms: countUniqueTerms(input.content),
      lastOpened: '',
      content: input.content,
      sourceUri: input.sourceUri
    };
    this.settingsFor(text.language);
    this.texts.unshift(text);
    return this.withProgress(text);
  }

  async getText(id: number): Promise<TextDetails> {
    const text = this.texts.find((candidate) => candidate.id === id);
    if (!text) {
      throw new Error('Text was not found');
    }
    return this.withProgress(text);
  }

  async updateText(input: UpdateTextInput): Promise<LibraryText> {
    const index = this.texts.findIndex((candidate) => candidate.id === input.id);
    if (index < 0) {
      throw new Error('Text was not found');
    }

    const previous = this.texts[index];
    if (!previous) {
      throw new Error('Text was not found');
    }
    const updated: TextDetails = {
      ...previous,
      language: input.language.trim(),
      title: input.title.trim(),
      content: input.content,
      sourceUri: input.sourceUri,
      knownTerms: 0,
      totalTerms: countUniqueTerms(input.content)
    };
    this.texts[index] = updated;
    return this.withProgress(updated);
  }

  async deleteText(id: number): Promise<void> {
    const index = this.texts.findIndex((candidate) => candidate.id === id);
    if (index < 0) {
      throw new Error('Text was not found');
    }
    this.texts.splice(index, 1);
  }

  async getReadingText(id: number): Promise<ReadingText> {
    const index = this.texts.findIndex((candidate) => candidate.id === id);
    const text = this.texts[index];
    if (!text || index < 0) {
      throw new Error('Text was not found');
    }
    const opened = { ...text, lastOpened: 'Just now' };
    this.texts[index] = opened;
    const progress = this.withProgress(opened);
    const settings = this.settingsFor(text.language);
    const sentenceTerminators = settings.sentenceTerminators || '.!?。！？';
    const escapedTerminators = sentenceTerminators.replace(/[\\\]\[\^-]/g, '\\$&');
    const sentenceTexts = this.configuredContent(text)
      .replace(/\r\n?/g, '\n')
      .split(new RegExp(`\\n+|(?<=[${escapedTerminators}])\\s+`, 'u'))
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    return {
      id: text.id,
      title: text.title,
      language: text.language,
      knownTerms: progress.knownTerms,
      totalTerms: progress.totalTerms,
      removeSpaces: settings.removeSpaces,
      rightToLeft: settings.rightToLeft,
      sentences: sentenceTexts.map((sentence, index) => ({
        id: index + 1,
        position: index + 1,
        items: createReadingItems(
          sentence,
          (normalized) =>
            this.terms.get(this.termKey(text.language, normalized))?.status ?? 0,
          settings.splitEachCharacter
        )
      })),
      expressions: this.expressions
        .filter((expression) => expression.textId === id)
        .map((expression) => ({
          ...expression.term,
          sentenceId: expression.sentenceId,
          startPosition: expression.startPosition,
          endPosition: expression.endPosition
        }))
    };
  }

  async setTermStatus(input: SetTermStatusInput): Promise<TermProgress> {
    const text = this.texts.find((candidate) => candidate.id === input.textId);
    if (!text) {
      throw new Error('Text was not found');
    }
    if (!this.normalizedTermsFor(text).includes(input.normalized)) {
      throw new Error('Term was not found in this text');
    }

    const key = this.termKey(text.language, input.normalized);
    if (input.status === 0) {
      this.terms.delete(key);
      this.dueTerms.delete(key);
    } else {
      const existing = this.terms.get(key);
      const settings = this.settingsFor(text.language);
      const surface = createReadingItems(
        this.configuredContent(text),
        () => 0,
        settings.splitEachCharacter
      ).find(
        (item) => item.normalized === input.normalized
      )?.surface;
      this.terms.set(key, {
        normalized: input.normalized,
        displayText: existing?.displayText ?? surface ?? input.normalized,
        status: input.status,
        translation: existing?.translation ?? '',
        romanization: existing?.romanization ?? '',
        wordCount: existing?.wordCount ?? 1
      });
      this.trackTerm(key, input.status);
    }
    const progress = this.withProgress(text);
    return {
      normalized: input.normalized,
      status: input.status,
      knownTerms: progress.knownTerms,
      totalTerms: progress.totalTerms
    };
  }

  async getTermDetails(textId: number, normalized: string): Promise<TermDetails> {
    const text = this.texts.find((candidate) => candidate.id === textId);
    if (!text) {
      throw new Error('Text was not found');
    }
    const settings = this.settingsFor(text.language);
    const surface = createReadingItems(
      this.configuredContent(text),
      () => 0,
      settings.splitEachCharacter
    ).find(
      (item) => item.normalized === normalized
    )?.surface;
    const existing = this.terms.get(this.termKey(text.language, normalized));
    const hasExpression = this.expressions.some(
      (expression) => expression.textId === textId && expression.term.normalized === normalized
    );
    if (!surface && !hasExpression) {
      throw new Error('Term was not found in this text');
    }

    return (
      existing ?? {
        normalized,
        displayText: surface ?? normalized,
        status: 0,
        translation: '',
        romanization: '',
        wordCount: 1
      }
    );
  }

  async saveTerm(input: SaveTermInput): Promise<SavedTerm> {
    const text = this.texts.find((candidate) => candidate.id === input.textId);
    if (!text) {
      throw new Error('Text was not found');
    }
    const current = await this.getTermDetails(input.textId, input.normalized);
    const term: TermDetails = {
      ...current,
      status: input.status,
      translation: input.translation.trim(),
      romanization: input.romanization.trim()
    };
    this.terms.set(this.termKey(text.language, input.normalized), term);
    this.trackTerm(this.termKey(text.language, input.normalized), term.status);
    const progress = this.withProgress(text);
    return {
      term,
      knownTerms: progress.knownTerms,
      totalTerms: progress.totalTerms
    };
  }

  async createExpression(input: CreateExpressionInput): Promise<CreatedExpression> {
    const reading = await this.getReadingText(input.textId);
    const sentence = reading.sentences.find(({ id }) => id === input.sentenceId);
    if (!sentence) {
      throw new Error('Text was not found');
    }
    const startPosition = Math.min(input.startPosition, input.endPosition);
    const endPosition = Math.max(input.startPosition, input.endPosition);
    const items = sentence.items.filter(
      ({ position }) => position >= startPosition && position <= endPosition
    );
    if (!items[0]?.isWord || !items.at(-1)?.isWord) {
      throw new Error('Select the first and last terms of the expression');
    }
    const words = items.filter(({ isWord }) => isWord);
    if (words.length < 2 || words.length > 9) {
      throw new Error('An expression must contain between 2 and 9 terms');
    }
    const normalized = words.map((item) => item.normalized).join(' ');
    const text = this.texts.find(({ id }) => id === input.textId);
    if (!text) {
      throw new Error('Text was not found');
    }
    const key = this.termKey(text.language, normalized);
    const term: TermDetails =
      this.terms.get(key) ?? {
        normalized,
        displayText: items.map(({ surface }) => surface).join(''),
        status: 1,
        translation: '',
        romanization: '',
        wordCount: words.length
      };
    this.terms.set(key, term);
    this.trackTerm(key, term.status);
    const created = { term, sentenceId: sentence.id, startPosition, endPosition };
    if (
      !this.expressions.some(
        (expression) =>
          expression.textId === input.textId &&
          expression.sentenceId === sentence.id &&
          expression.startPosition === startPosition &&
          expression.endPosition === endPosition
      )
    ) {
      this.expressions.push({ ...created, textId: input.textId });
    }
    return created;
  }

  async listReviewTerms(limit: number): Promise<readonly ReviewCard[]> {
    return [...this.dueTerms]
      .map((key) => {
        const term = this.terms.get(key);
        const id = this.termIds.get(key);
        const language = key.split('\u0000')[0] ?? '';
        if (!term || id === undefined || term.status < 1 || term.status > 5) {
          return undefined;
        }
        return {
          id,
          displayText: term.displayText,
          language,
          translation: term.translation,
          romanization: term.romanization,
          status: term.status,
          wordCount: term.wordCount
        } satisfies ReviewCard;
      })
      .filter((card): card is ReviewCard => card !== undefined)
      .slice(0, limit);
  }

  async recordReview(input: RecordReviewInput): Promise<ReviewOutcome> {
    const entry = [...this.termIds].find(([, id]) => id === input.termId);
    if (!entry) {
      throw new Error('Review term was not found');
    }
    const [key] = entry;
    const term = this.terms.get(key);
    if (!term) {
      throw new Error('Review term was not found');
    }
    const status = (input.rating === 0
      ? 1
      : input.rating === 1
        ? term.status
        : input.rating === 2
          ? Math.min(term.status + 1, 5)
          : 5) as TermStatus;
    this.terms.set(key, { ...term, status });
    this.dueTerms.delete(key);
    this.reviewHistory.push({ key, rating: input.rating });
    return {
      termId: input.termId,
      status,
      nextReviewAt: 'Scheduled',
      dueTerms: this.dueTerms.size
    };
  }

  async reviewStatistics(): Promise<ReviewStatistics> {
    const active = [...this.terms.entries()].filter(([, term]) =>
      [1, 2, 3, 4, 5, 99].includes(term.status)
    );
    const languageRows = new Map<
      string,
      { total: number; learning: number; known: number; reviews: number; correct: number }
    >();
    for (const [key, term] of active) {
      const language = key.split('\u0000')[0] ?? '';
      const row = languageRows.get(language) ?? {
        total: 0,
        learning: 0,
        known: 0,
        reviews: 0,
        correct: 0
      };
      row.total += 1;
      row.learning += term.status >= 1 && term.status <= 4 ? 1 : 0;
      row.known += term.status === 5 || term.status === 99 ? 1 : 0;
      languageRows.set(language, row);
    }
    for (const review of this.reviewHistory) {
      const language = review.key.split('\u0000')[0] ?? '';
      const row = languageRows.get(language) ?? {
        total: 0,
        learning: 0,
        known: 0,
        reviews: 0,
        correct: 0
      };
      row.reviews += 1;
      row.correct += review.rating >= 2 ? 1 : 0;
      languageRows.set(language, row);
    }
    const correct = this.reviewHistory.filter(({ rating }) => rating >= 2).length;
    const due = [...this.dueTerms].filter((key) => {
      const status = this.terms.get(key)?.status ?? 0;
      return status >= 1 && status <= 5;
    }).length;
    return {
      totalTerms: active.length,
      learningTerms: active.filter(([, term]) => term.status <= 4).length,
      knownTerms: active.filter(([, term]) => term.status === 5 || term.status === 99).length,
      ignoredTerms: [...this.terms.values()].filter(({ status }) => status === 98).length,
      dueTerms: due,
      reviewsToday: this.reviewHistory.length,
      correctToday: correct,
      reviewsLast7Days: this.reviewHistory.length,
      correctLast7Days: correct,
      legacyDueToday: due,
      legacyDueTomorrow: due,
      languages: [...languageRows.entries()].map(([language, row]) => ({
        language,
        totalTerms: row.total,
        learningTerms: row.learning,
        knownTerms: row.known,
        reviews: row.reviews,
        correctReviews: row.correct
      }))
    };
  }
}
