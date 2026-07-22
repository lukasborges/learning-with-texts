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

export type TermStatus = 0 | 1 | 2 | 3 | 4 | 5 | 98 | 99;

export interface ReadingItem {
  readonly position: number;
  readonly surface: string;
  readonly normalized: string;
  readonly isWord: boolean;
  readonly status: TermStatus;
}

export interface ReadingSentence {
  readonly id: number;
  readonly position: number;
  readonly items: readonly ReadingItem[];
}

export interface ReadingText {
  readonly id: number;
  readonly title: string;
  readonly language: string;
  readonly knownTerms: number;
  readonly totalTerms: number;
  readonly sentences: readonly ReadingSentence[];
  readonly expressions: readonly ReadingExpression[];
}

export interface ReadingExpression extends TermDetails {
  readonly sentenceId: number;
  readonly startPosition: number;
  readonly endPosition: number;
}

export interface SetTermStatusInput {
  readonly textId: number;
  readonly normalized: string;
  readonly status: TermStatus;
}

export interface TermProgress {
  readonly normalized: string;
  readonly status: TermStatus;
  readonly knownTerms: number;
  readonly totalTerms: number;
}

export interface TermDetails {
  readonly normalized: string;
  readonly displayText: string;
  readonly status: TermStatus;
  readonly translation: string;
  readonly romanization: string;
  readonly wordCount: number;
}

export interface SaveTermInput {
  readonly textId: number;
  readonly normalized: string;
  readonly status: Exclude<TermStatus, 0>;
  readonly translation: string;
  readonly romanization: string;
}

export interface SavedTerm {
  readonly term: TermDetails;
  readonly knownTerms: number;
  readonly totalTerms: number;
}

export interface CreateExpressionInput {
  readonly textId: number;
  readonly sentenceId: number;
  readonly startPosition: number;
  readonly endPosition: number;
}

export interface CreatedExpression {
  readonly term: TermDetails;
  readonly sentenceId: number;
  readonly startPosition: number;
  readonly endPosition: number;
}

export interface ReviewCard {
  readonly id: number;
  readonly displayText: string;
  readonly language: string;
  readonly translation: string;
  readonly romanization: string;
  readonly status: TermStatus;
  readonly wordCount: number;
}

export type ReviewRating = 0 | 1 | 2 | 3;

export interface RecordReviewInput {
  readonly termId: number;
  readonly rating: ReviewRating;
}

export interface ReviewOutcome {
  readonly termId: number;
  readonly status: TermStatus;
  readonly nextReviewAt: string;
  readonly dueTerms: number;
}
