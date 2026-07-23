import type {
  AppSettings,
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
  SaveTextAudioInput,
  SavedTerm,
  SetTermStatusInput,
  SetTermTagsInput,
  SetTextArchivedInput,
  SetTextTagsInput,
  Tag,
  TermDetails,
  TermProgress,
  TextDetails,
  TextAudio,
  UpdateLanguageInput,
  UpdateTextInput
} from '../domain/library';
import type { LibraryGateway } from './library_gateway';

export type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>
) => Promise<T>;

export class TauriLibraryGateway implements LibraryGateway {
  constructor(private readonly invoke: TauriInvoke) {}

  listTexts(): Promise<readonly LibraryText[]> {
    return this.invoke<LibraryText[]>('list_texts');
  }

  listLanguages(): Promise<readonly LanguageSettings[]> {
    return this.invoke<LanguageSettings[]>('list_languages');
  }

  appSettings(): Promise<AppSettings> {
    return this.invoke<AppSettings>('app_settings');
  }

  updateAppSettings(settings: AppSettings): Promise<AppSettings> {
    return this.invoke<AppSettings>('update_app_settings', { settings });
  }

  updateLanguage(input: UpdateLanguageInput): Promise<LanguageSettings> {
    return this.invoke<LanguageSettings>('update_language', { input });
  }

  exportBackup(): Promise<string> {
    return this.invoke<string>('export_backup');
  }

  restoreBackup(payload: string): Promise<BackupSummary> {
    return this.invoke<BackupSummary>('restore_backup', { payload });
  }

  listTags(): Promise<readonly Tag[]> {
    return this.invoke<Tag[]>('list_tags');
  }

  createTag(input: CreateTagInput): Promise<Tag> {
    return this.invoke<Tag>('create_tag', { input });
  }

  listTextTagIds(textId: number): Promise<readonly number[]> {
    return this.invoke<number[]>('list_text_tag_ids', { textId });
  }

  setTextTags(input: SetTextTagsInput): Promise<readonly number[]> {
    return this.invoke<number[]>('set_text_tags', { input });
  }

  listTermTagIds(textId: number, normalized: string): Promise<readonly number[]> {
    return this.invoke<number[]>('list_term_tag_ids', { textId, normalized });
  }

  setTermTags(input: SetTermTagsInput): Promise<readonly number[]> {
    return this.invoke<number[]>('set_term_tags', { input });
  }

  createText(input: CreateTextInput): Promise<LibraryText> {
    return this.invoke<LibraryText>('create_text', { input });
  }

  getText(id: number): Promise<TextDetails> {
    return this.invoke<TextDetails>('get_text', { id });
  }

  updateText(input: UpdateTextInput): Promise<LibraryText> {
    return this.invoke<LibraryText>('update_text', { input });
  }

  setTextArchived(input: SetTextArchivedInput): Promise<void> {
    return this.invoke<void>('set_text_archived', { input });
  }

  saveTextAudio(input: SaveTextAudioInput): Promise<TextAudio> {
    return this.invoke<TextAudio>('save_text_audio', { input });
  }

  getTextAudio(textId: number): Promise<TextAudio | null> {
    return this.invoke<TextAudio | null>('get_text_audio', { textId });
  }

  removeTextAudio(textId: number): Promise<void> {
    return this.invoke<void>('remove_text_audio', { textId });
  }

  deleteText(id: number): Promise<void> {
    return this.invoke<void>('delete_text', { id });
  }

  getReadingText(id: number): Promise<ReadingText> {
    return this.invoke<ReadingText>('get_reading_text', { id });
  }

  setTermStatus(input: SetTermStatusInput): Promise<TermProgress> {
    return this.invoke<TermProgress>('set_term_status', { input });
  }

  getTermDetails(textId: number, normalized: string): Promise<TermDetails> {
    return this.invoke<TermDetails>('get_term_details', { textId, normalized });
  }

  saveTerm(input: SaveTermInput): Promise<SavedTerm> {
    return this.invoke<SavedTerm>('save_term', { input });
  }

  createExpression(input: CreateExpressionInput): Promise<CreatedExpression> {
    return this.invoke<CreatedExpression>('create_expression', { input });
  }

  listReviewTerms(limit: number): Promise<readonly ReviewCard[]> {
    return this.invoke<ReviewCard[]>('list_review_terms', { limit });
  }

  recordReview(input: RecordReviewInput): Promise<ReviewOutcome> {
    return this.invoke<ReviewOutcome>('record_review', { input });
  }

  reviewStatistics(): Promise<ReviewStatistics> {
    return this.invoke<ReviewStatistics>('review_statistics');
  }
}
