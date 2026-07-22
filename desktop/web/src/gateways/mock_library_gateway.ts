import type {
  CreateTextInput,
  CreateExpressionInput,
  CreatedExpression,
  LibraryText,
  ReadingItem,
  ReadingText,
  RecordReviewInput,
  ReviewCard,
  ReviewOutcome,
  SaveTermInput,
  SavedTerm,
  SetTermStatusInput,
  TermDetails,
  TermProgress,
  TermStatus,
  TextDetails,
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
  statusFor: (normalized: string) => TermStatus
): readonly ReadingItem[] {
  const parts = content
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
    const terms = new Set(normalizedTerms(text.content));
    const knownTerms = [...terms].filter((term) => {
      const status = this.terms.get(this.termKey(text.language, term))?.status ?? 0;
      return status === 5 || status === 99;
    }).length;
    return { ...text, knownTerms, totalTerms: terms.size };
  }

  async listTexts(): Promise<readonly LibraryText[]> {
    return this.texts.map((text) => this.withProgress(text));
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
    const sentenceTexts = text.content
      .replace(/\r\n?/g, '\n')
      .split(/\n+|(?<=[.!?。！？])\s+/u)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    return {
      id: text.id,
      title: text.title,
      language: text.language,
      knownTerms: progress.knownTerms,
      totalTerms: progress.totalTerms,
      sentences: sentenceTexts.map((sentence, index) => ({
        id: index + 1,
        position: index + 1,
        items: createReadingItems(sentence, (normalized) =>
          this.terms.get(this.termKey(text.language, normalized))?.status ?? 0
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
    if (!normalizedTerms(text.content).includes(input.normalized)) {
      throw new Error('Term was not found in this text');
    }

    const key = this.termKey(text.language, input.normalized);
    if (input.status === 0) {
      this.terms.delete(key);
      this.dueTerms.delete(key);
    } else {
      const existing = this.terms.get(key);
      const surface = createReadingItems(text.content, () => 0).find(
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
    const surface = createReadingItems(text.content, () => 0).find(
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
    return {
      termId: input.termId,
      status,
      nextReviewAt: 'Scheduled',
      dueTerms: this.dueTerms.size
    };
  }
}
