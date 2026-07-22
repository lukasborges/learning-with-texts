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
        lastOpened: '',
        archived: false
      }
    ];
    const invoke = vi.fn().mockResolvedValue(response);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.listTexts()).resolves.toEqual(response);
    expect(invoke).toHaveBeenCalledWith('list_texts');
  });

  it('loads and updates language settings', async () => {
    const language = {
      id: 2,
      name: 'Japanese',
      characterSubstitutions: '…=。',
      sentenceTerminators: '。！？',
      splitEachCharacter: true,
      removeSpaces: true,
      rightToLeft: false,
      textCount: 3
    };
    const input = {
      id: language.id,
      characterSubstitutions: language.characterSubstitutions,
      sentenceTerminators: language.sentenceTerminators,
      splitEachCharacter: language.splitEachCharacter,
      removeSpaces: language.removeSpaces,
      rightToLeft: language.rightToLeft
    };
    const invoke = vi.fn().mockResolvedValueOnce([language]).mockResolvedValueOnce(language);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.listLanguages()).resolves.toEqual([language]);
    await expect(gateway.updateLanguage(input)).resolves.toEqual(language);
    expect(invoke).toHaveBeenNthCalledWith(1, 'list_languages');
    expect(invoke).toHaveBeenNthCalledWith(2, 'update_language', { input });
  });

  it('exports and restores a portable backup', async () => {
    const payload = '{"format":"lwt-desktop-backup","version":1}';
    const summary = {
      languages: 1,
      texts: 2,
      archivedTexts: 1,
      media: 1,
      terms: 3,
      tags: 2,
      expressions: 1,
      reviews: 4,
      warnings: []
    };
    const invoke = vi.fn().mockResolvedValueOnce(payload).mockResolvedValueOnce(summary);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.exportBackup()).resolves.toBe(payload);
    await expect(gateway.restoreBackup(payload)).resolves.toEqual(summary);
    expect(invoke).toHaveBeenNthCalledWith(1, 'export_backup');
    expect(invoke).toHaveBeenNthCalledWith(2, 'restore_backup', { payload });
  });

  it('maps shared tag commands to the native runtime', async () => {
    const tag = {
      id: 4,
      name: 'Important',
      comment: '',
      termCount: 0,
      textCount: 0
    };
    const invoke = vi
      .fn()
      .mockResolvedValueOnce([tag])
      .mockResolvedValueOnce(tag)
      .mockResolvedValueOnce([4])
      .mockResolvedValueOnce([4])
      .mockResolvedValueOnce([4])
      .mockResolvedValueOnce([4]);
    const gateway = new TauriLibraryGateway(invoke);

    await gateway.listTags();
    await gateway.createTag({ name: 'Important', comment: '' });
    await gateway.listTextTagIds(2);
    await gateway.setTextTags({ textId: 2, tagIds: [4] });
    await gateway.listTermTagIds(2, 'term');
    await gateway.setTermTags({ textId: 2, normalized: 'term', tagIds: [4] });

    expect(invoke).toHaveBeenNthCalledWith(1, 'list_tags');
    expect(invoke).toHaveBeenNthCalledWith(2, 'create_tag', {
      input: { name: 'Important', comment: '' }
    });
    expect(invoke).toHaveBeenNthCalledWith(3, 'list_text_tag_ids', { textId: 2 });
    expect(invoke).toHaveBeenNthCalledWith(4, 'set_text_tags', {
      input: { textId: 2, tagIds: [4] }
    });
    expect(invoke).toHaveBeenNthCalledWith(5, 'list_term_tag_ids', {
      textId: 2,
      normalized: 'term'
    });
    expect(invoke).toHaveBeenNthCalledWith(6, 'set_term_tags', {
      input: { textId: 2, normalized: 'term', tagIds: [4] }
    });
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
      lastOpened: '',
      archived: false
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
      content: 'Once upon a time',
      archived: false,
      hasAudio: false
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
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.getText(8)).resolves.toEqual(details);
    await expect(gateway.updateText(update)).resolves.toMatchObject(update);
    await expect(gateway.setTextArchived({ id: 8, archived: true })).resolves.toBeUndefined();
    await expect(gateway.deleteText(8)).resolves.toBeUndefined();
    expect(invoke).toHaveBeenNthCalledWith(1, 'get_text', { id: 8 });
    expect(invoke).toHaveBeenNthCalledWith(2, 'update_text', { input: update });
    expect(invoke).toHaveBeenNthCalledWith(3, 'set_text_archived', {
      input: { id: 8, archived: true }
    });
    expect(invoke).toHaveBeenNthCalledWith(4, 'delete_text', { id: 8 });
  });

  it('maps text audio commands to the native runtime', async () => {
    const input = {
      textId: 8,
      fileName: 'story.mp3',
      mediaType: 'audio/mpeg',
      dataBase64: 'AQID'
    };
    const audio = {
      fileName: input.fileName,
      mediaType: input.mediaType,
      dataBase64: input.dataBase64
    };
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(audio)
      .mockResolvedValueOnce(audio)
      .mockResolvedValueOnce(undefined);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.saveTextAudio(input)).resolves.toEqual(audio);
    await expect(gateway.getTextAudio(8)).resolves.toEqual(audio);
    await expect(gateway.removeTextAudio(8)).resolves.toBeUndefined();
    expect(invoke).toHaveBeenNthCalledWith(1, 'save_text_audio', { input });
    expect(invoke).toHaveBeenNthCalledWith(2, 'get_text_audio', { textId: 8 });
    expect(invoke).toHaveBeenNthCalledWith(3, 'remove_text_audio', { textId: 8 });
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

  it('loads review statistics from the native runtime', async () => {
    const statistics = {
      totalTerms: 12,
      learningTerms: 8,
      knownTerms: 4,
      ignoredTerms: 1,
      dueTerms: 3,
      reviewsToday: 5,
      correctToday: 4,
      reviewsLast7Days: 18,
      correctLast7Days: 14,
      legacyDueToday: 2,
      legacyDueTomorrow: 4,
      languages: []
    };
    const invoke = vi.fn().mockResolvedValue(statistics);
    const gateway = new TauriLibraryGateway(invoke);

    await expect(gateway.reviewStatistics()).resolves.toEqual(statistics);
    expect(invoke).toHaveBeenCalledWith('review_statistics');
  });
});
