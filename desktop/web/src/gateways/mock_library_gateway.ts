import type { LibraryText } from '../domain/library';
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
  async listTexts(): Promise<readonly LibraryText[]> {
    return sampleTexts;
  }
}
