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

  it('passes a text creation request to the native command', async () => {
    const input = {
      language: 'English',
      title: 'Imported story',
      content: 'Once upon a time',
      sourceUri: 'https://example.com/story'
    };
    const response = {
      id: 8,
      title: input.title,
      language: input.language,
      knownTerms: 0,
      totalTerms: 0,
      lastOpened: ''
    };
    const invoke = vi.fn().mockResolvedValue(response);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.createText(input)).resolves.toEqual(response);
    expect(invoke).toHaveBeenCalledWith('create_text', { input });
  });
});
