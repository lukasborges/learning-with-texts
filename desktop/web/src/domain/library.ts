export interface LibraryText {
  readonly id: number;
  readonly title: string;
  readonly language: string;
  readonly knownTerms: number;
  readonly totalTerms: number;
  readonly lastOpened: string;
}
