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

  it('maps text editing commands to their native counterparts', async () => {
    const details = {
      id: 8,
      title: 'Imported story',
      language: 'English',
      knownTerms: 0,
      totalTerms: 0,
      lastOpened: '',
      content: 'Once upon a time'
    };
    const update = {
      id: details.id,
      language: 'French',
      title: 'Updated story',
      content: 'Il était une fois'
    };
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(details)
      .mockResolvedValueOnce({ ...details, ...update })
      .mockResolvedValueOnce(undefined);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.getText(8)).resolves.toEqual(details);
    await expect(gateway.updateText(update)).resolves.toMatchObject(update);
    await expect(gateway.deleteText(8)).resolves.toBeUndefined();
    expect(invoke).toHaveBeenNthCalledWith(1, 'get_text', { id: 8 });
    expect(invoke).toHaveBeenNthCalledWith(2, 'update_text', { input: update });
    expect(invoke).toHaveBeenNthCalledWith(3, 'delete_text', { id: 8 });
  });

  it('maps reading and term status commands to the native runtime', async () => {
    const reading = {
      id: 8,
      title: 'Story',
      language: 'English',
      knownTerms: 0,
      totalTerms: 1,
      sentences: []
    };
    const input = { textId: 8, normalized: 'story', status: 5 as const };
    const progress = {
      normalized: 'story',
      status: 5,
      knownTerms: 1,
      totalTerms: 1
    };
    const invoke = vi.fn().mockResolvedValueOnce(reading).mockResolvedValueOnce(progress);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.getReadingText(8)).resolves.toEqual(reading);
    await expect(gateway.setTermStatus(input)).resolves.toEqual(progress);
    expect(invoke).toHaveBeenNthCalledWith(1, 'get_reading_text', { id: 8 });
    expect(invoke).toHaveBeenNthCalledWith(2, 'set_term_status', { input });
  });

  it('loads and saves detailed term data', async () => {
    const term = {
      normalized: 'story',
      displayText: 'Story',
      status: 1,
      translation: 'história',
      romanization: ''
    };
    const input = {
      textId: 8,
      normalized: 'story',
      status: 5 as const,
      translation: 'história',
      romanization: ''
    };
    const saved = { term: { ...term, status: 5 }, knownTerms: 1, totalTerms: 1 };
    const invoke = vi.fn().mockResolvedValueOnce(term).mockResolvedValueOnce(saved);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.getTermDetails(8, 'story')).resolves.toEqual(term);
    await expect(gateway.saveTerm(input)).resolves.toEqual(saved);
    expect(invoke).toHaveBeenNthCalledWith(1, 'get_term_details', {
      textId: 8,
      normalized: 'story'
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'save_term', { input });
  });

  it('creates a compound expression from a reading range', async () => {
    const input = { textId: 8, sentenceId: 2, startPosition: 1, endPosition: 5 };
    const created = {
      term: {
        normalized: 'a short story',
        displayText: 'A short story',
        status: 1,
        translation: '',
        romanization: '',
        wordCount: 3
      },
      sentenceId: 2,
      startPosition: 1,
      endPosition: 5
    };
    const invoke = vi.fn().mockResolvedValue(created);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.createExpression(input)).resolves.toEqual(created);
    expect(invoke).toHaveBeenCalledWith('create_expression', { input });
  });

  it('loads the review queue and records a rating', async () => {
    const queue = [{ id: 3, displayText: 'term' }];
    const input = { termId: 3, rating: 2 as const };
    const outcome = { termId: 3, status: 2, nextReviewAt: 'tomorrow', dueTerms: 0 };
    const invoke = vi.fn().mockResolvedValueOnce(queue).mockResolvedValueOnce(outcome);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.listReviewTerms(20)).resolves.toEqual(queue);
    await expect(gateway.recordReview(input)).resolves.toEqual(outcome);
    expect(invoke).toHaveBeenNthCalledWith(1, 'list_review_terms', { limit: 20 });
    expect(invoke).toHaveBeenNthCalledWith(2, 'record_review', { input });
  });
});
