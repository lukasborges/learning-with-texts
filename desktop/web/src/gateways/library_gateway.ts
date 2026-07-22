import type {
  CreateTextInput,
  LibraryText,
  ReadingText,
  SaveTermInput,
  SavedTerm,
  SetTermStatusInput,
  TermDetails,
  TermProgress,
  TextDetails,
  UpdateTextInput
} from '../domain/library';

export interface LibraryGateway {
  listTexts(): Promise<readonly LibraryText[]>;
  createText(input: CreateTextInput): Promise<LibraryText>;
  getText(id: number): Promise<TextDetails>;
  updateText(input: UpdateTextInput): Promise<LibraryText>;
  deleteText(id: number): Promise<void>;
  getReadingText(id: number): Promise<ReadingText>;
  setTermStatus(input: SetTermStatusInput): Promise<TermProgress>;
  getTermDetails(textId: number, normalized: string): Promise<TermDetails>;
  saveTerm(input: SaveTermInput): Promise<SavedTerm>;
}
