import { describe, expect, it } from 'vitest';
import { termStatusLabel } from './term_status';

describe('termStatusLabel', () => {
  it.each([
    [0, 'Unknown'],
    [1, 'Learning'],
    [4, 'Learning'],
    [5, 'Known'],
    [98, 'Ignored'],
    [99, 'Known']
  ] as const)('maps status %s to %s', (status, expected) => {
    expect(termStatusLabel(status)).toBe(expected);
  });
});
