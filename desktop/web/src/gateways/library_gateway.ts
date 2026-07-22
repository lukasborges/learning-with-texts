import type {
  BackupSummary,
  CreateTagInput,
  CreateTextInput,
  CreateExpressionInput,
  CreatedExpression,
  LanguageSettings,
  LibraryText,
  ReadingText,
  RecordReviewInput,
  ReviewCard,
  ReviewOutcome,
  ReviewStatistics,
  SaveTermInput,
  SavedTerm,
  SetTermStatusInput,
  SetTermTagsInput,
  SetTextTagsInput,
  Tag,
  TermDetails,
  TermProgress,
  TextDetails,
  UpdateLanguageInput,
  UpdateTextInput
} from '../domain/library';

export interface LibraryGateway {
  listTexts(): Promise<readonly LibraryText[]>;
  listLanguages(): Promise<readonly LanguageSettings[]>;
  updateLanguage(input: UpdateLanguageInput): Promise<LanguageSettings>;
  exportBackup(): Promise<string>;
  restoreBackup(payload: string): Promise<BackupSummary>;
  listTags(): Promise<readonly Tag[]>;
  createTag(input: CreateTagInput): Promise<Tag>;
  listTextTagIds(textId: number): Promise<readonly number[]>;
  setTextTags(input: SetTextTagsInput): Promise<readonly number[]>;
  listTermTagIds(textId: number, normalized: string): Promise<readonly number[]>;
  setTermTags(input: SetTermTagsInput): Promise<readonly number[]>;
  createText(input: CreateTextInput): Promise<LibraryText>;
  getText(id: number): Promise<TextDetails>;
  updateText(input: UpdateTextInput): Promise<LibraryText>;
  deleteText(id: number): Promise<void>;
  getReadingText(id: number): Promise<ReadingText>;
  setTermStatus(input: SetTermStatusInput): Promise<TermProgress>;
  getTermDetails(textId: number, normalized: string): Promise<TermDetails>;
  saveTerm(input: SaveTermInput): Promise<SavedTerm>;
  createExpression(input: CreateExpressionInput): Promise<CreatedExpression>;
  listReviewTerms(limit: number): Promise<readonly ReviewCard[]>;
  recordReview(input: RecordReviewInput): Promise<ReviewOutcome>;
  reviewStatistics(): Promise<ReviewStatistics>;
}
