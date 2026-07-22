import type { CreateTextInput, LibraryText } from '../domain/library';
import type { LibraryGateway } from './library_gateway';

const sampleTexts: readonly LibraryText[] = [
  {
    id: 1,
    title: 'The Man and the Dog',
    language: 'English',
    knownTerms: 138,
    totalTerms: 184,
    lastOpened: 'Today'
  },
  {
    id: 2,
    title: 'Die Leiden des jungen Werthers',
    language: 'German',
    knownTerms: 92,
    totalTerms: 241,
    lastOpened: 'Yesterday'
  },
  {
    id: 3,
    title: 'Don du sang',
    language: 'French',
    knownTerms: 64,
    totalTerms: 117,
    lastOpened: '3 days ago'
  }
];

export class MockLibraryGateway implements LibraryGateway {
  private readonly texts = [...sampleTexts];

  async listTexts(): Promise<readonly LibraryText[]> {
    return this.texts;
  }

  async createText(input: CreateTextInput): Promise<LibraryText> {
    const text: LibraryText = {
      id: Math.max(0, ...this.texts.map(({ id }) => id)) + 1,
      title: input.title.trim(),
      language: input.language.trim(),
      knownTerms: 0,
      totalTerms: 0,
      lastOpened: ''
    };
    this.texts.unshift(text);
    return text;
  }
}
