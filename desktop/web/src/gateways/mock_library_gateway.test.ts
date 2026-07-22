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
});
