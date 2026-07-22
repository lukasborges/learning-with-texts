import type {
  CreateTextInput,
  LibraryText,
  ReadingText,
  SetTermStatusInput,
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
}
