import type { TermStatus } from '../domain/library';

export function termStatusLabel(status: TermStatus): string {
  if (status >= 1 && status <= 4) {
    return 'Learning';
  }
  if (status === 5 || status === 99) {
    return 'Known';
  }
  if (status === 98) {
    return 'Ignored';
  }
  return 'Unknown';
}
