import type {
  CreateTextInput,
  LibraryText,
  ReadingText,
  SetTermStatusInput,
  TermProgress,
  TextDetails,
  UpdateTextInput
} from '../domain/library';
import type { LibraryGateway } from './library_gateway';

export type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>
) => Promise<T>;

export class TauriLibraryGateway implements LibraryGateway {
  constructor(private readonly invoke: TauriInvoke) {}

  listTexts(): Promise<readonly LibraryText[]> {
    return this.invoke<LibraryText[]>('list_texts');
  }

  createText(input: CreateTextInput): Promise<LibraryText> {
    return this.invoke<LibraryText>('create_text', { input });
  }

  getText(id: number): Promise<TextDetails> {
    return this.invoke<TextDetails>('get_text', { id });
  }

  updateText(input: UpdateTextInput): Promise<LibraryText> {
    return this.invoke<LibraryText>('update_text', { input });
  }

  deleteText(id: number): Promise<void> {
    return this.invoke<void>('delete_text', { id });
  }

  getReadingText(id: number): Promise<ReadingText> {
    return this.invoke<ReadingText>('get_reading_text', { id });
  }

  setTermStatus(input: SetTermStatusInput): Promise<TermProgress> {
    return this.invoke<TermProgress>('set_term_status', { input });
  }
}
