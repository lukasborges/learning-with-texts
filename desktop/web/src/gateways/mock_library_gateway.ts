import type {
  CreateTextInput,
  LibraryText,
  ReadingItem,
  ReadingText,
  SetTermStatusInput,
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
  return parts.map((surface) => {
    const isWord = /^[\p{L}\p{N}_]+(?:['’‐‑-][\p{L}\p{N}_]+)*$/u.test(surface);
    const normalized = isWord ? surface.toLocaleLowerCase() : '';
    return {
      surface,
      normalized,
      isWord,
      status: isWord ? statusFor(normalized) : 0
    };
  });
}

export class MockLibraryGateway implements LibraryGateway {
  private readonly texts = sampleTexts.map((text) => ({ ...text }));
  private readonly termStatuses = new Map<string, TermStatus>();

  private termKey(language: string, normalized: string): string {
    return `${language.toLocaleLowerCase()}\u0000${normalized}`;
  }

  private withProgress(text: TextDetails): TextDetails {
    const terms = new Set(normalizedTerms(text.content));
    const knownTerms = [...terms].filter((term) => {
      const status = this.termStatuses.get(this.termKey(text.language, term)) ?? 0;
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
          this.termStatuses.get(this.termKey(text.language, normalized)) ?? 0
        )
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
      this.termStatuses.delete(key);
    } else {
      this.termStatuses.set(key, input.status);
    }
    const progress = this.withProgress(text);
    return {
      normalized: input.normalized,
      status: input.status,
      knownTerms: progress.knownTerms,
      totalTerms: progress.totalTerms
    };
  }
}
