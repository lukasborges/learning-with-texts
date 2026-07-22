import type { CreateTextInput, LibraryText } from '../domain/library';

export interface LibraryGateway {
  listTexts(): Promise<readonly LibraryText[]>;
  createText(input: CreateTextInput): Promise<LibraryText>;
}
