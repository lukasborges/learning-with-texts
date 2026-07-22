# Desktop Settings Parity

This matrix records how every legacy application preference is handled by the
desktop app. Language-specific values are migrated separately with each
language.

## Migrated and Active

| Legacy setting | Desktop behavior |
| --- | --- |
| `set-texts-per-page` | Active library page size. |
| `set-archivedtexts-per-page` | Archived library page size. |
| `set-tags-per-page` | Shared tag page size. |
| `set-show-text-word-counts` | Shows or hides counts and progress on text cards. |
| `set-test-main-frame-waiting-time` | Delay before the next review card. |

The legacy exporter includes these values in `settings`. Values outside the
desktop limits are clamped and reported in the backup warnings. Older desktop
backups without `settings` receive safe defaults.

Language dictionary URLs, Google Translate URLs, term export templates, reading
text size, substitutions, sentence terminators, character splitting, space
removal, and right-to-left direction are persisted. Dictionary and translation
templates replace `###` with the selected term and only open HTTP(S) links.

## Intentionally Obsolete

The seven `set-*-frame*` dimensions and `set-mobile-display-mode` described the
legacy frameset. The responsive desktop layout replaces them. The
`set-test-edit-frame-waiting-time` transition is also unnecessary because term
editing does not replace the review document.

## Not Applicable to Current Workflows

These settings belong to screens or interactions that the desktop MVP does not
have: `set-test-sentence-count`, `set-term-sentence-count`,
`set-terms-per-page`, `set-text-visit-statuses-via-key`,
`set-term-translation-delimiters`, and `set-similar-terms-count`. They are not
silently imported. Reintroduce each value only with its corresponding workflow
and add it to the versioned backup contract at that time.

The legacy sentence-exception and regular-expression word-character fields are
retained in backups for reference. The desktop parser deliberately uses Unicode
word rules and configured sentence-ending characters instead.
