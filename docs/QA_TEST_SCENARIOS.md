# QA Test Scenarios

Use these scenarios to validate a release candidate end to end. Record the app
version, operating system, installer type, tester, date, result, and defect link
for every run. Execute the complete suite on Windows and one Linux package;
repeat installation, launch, update, and removal on every supported package.

## Test Matrix and Data

| Platform | Packages |
| --- | --- |
| Windows 10/11 x64 | MSI and NSIS |
| Ubuntu 24.04 x64 | DEB and AppImage |
| Arch Linux x64 | pacman package |

Prepare a UTF-8 `.txt` file, valid MP3/OGG audio, an unsupported file, a file
over 50 MB, an application backup, the legacy fixture in
`tests/fixtures/legacy-backup-v1.json`, and texts containing accents, CJK,
right-to-left text, punctuation, and repeated terms. Start destructive scenarios
with a verified backup.

## Installation and Lifecycle

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| INS-01 | Verify download | Validate the release-wide SHA-256 manifest before installation. | Every downloaded file passes; altered or missing files fail verification. |
| INS-02 | Clean install | Install with the native package manager and launch from the application menu. | Installation succeeds, one app entry is created, and the empty library opens without a server or terminal. |
| INS-03 | Windows warning | Start each Windows installer and continue through the unknown-publisher warning. | The warning matches release documentation and the installer remains usable. |
| INS-04 | Relaunch persistence | Create data, close the window, end the process, and reopen the app. | Texts, settings, tags, terms, reviews, and audio persist. |
| INS-05 | Upgrade | Install the next candidate over a populated previous version. | Schema upgrade succeeds once, all data remains available, and normal work continues. |
| INS-06 | Uninstall/reinstall | Uninstall normally, record whether user data remains, then reinstall. | No broken shortcuts or binaries remain; retained-data behavior matches release notes and reinstall launches successfully. |

## Library and Text Management

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| LIB-01 | Empty library | Launch with a new application-data directory. | Empty-state guidance and the add-text form are visible. |
| LIB-02 | Create pasted text | Enter language, title, content, optional source URL, and save. | A library card appears with correct metadata and parsed word counts. |
| LIB-03 | Import text file | Select a UTF-8 `.txt` file and save it. | Content loads correctly; the filename suggests a title without overwriting a typed title. |
| LIB-04 | Validation | Try blank required fields, overlong values, invalid URLs, empty content, and content over 65,000 bytes. | Saving is blocked with a clear message and no partial record is created. |
| LIB-05 | Edit text | Change title, language, content, source, tags, and audio. | All changes persist; parsing and progress are recalculated consistently. |
| LIB-06 | Archive lifecycle | Archive a text, switch between active/archived views, restore it, and relaunch. | The text appears only in the correct view and retains its learning data. |
| LIB-07 | Delete text | Delete a text and confirm the prompt; cancel once and confirm once. | Cancel preserves everything; confirmation removes only that text and keeps reusable language data. |
| LIB-08 | Pagination | Create enough texts to exceed the configured page size and navigate all pages. | No duplicates or omissions occur; boundaries disable Previous/Next correctly. |

## Reading, Terms, and Media

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| READ-01 | Parse and open | Open texts containing Unicode, repeated words, separators, and multiple sentence terminators. | Text order and punctuation are preserved; equal normalized terms share progress. |
| READ-02 | Term states | Change a term through Unknown, Learning, Known, and Ignored states. | Styling, accessible label, progress, review eligibility, and relaunch state match each status. |
| READ-03 | Term details | Save translation, romanization, and notes; reopen another occurrence of the same term. | Shared details appear everywhere in the same language and stay isolated from other languages. |
| READ-04 | External lookup | Configure valid dictionary/translation URL templates and click lookup links; also try malformed and non-HTTP templates. | Valid links contain the encoded term; unsafe or malformed links are not offered. |
| READ-05 | Compound expression | Select and save a multiword expression, reopen the text, then edit surrounding content. | The expression reopens at the correct occurrence or produces a safe warning instead of a wrong link. |
| READ-06 | Audio lifecycle | Add supported local audio, play/pause/seek, relaunch, replace it, and remove it. | Playback works without exposing its source path; each mutation persists. |
| READ-07 | Audio validation | Try empty, unsupported, malformed, and over-50-MB files. | The app rejects invalid media without changing previously saved audio. |
| READ-08 | Reading progress | Mark repeated and unique terms known. | Progress counts unique terms accurately and never exceeds the total. |

## Tags, Languages, and Settings

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| CFG-01 | Tag management | Create tags with trimmed names, try duplicates/blank names, and paginate the list. | Valid unique tags persist; invalid or case-insensitive duplicates are rejected clearly. |
| CFG-02 | Assign tags | Assign/unassign multiple tags to texts and terms, then reopen each screen. | Selections persist and affect only the intended entity. |
| CFG-03 | Language rules | Configure substitutions, custom terminators, per-character terms, space removal, and text size. | Valid settings persist and existing texts are reparsed transactionally. |
| CFG-04 | Invalid language rules | Enter malformed substitutions and excessive values. | Update is rejected; the previous language configuration and parsed data remain intact. |
| CFG-05 | RTL language | Enable right-to-left reading and open a matching text. | Direction, ordering, controls, and term interaction remain usable. |
| CFG-06 | App settings | Change library/tag page sizes, visible word-count preference, and review pacing. | Screens immediately honor values and retain them after relaunch. |
| CFG-07 | Settings validation | Enter zero, negative, nonnumeric, and excessive values where possible. | UI/native validation rejects them without partial updates. |

## Review and Statistics

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| REV-01 | Review queue | Save due learning terms, ignored terms, and known terms, then start review. | Only eligible due terms appear, respecting the configured limit. |
| REV-02 | Reveal and rate | Reveal an answer and submit Again, Hard, Good, and Easy on separate cards. | Each rating advances the queue and schedules a sensible next review. |
| REV-03 | Review persistence | Close during a session, reopen, and revisit statistics. | Completed ratings remain recorded and no duplicate history event is created. |
| REV-04 | Empty queue | Complete all due cards and reopen review. | A clear completion/empty state appears without an error. |
| STAT-01 | Statistics accuracy | Capture statistics, change term states, complete reviews, and compare again. | Totals by language, status, due queue, and today's reviews change consistently. |
| STAT-02 | Multi-language isolation | Create equivalent terms in two languages and review only one language. | Per-language totals remain independent while global totals equal their sum. |

## Backup, Restore, and Resilience

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| DATA-01 | Backup export | Populate every supported data type and download a backup. | A nonempty versioned JSON file is produced without raw filesystem or SQL details. |
| DATA-02 | Round-trip restore | Add extra data after backup, restore the backup, confirm the warning, and relaunch. | The snapshot replaces current data completely and preserves texts, settings, tags, terms, reviews, expressions, and media. |
| DATA-03 | Cancel restore | Select a valid backup but cancel confirmation. | The current database remains unchanged. |
| DATA-04 | Invalid restore | Try malformed JSON, wrong format/version, broken relationships, and truncated media. | Restore fails with an actionable message and rolls back all changes. |
| DATA-05 | Legacy import | Restore the supplied legacy fixture and inspect its summary and content. | Supported legacy data is mapped correctly and unsupported data is reported as warnings. |
| DATA-06 | Interrupted write | Force-close during a noncritical mutation and relaunch. | SQLite opens successfully with either the complete prior or complete new transaction—never partial data. |
| DATA-07 | Offline operation | Disconnect networking and repeat library, reading, review, statistics, and backup tasks. | All core functions remain available; only external lookups/update checks are unavailable. |

## Updates, Accessibility, and Release Integrity

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| REL-01 | Signed update | Install the previous release, publish a candidate update, check for it, and relaunch when requested. | Only updater metadata signed by the configured key is accepted and user data survives. |
| REL-02 | Invalid update | Serve modified metadata, signature, or package in a controlled environment. | The updater rejects it and the installed version continues to launch. |
| UI-01 | Keyboard navigation | Complete primary workflows using keyboard only. | Focus is visible and logical; buttons, forms, dialogs, terms, and pagination are operable. |
| UI-02 | Screen sizes and zoom | Test minimum window size and 80–200% zoom. | Content remains readable without inaccessible controls or destructive overlap. |
| UI-03 | Messages and recovery | Trigger validation, storage, and network errors. | Messages identify the failed action, preserve entered data where safe, and explain recovery. |

## Exit Criteria

- All critical and high-priority scenarios pass on the required platform matrix.
- No data loss, security bypass, updater-signature failure, or unrecoverable crash remains open.
- Medium/low defects have an owner and release decision; corrected cases are rerun.
- Installers, checksums, SBOMs, screenshots/logs, and completed results are retained
  with the release record. Remove personal text and backup contents from evidence.
