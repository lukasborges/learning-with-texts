# QA Test Scenarios

Use these scenarios to validate a release candidate end to end. Record the app
version, operating system, installer type, tester, date, result, and defect link
for every run. Execute the complete suite on Windows and one Linux package;
repeat installation, launch, update, and removal on every supported package.
The latest local results are recorded in [QA_EXECUTION_REPORT.md](QA_EXECUTION_REPORT.md).

## Test Matrix and Data

| Platform | Packages |
| --- | --- |
| Windows 10/11 x64 | MSI and NSIS |
| Ubuntu 24.04 x64 | DEB and AppImage |
| Arch Linux x64 | pacman package |

Prepare a UTF-8 `.txt` file, an application backup, the legacy fixture in
`tests/fixtures/legacy-backup-v1.json`, and texts containing accents, CJK,
right-to-left text, punctuation, and repeated terms. Start destructive scenarios
with a verified backup.

## Navigation, Home, and First Use

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| HOME-01 | First language setup | Launch with a new application-data directory, enter a learning language and optional dictionary template, then submit. | The setup fields are visible directly on Home, the language is saved before any text exists, and Add content opens with that language prefilled. |
| HOME-02 | First text invitation | Save a language without adding a text, cancel Add content, and return Home. | Home says no text has been added and offers a direct Add your first text action. |
| HOME-03 | Current reading | Open an unfinished text, return Home, and select Continue reading. | The in-progress text is featured and reopens in the Reader; a completed text is not presented as in progress. |
| HOME-04 | Recent content | Populate at least four active texts with different open/add histories. | Home shows at most three recently studied or added texts and never repeats the featured text. |
| HOME-05 | No current reading | Populate the library without opening a text, then return Home. | Home offers Choose a text and still shows recent additions without inventing a current reading. |
| NAV-01 | Headerbar navigation | Move among Home, Library, Vocabulary, and Review using the headerbar view switcher and keyboard; open Settings from the primary menu or preferences button. | The selected destination opens, has exactly one current-page state, preserves data, and does not duplicate Home and Library content. |
| NAV-02 | Responsive shell | Exercise the shell below 900 px, at minimum window width, and at 200% zoom. | The headerbar view switcher becomes bottom navigation, every frequent destination remains reachable, focus stays visible, and content is not covered. |
| NAV-03 | Primary menu coverage | Open the hamburger menu and activate Tags, Statistics, Backup and Restore, and Preferences in turn. | Each command opens the intended workspace; the menu closes after activation and contains no command already exposed in the headerbar or current workspace. |
| NAV-04 | Light libadwaita visual language | Launch while the operating system prefers both light and dark color schemes. | The application remains in its intentional light theme, uses a 54 px headerbar, inline official Adwaita icons, GNOME-like raised controls and blue accent, and all text and focus indicators retain sufficient contrast. |
| NAV-05 | Approved prototype fidelity | Compare Home, Library, Reader, Vocabulary, Review, and first-language setup with the approved prototype at 1280×800 and at a narrow width. | Content hierarchy, covers, cards, progress, table density, reader typography, contextual panel, empty states, spacing, and responsive reflow match the prototype without introducing inactive controls. |

## Installation and Lifecycle

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| INS-01 | Verify download | Validate the release-wide SHA-256 manifest before installation. | Every downloaded file passes; altered or missing files fail verification. |
| INS-02 | Clean install | Install with the native package manager and launch from the application menu. | Installation succeeds, one app entry is created, and the empty library opens without a server or terminal. |
| INS-03 | Windows warning | Start each Windows installer and continue through the unknown-publisher warning. | The warning matches release documentation and the installer remains usable. |
| INS-04 | Relaunch persistence | Create data, close the window, end the process, and reopen the app. | Texts, settings, tags, terms, and reviews persist. |
| INS-05 | Upgrade | Install the next candidate over a populated previous version. | Schema upgrade succeeds once, all data remains available, and normal work continues. |
| INS-06 | Uninstall/reinstall | Uninstall normally, record whether user data remains, then reinstall. | No broken shortcuts or binaries remain; retained-data behavior matches release notes and reinstall launches successfully. |

## Library and Text Management

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| LIB-01 | Empty library | Complete first-language setup with no texts and cancel Add content. | Library is a separate screen with empty-state guidance and an Add content action; the full form is not permanently displayed. |
| LIB-02 | Create pasted text | Enter language, title, content, optional source URL, and save. | A library card appears with correct metadata and parsed word counts. |
| LIB-03 | Import text file | Select a UTF-8 `.txt` file and save it. | Content loads correctly; the filename suggests a title without overwriting a typed title. |
| LIB-04 | Validation | Try blank required fields, overlong values, invalid URLs, empty content, and content over 65,000 bytes. | Saving is blocked with a clear message and no partial record is created. |
| LIB-05 | Edit text | Change title, language, content, source, and tags. | All changes persist; parsing and progress are recalculated consistently. |
| LIB-06 | Archive lifecycle | Archive a text, switch between active/archived views, restore it, and relaunch. | The text appears only in the correct view and retains its learning data. |
| LIB-07 | Delete text | Delete a text and confirm the prompt; cancel once and confirm once. | Cancel preserves everything; confirmation removes only that text and keeps reusable language data. |
| LIB-08 | Pagination | Create enough texts to exceed the configured page size and navigate all pages. | No duplicates or omissions occur; boundaries disable Previous/Next correctly. |

## Reading, Terms, and Media

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| READ-01 | Parse and open | Open texts containing Unicode, repeated words, separators, and multiple sentence terminators. | Text order and punctuation are preserved; equal normalized terms share progress. |
| READ-02 | Term states | Change a term through Unknown, Learning, Known, and Ignored states. | Styling, accessible label, progress, review eligibility, and relaunch state match each status. |
| READ-03 | Term details | Save translation, romanization, and tags; reopen another occurrence of the same term. | Shared details appear everywhere in the same language and stay isolated from other languages. |
| READ-04 | External lookup | Configure valid dictionary/translation URL templates and click lookup links; also try malformed and non-HTTP templates. | Valid links contain the encoded term; unsafe or malformed links are not offered. |
| READ-05 | Compound expression | Select and save a multiword expression, reopen the text, then edit surrounding content. | The expression reopens at the correct occurrence or produces a safe warning instead of a wrong link. |
| READ-06 | No local-audio interface | Inspect Add text, Edit text, and Reader, including after restoring a backup that contains legacy media. | No audio upload, removal, or playback control is exposed; reading and text editing remain complete. |
| READ-07 | Preserve legacy media safely | Restore and export a migrated backup containing media, without editing that media in the UI. | Legacy media survives the backup round trip for data safety but remains absent from the study interface. |
| READ-08 | Reading progress | Mark repeated and unique terms known. | Progress counts unique terms accurately and never exceeds the total. |
| READ-09 | One-click finish | Set one term to Learning 2, leave other terms unclicked, and select Finish lesson once. | No confirmation dialog opens; each unclicked unique term becomes Well Known (99), the Learning 2 term and its details remain unchanged, completion is persisted, and progress is correct. |
| READ-10 | Undo finish | Immediately select Undo after READ-09, then try Undo a second time through the data boundary. | Only terms created by that completion return to Unknown, the previous completion state is restored, user-edited terms remain intact, and a second undo is rejected safely. |
| READ-11 | Contextual term panel | Select different words, including repeated words and an expression, while reading. | The term editor stays beside the text on wide screens, moves into the document flow on narrow screens, and always shows the selected term without losing reading position. |

## Vocabulary Screen

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| VOC-01 | Vocabulary inventory | Open Vocabulary after saving Learning, Known, Well Known, and Ignored terms in multiple languages. | Every saved term appears once with language, exact status, translation, and review metadata; unclicked/Unknown words do not appear. |
| VOC-02 | Search and filters | Search by term/translation and combine language and status filters. | Results update predictably, filter state is clear, and a helpful empty result appears when nothing matches. |
| VOC-03 | Edit from inventory | Change a term’s exact Learning 1–4 status, translation, and romanization, then reopen its source text. | Changes persist and every occurrence in the same language reflects the update. |
| VOC-04 | Large inventory | Load enough terms to exceed one page and navigate or virtual-scroll the list at 200% zoom. | No terms are duplicated or skipped and controls stay keyboard accessible. |

## Tags, Languages, and Settings

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| CFG-01 | Tag management | Open Add content before any tag exists, inspect the tag information pop-up, then create tags with trimmed names, try duplicates/blank names, and paginate the list. | The empty selector stays compact and opens a clear optional-tags dialog; valid unique tags persist and invalid or case-insensitive duplicates are rejected clearly. |
| CFG-02 | Assign tags | Assign/unassign multiple tags to texts and terms, then reopen each screen. | Selections persist and affect only the intended entity. |
| CFG-03 | Language rules | Select one language, then configure substitutions, custom terminators, per-character terms, space removal, and text size. | Only the selected language form is shown; valid settings persist and existing texts are reparsed transactionally. |
| CFG-04 | Invalid language rules | Enter malformed substitutions and excessive values. | Update is rejected; the previous language configuration and parsed data remain intact. |
| CFG-05 | RTL language | Enable right-to-left reading and open a matching text. | Direction, ordering, controls, and term interaction remain usable. |
| CFG-06 | App settings | Change library/tag page sizes, visible word-count preference, and review pacing in seconds. | Screens immediately honor values, store pacing accurately in milliseconds at the data boundary, and retain them after relaunch. |
| CFG-07 | Settings validation | Enter zero, negative, nonnumeric, and excessive values where possible. | UI/native validation rejects them without partial updates. |
| CFG-08 | Add a learning language | Open Language settings, choose **Add language**, enter a unique name and optional primary dictionary, then save. | The dialog closes, the new language is selected for configuration, and it remains available independently of text creation. |
| CFG-09 | Combobox consistency | Open language, status, filter, and sorting comboboxes across first use, Library, Reader, Vocabulary, and Language settings; navigate with pointer, arrows, Home/End, Enter, and Escape. | Every control uses the same light popover, selected indicator, focus treatment, layering, and keyboard behavior; no native dark menu appears. |

## Review and Statistics

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| REV-01 | Review queue | Save due learning terms, ignored terms, and known terms, then start review. | Only eligible due terms appear, respecting the configured limit. |
| REV-02 | Context, reveal, and rate | Confirm the source sentence, reveal with Space, then submit Again, Hard, Good, and Easy using buttons and keys 1–4. | The current term is highlighted in context; every rating shows its interval, advances the queue, and schedules the stated next review. |
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
| UI-04 | Custom titlebar | On Wayland and X11, drag the window from empty headerbar space and the application title; double-click the drag region; use minimize, maximize/restore, and close; resize from every edge. | Drag and resize follow the compositor, double-click and the middle control toggle maximization, minimize and close work once per activation, interactive headerbar controls never start a drag, and the maximized icon/label changes to Restore. |

## Exit Criteria

- All critical and high-priority scenarios pass on the required platform matrix.
- No data loss, security bypass, updater-signature failure, or unrecoverable crash remains open.
- Medium/low defects have an owner and release decision; corrected cases are rerun.
- Installers, checksums, SBOMs, screenshots/logs, and completed results are retained
  with the release record. Remove personal text and backup contents from evidence.
