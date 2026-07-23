# QA Execution Report

## UX Regression Run — 2026-07-23

- **Application:** LWT Desktop 0.1.0
- **Host:** local Arch Linux x86_64
- **Runtime:** debug DEB/Tauri binary with isolated application data
- **Commands:** `npm run check`, `npm test`, `npm run build:web:tauri`,
  `npm run test:e2e:build`, `npm run test:e2e:smoke`, `npm run test:qa`,
  and `git diff --check`

| Status | Scenarios | Result |
| --- | --- | --- |
| [x] Pass | HOME-01, HOME-03, HOME-04 | Inline first-language setup persisted before text creation; the add form inherited the language; after opening a text, Home featured it and did not repeat it in Recent. |
| [x] Pass | NAV-01, NAV-03–05 | Home, Library, Reader, Vocabulary, Review, and administrative destinations opened separately in the packaged WebView; the light Adwaita shell, deduplicated menu, and approved prototype hierarchy remained consistent in side-by-side captures. |
| [x] Pass | LIB-01–08 | The Library empty state, contextual Add content form, import/edit/archive/delete, pagination, and persistence passed. |
| [x] Pass | READ-01–11 | Reader parsing, exact Learning statuses, contextual editor, one-click Finish lesson, Well Known conversion, learning-term preservation, persisted completion, and single-use Undo passed. |
| [x] Pass | VOC-01, VOC-03 | The global inventory showed exact statuses, recent sentence context and source; the editor persisted status, translation, and romanization through the native boundary. |
| [x] Pass | REV-01–04, STAT-01 | Source context, Space/1–4 shortcuts, displayed intervals, all four ratings, empty completion state, actionable statistics, and persistence passed. |
| [x] Pass | CFG-01–09, DATA-01–05 | Adding and editing languages, consistent custom comboboxes, language rules, RTL, human-readable review pacing, tags, backup, rollback, and legacy restore remained green. |
| [x] Pass | READ-06–07 | Add/Edit/Reader expose no local-audio controls; native backup compatibility tests continue to preserve legacy media without surfacing it in the study UI. |
| [ ] Not run | HOME-02, HOME-05, NAV-02 | These visual variants are documented for manual/exploratory coverage; the underlying empty/current branches compile and first-use/current states have automated coverage. |
| [ ] Partial | VOC-02, VOC-04 | Search/language/status filtering is implemented and exercised; a very large multi-page inventory at 200% zoom remains exploratory. |

Automated totals for this run: 43 web tests, 43 Rust tests, 18 release-script
tests, one packaged smoke workflow, and one full packaged QA workflow. All
executed tests passed.

## Test Run

> Historical run from 2026-07-22. Its audio checks predate the later product
> decision to remove local-audio controls from the interface; legacy media
> remains covered only for migration and backup compatibility.

- **Date:** 2026-07-22
- **Application:** LWT Desktop 0.1.0
- **Host:** Arch Linux x86_64, kernel 7.1.4
- **Runtime:** packaged Tauri application with isolated SQLite data, home, cache,
  configuration, and downloads directories
- **Commands:** `npm run check`, `cargo clippy --all-targets -- -D warnings`,
  `npm test`, `npm run test:e2e:run`, and `npm run package:arch`

`[x]` means the complete scenario passed. Unchecked scenarios are not approved;
their limitation is stated explicitly.

## Installation and Library

| Status | ID | Result |
| --- | --- | --- |
| [ ] Partial | INS-01 | Local Arch/DEB SHA-256 values were generated; a release-wide downloaded manifest was not tested. |
| [ ] Partial | INS-02 | Extracted Arch and DEB applications launched successfully; native package-manager installation and menu integration were not exercised locally. |
| [ ] Not run | INS-03 | Requires Windows 10/11. |
| [x] Pass | INS-04 | Texts, settings, tags, terms, reviews, and audio survived a real application restart. |
| [ ] Partial | INS-05 | Schema upgrades and rollback pass unit tests; installing a newer packaged version over an older one remains outstanding. |
| [ ] Not run | INS-06 | Native uninstall/reinstall requires a disposable machine or VM. |
| [x] Pass | LIB-01–03 | Empty state, pasted text creation, and UTF-8 `.txt` import passed. |
| [x] Pass | LIB-04 | Required fields, URL validation, length limits, and rollback passed UI/unit tests. |
| [x] Pass | LIB-05–08 | Edit/reparse, archive/restore, delete cancel/confirm, and pagination passed. |

## Reading, Configuration, and Review

| Status | ID | Result |
| --- | --- | --- |
| [x] Pass | READ-01–04 | Unicode parsing, repeated terms, all term states, shared details, tags, and safe lookup links passed. |
| [ ] Partial | READ-05 | Expression creation/reopening passes; editing surrounding text with every invalidated-position case needs exploratory testing. |
| [ ] Partial | READ-06 | Add, persist, replace, remove, and restore audio passed; play/pause/seek needs human audio-output testing. |
| [x] Pass | READ-07–08 | Empty, oversized, unsupported, and malformed audio rejection plus unique-term progress passed. |
| [x] Pass | CFG-01 | Tag validation, case-insensitive duplicate handling, counts, and pagination passed. |
| [ ] Partial | CFG-02 | Text/term assignment and term-tag reset passed; multi-tag unassignment needs exploratory testing. |
| [x] Pass | CFG-03–07 | Parsing rules, transactional rejection, RTL, application settings, constraints, and persistence passed. |
| [x] Pass | REV-01–02 | Eligible queue filtering and Again/Hard/Good/Easy ratings passed. |
| [ ] Partial | REV-03 | Review history persisted after restart; force-closing during an active card remains outstanding. |
| [x] Pass | REV-04 | Completed and empty review states passed. |
| [x] Pass | STAT-01 | Totals, reviews, and accuracy matched the performed actions. |
| [ ] Partial | STAT-02 | Database isolation is covered; a full two-language UI review session remains outstanding. |

## Data, Release, and Accessibility

| Status | ID | Result |
| --- | --- | --- |
| [x] Pass | DATA-01–05 | Export, cancel, round-trip restore, malformed rollback, and legacy import passed. |
| [ ] Partial | DATA-06 | SQLite transaction/migration rollback passes; killing the process during each mutation remains outstanding. |
| [ ] Partial | DATA-07 | Core flows use local SQLite, but network disconnection was not forced at the OS level. |
| [ ] Not run | REL-01–02 | Requires a protected signed release channel and controlled update server. |
| [ ] Partial | UI-01 | Focus order, labels, controls, and keyboard entry were inspected; every workflow was not repeated keyboard-only. |
| [ ] Partial | UI-02 | The application remained operable at 200% zoom; the full size/zoom matrix needs human visual review. |
| [ ] Partial | UI-03 | Validation and restore failures were checked; forced disk and network failures remain outstanding. |

## Defects Corrected During QA

1. Duplicate tags exposed an internal SQLite constraint message. They now return
   `A tag with this name already exists.`
2. WebKit reported valid WAV files as `application/octet-stream`. Supported file
   extensions now provide a safe MIME fallback.
3. Audio with a supported extension but mismatched content was accepted. Native
   validation now checks the declared format signature before persistence.

## Observation

The Arch host's GStreamer plugin scanner emitted range warnings while the WAV
element initialized. The WebView remained responsive and all media persistence
checks passed. Actual speaker output remains covered by the unchecked portion
of READ-06.

No executed scenario remains failed. The unchecked rows must stay open until
their stated platform, human, or fault-injection test is completed.
