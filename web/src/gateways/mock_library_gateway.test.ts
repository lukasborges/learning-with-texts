import { describe, expect, it } from 'vitest';
import { MockLibraryGateway } from './mock_library_gateway';

describe('MockLibraryGateway', () => {
  it('returns stable offline fixture data', async () => {
    const texts = await new MockLibraryGateway().listTexts();

    expect(texts).toHaveLength(3);
    expect(texts[0]).toMatchObject({
      id: 1,
      language: 'English',
      title: 'The Man and the Dog'
    });
  });

  it('keeps newly created texts for the browser preview session', async () => {
    const gateway = new MockLibraryGateway();

    const created = await gateway.createText({
      language: 'Portuguese',
      title: 'Um conto',
      content: 'Era uma vez.'
    });
    const texts = await gateway.listTexts();

    expect(created).toMatchObject({
      id: 4,
      language: 'Portuguese',
      title: 'Um conto',
      totalTerms: 3
    });
    expect(texts[0]).toEqual(created);
  });

  it('applies language settings to browser-preview reading', async () => {
    const gateway = new MockLibraryGateway();
    const created = await gateway.createText({
      language: 'Japanese',
      title: '短い話',
      content: '日本語… 次'
    });
    const language = (await gateway.listLanguages()).find(({ name }) => name === 'Japanese');
    if (!language) {
      throw new Error('Japanese fixture language is missing');
    }

    await gateway.updateLanguage({
      id: language.id,
      dictionaryUri1: 'https://example.com/dictionary?q=###',
      dictionaryUri2: undefined,
      googleTranslateUri: undefined,
      exportTemplate: undefined,
      textSize: 125,
      characterSubstitutions: '…=。',
      sentenceTerminators: '。',
      splitEachCharacter: true,
      removeSpaces: true,
      rightToLeft: false
    });
    const reading = await gateway.getReadingText(created.id);

    expect(reading).toMatchObject({ removeSpaces: true, rightToLeft: false });
    expect(reading.totalTerms).toBe(4);
    expect(reading.sentences).toHaveLength(2);
  });

  it('creates a language independently from text creation', async () => {
    const gateway = new MockLibraryGateway();

    const language = await gateway.createLanguage({
      name: 'Korean',
      dictionaryUri1: 'https://example.com?q=###',
      dictionaryUri2: 'https://example.org?q=###',
      googleTranslateUri: 'https://translate.example/?text=###'
    });

    expect(language).toMatchObject({
      name: 'Korean',
      dictionaryUri1: 'https://example.com?q=###',
      dictionaryUri2: 'https://example.org?q=###',
      googleTranslateUri: 'https://translate.example/?text=###',
      textCount: 0
    });
  });

  it('round-trips a portable browser-preview backup', async () => {
    const gateway = new MockLibraryGateway();
    await gateway.updateAppSettings({
      libraryPageSize: 10,
      archivedPageSize: 15,
      tagPageSize: 20,
      showWordCounts: false,
      reviewDelayMs: 250
    });
    await gateway.setTextArchived({ id: 1, archived: true });
    await gateway.saveTextAudio({
      textId: 1,
      fileName: 'story.mp3',
      mediaType: 'audio/mpeg',
      dataBase64: 'AQID'
    });
    const payload = await gateway.exportBackup();
    await gateway.createText({
      language: 'Portuguese',
      title: 'Temporary',
      content: 'Este texto será removido.'
    });

    const summary = await gateway.restoreBackup(payload);
    const texts = await gateway.listTexts();

    expect(summary).toMatchObject({ languages: 3, texts: 3, archivedTexts: 1, media: 1 });
    expect(texts.some(({ title }) => title === 'Temporary')).toBe(false);
    expect(texts.find(({ id }) => id === 1)?.archived).toBe(true);
    await expect(gateway.getTextAudio(1)).resolves.toMatchObject({ fileName: 'story.mp3' });
    await expect(gateway.appSettings()).resolves.toEqual({
      libraryPageSize: 10,
      archivedPageSize: 15,
      tagPageSize: 20,
      showWordCounts: false,
      reviewDelayMs: 250
    });
  });

  it('creates and assigns shared tags in browser preview', async () => {
    const gateway = new MockLibraryGateway();
    const tag = await gateway.createTag({ name: 'Important', comment: 'Review first' });
    await gateway.setTextTags({ textId: 1, tagIds: [tag.id] });
    await gateway.saveTerm({
      textId: 1,
      normalized: 'dog',
      status: 1,
      translation: 'cachorro',
      romanization: ''
    });
    await gateway.setTermTags({ textId: 1, normalized: 'dog', tagIds: [tag.id] });

    const tags = await gateway.listTags();

    expect(tags[0]).toMatchObject({ name: 'Important', textCount: 1, termCount: 1 });
    await expect(gateway.listTextTagIds(1)).resolves.toEqual([tag.id]);
    await expect(gateway.listTermTagIds(1, 'dog')).resolves.toEqual([tag.id]);
  });

  it('loads, updates, and deletes a text in the preview session', async () => {
    const gateway = new MockLibraryGateway();

    const details = await gateway.getText(1);
    const updated = await gateway.updateText({
      id: 1,
      language: 'Portuguese',
      title: 'Título atualizado',
      content: 'Conteúdo atualizado.'
    });
    await gateway.deleteText(1);
    const texts = await gateway.listTexts();

    expect(details.content).toContain('dog');
    expect(updated).toMatchObject({ language: 'Portuguese', title: 'Título atualizado' });
    expect(texts.some(({ id }) => id === 1)).toBe(false);
  });

  it('archives and restores a text in the preview session', async () => {
    const gateway = new MockLibraryGateway();

    await gateway.setTextArchived({ id: 1, archived: true });
    expect((await gateway.listTexts()).find(({ id }) => id === 1)?.archived).toBe(true);

    await gateway.setTextArchived({ id: 1, archived: false });
    expect((await gateway.getText(1)).archived).toBe(false);
    await expect(gateway.setTextArchived({ id: 999, archived: true })).rejects.toThrow(
      'Text was not found'
    );
  });

  it('saves and removes text audio in the preview session', async () => {
    const gateway = new MockLibraryGateway();
    const input = {
      textId: 1,
      fileName: 'story.ogg',
      mediaType: 'audio/ogg',
      dataBase64: 'T2dnUw=='
    };

    await expect(gateway.saveTextAudio(input)).resolves.toMatchObject({
      fileName: input.fileName,
      mediaType: input.mediaType,
      dataBase64: input.dataBase64
    });
    await expect(gateway.getTextAudio(1)).resolves.toMatchObject({
      fileName: input.fileName,
      mediaType: input.mediaType,
      dataBase64: input.dataBase64
    });
    expect((await gateway.getText(1)).hasAudio).toBe(true);

    await gateway.removeTextAudio(1);
    await expect(gateway.getTextAudio(1)).resolves.toBeNull();
    expect((await gateway.getText(1)).hasAudio).toBe(false);
  });

  it('opens parsed reading items and shares their status', async () => {
    const gateway = new MockLibraryGateway();

    const reading = await gateway.getReadingText(1);
    const progress = await gateway.setTermStatus({
      textId: 1,
      normalized: 'dog',
      status: 5
    });
    const reopened = await gateway.getReadingText(1);

    expect(reading.sentences).not.toHaveLength(0);
    expect(progress.knownTerms).toBe(1);
    expect(
      reopened.sentences
        .flatMap(({ items }) => items)
        .find(({ normalized }) => normalized === 'dog')
    ).toMatchObject({ status: 5 });
  });

  it('finishes a lesson without changing learning terms and supports undo', async () => {
    const gateway = new MockLibraryGateway();
    await gateway.saveTerm({
      textId: 1,
      normalized: 'dog',
      status: 2,
      translation: 'cachorro',
      romanization: ''
    });

    const finished = await gateway.finishLesson(1);
    const afterFinish = await gateway.getReadingText(1);
    const learning = afterFinish.sentences
      .flatMap(({ items }) => items)
      .find(({ normalized }) => normalized === 'dog');

    expect(finished.markedKnown).toBeGreaterThan(0);
    expect(learning?.status).toBe(2);
    expect((await gateway.getText(1)).completedAt).toBeTruthy();

    const undone = await gateway.undoFinishLesson({
      completionId: finished.completionId
    });
    expect(undone.revertedTerms).toBe(finished.markedKnown);
    expect((await gateway.getText(1)).completedAt).toBeUndefined();
    await expect(
      gateway.undoFinishLesson({ completionId: finished.completionId })
    ).rejects.toThrow('already undone');
  });

  it('stores translation and romanization for a term', async () => {
    const gateway = new MockLibraryGateway();

    const initial = await gateway.getTermDetails(1, 'dog');
    const saved = await gateway.saveTerm({
      textId: 1,
      normalized: 'dog',
      status: 1,
      translation: 'cachorro',
      romanization: 'dog'
    });
    const loaded = await gateway.getTermDetails(1, 'dog');

    expect(initial.status).toBe(0);
    expect(saved.term.translation).toBe('cachorro');
    expect(loaded).toMatchObject({
      status: 1,
      translation: 'cachorro',
      romanization: 'dog'
    });
  });

  it('creates and reopens a compound expression', async () => {
    const gateway = new MockLibraryGateway();
    const reading = await gateway.getReadingText(1);
    const sentence = reading.sentences[0];
    if (!sentence) {
      throw new Error('fixture sentence is missing');
    }

    const created = await gateway.createExpression({
      textId: 1,
      sentenceId: sentence.id,
      startPosition: 1,
      endPosition: 3
    });
    const reopened = await gateway.getReadingText(1);

    expect(created.term).toMatchObject({ normalized: 'a man', wordCount: 2 });
    expect(reopened.expressions).toHaveLength(1);
  });

  it('queues and reviews a saved term', async () => {
    const gateway = new MockLibraryGateway();
    await gateway.saveTerm({
      textId: 1,
      normalized: 'dog',
      status: 1,
      translation: 'cachorro',
      romanization: ''
    });

    const queue = await gateway.listReviewTerms(20);
    const outcome = await gateway.recordReview({ termId: queue[0]?.id ?? 0, rating: 2 });
    const vocabulary = await gateway.listVocabularyTerms();
    await gateway.updateVocabularyTerm({
      id: vocabulary[0]?.id ?? 0,
      status: 4,
      translation: 'cão',
      romanization: 'dog'
    });
    const updated = await gateway.listVocabularyTerms();

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      displayText: 'dog',
      translation: 'cachorro',
      context: 'A man and his dog walked along the road.',
      sourceTitle: 'The Man and the Dog'
    });
    expect(updated[0]).toMatchObject({
      status: 4,
      translation: 'cão',
      romanization: 'dog'
    });
    expect(outcome).toMatchObject({ status: 2, dueTerms: 0 });
  });

  it('summarizes learning and review progress', async () => {
    const gateway = new MockLibraryGateway();
    await gateway.saveTerm({
      textId: 1,
      normalized: 'dog',
      status: 1,
      translation: 'cachorro',
      romanization: ''
    });

    const before = await gateway.reviewStatistics();
    const queue = await gateway.listReviewTerms(20);
    await gateway.recordReview({ termId: queue[0]?.id ?? 0, rating: 2 });
    const after = await gateway.reviewStatistics();

    expect(before).toMatchObject({ totalTerms: 1, learningTerms: 1, dueTerms: 1 });
    expect(after).toMatchObject({
      totalTerms: 1,
      learningTerms: 1,
      dueTerms: 0,
      reviewsToday: 1,
      correctToday: 1
    });
    expect(after.languages[0]).toMatchObject({
      language: 'english',
      totalTerms: 1,
      reviews: 1,
      correctReviews: 1
    });
  });
});
