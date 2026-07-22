import type {
  CreateTextInput,
  LibraryText,
  TextDetails,
  UpdateTextInput
} from '../domain/library';

export interface LibraryGateway {
  listTexts(): Promise<readonly LibraryText[]>;
  createText(input: CreateTextInput): Promise<LibraryText>;
  getText(id: number): Promise<TextDetails>;
  updateText(input: UpdateTextInput): Promise<LibraryText>;
  deleteText(id: number): Promise<void>;
}
