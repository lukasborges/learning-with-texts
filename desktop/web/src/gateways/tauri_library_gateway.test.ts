import { describe, expect, it, vi } from 'vitest';
import { TauriLibraryGateway } from './tauri_library_gateway';

describe('TauriLibraryGateway', () => {
  it('calls the typed list_texts command', async () => {
    const response = [
      {
        id: 7,
        title: 'A local text',
        language: 'English',
        knownTerms: 0,
        totalTerms: 0,
        lastOpened: ''
      }
    ];
    const invoke = vi.fn().mockResolvedValue(response);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.listTexts()).resolves.toEqual(response);
    expect(invoke).toHaveBeenCalledWith('list_texts');
  });
});
