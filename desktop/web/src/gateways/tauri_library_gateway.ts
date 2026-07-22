import type { LibraryText } from '../domain/library';
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
}
