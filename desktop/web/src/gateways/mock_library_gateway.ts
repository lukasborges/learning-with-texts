import type {
  CreateTextInput,
  LibraryText,
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
  const terms = content
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}_]+(?:['’‐‑-][\p{L}\p{N}_]+)*/gu);
  return new Set(terms ?? []).size;
}

export class MockLibraryGateway implements LibraryGateway {
  private readonly texts = sampleTexts.map((text) => ({ ...text }));

  async listTexts(): Promise<readonly LibraryText[]> {
    return this.texts;
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
    return text;
  }

  async getText(id: number): Promise<TextDetails> {
    const text = this.texts.find((candidate) => candidate.id === id);
    if (!text) {
      throw new Error('Text was not found');
    }
    return { ...text };
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
    return updated;
  }

  async deleteText(id: number): Promise<void> {
    const index = this.texts.findIndex((candidate) => candidate.id === id);
    if (index < 0) {
      throw new Error('Text was not found');
    }
    this.texts.splice(index, 1);
  }
}
