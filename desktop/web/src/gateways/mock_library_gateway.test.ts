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
      title: 'Um conto'
    });
    expect(texts[0]).toEqual(created);
  });
});
