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

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ displayText: 'dog', translation: 'cachorro' });
    expect(outcome).toMatchObject({ status: 2, dueTerms: 0 });
  });
});
