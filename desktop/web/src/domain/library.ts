export interface LibraryText {
  readonly id: number;
  readonly title: string;
  readonly language: string;
  readonly knownTerms: number;
  readonly totalTerms: number;
  readonly lastOpened: string;
}

export interface CreateTextInput {
  readonly language: string;
  readonly title: string;
  readonly content: string;
  readonly sourceUri?: string;
}

export interface UpdateTextInput extends CreateTextInput {
  readonly id: number;
}

export interface TextDetails extends LibraryText {
  readonly content: string;
  readonly sourceUri?: string;
}
