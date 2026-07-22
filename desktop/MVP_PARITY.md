# Desktop MVP Parity

This matrix is the removal gate for the PHP/MySQL runtime. “Parity” means the
user goal is available in the maintained desktop UI and persists through typed
Tauri commands and SQLite; it does not require reproducing the legacy frameset.

| User workflow | Desktop implementation | Automated evidence |
| --- | --- | --- |
| First launch and local library | App-data SQLite with transactional schema migrations | Rust schema tests; packaged E2E first launch |
| Create, edit, archive, restore, delete, and paginate texts | Library and editor screens | Gateway tests; Rust CRUD/archive tests; packaged E2E |
| Read parsed text and update term state | Unicode parser and reading screen | Parser/database tests; packaged E2E |
| Save translations, romanization, dictionary links, and compound expressions | Term editor and language settings | Rust detail/expression/upgrade tests |
| Create and assign text/term tags | Tags screen and selectors | Rust tag/migration tests |
| Attach and play local audio | Transactional embedded media storage | Rust media/backup/upgrade tests |
| Review due terms and inspect progress | Deterministic scheduler, review, and statistics screens | Scheduler/statistics tests; packaged E2E |
| Configure language parsing and application preferences | Language and application settings screens | Settings validation, reparse, migration, and backup tests |
| Export, restore, and migrate existing data | Versioned JSON backup and legacy importer | Full round-trip and legacy fixture tests; packaged E2E restore |
| Upgrade an existing desktop installation | Ordered, rollback-safe SQLite migrations | Schema versions 1, 3, 6, 8, and 9 upgrade tests |

The desktop executables use no PHP, MySQL/MariaDB, Apache, shell, or database
sidecar. The WebView has no raw SQL, shell, or unrestricted filesystem
capability. Network activity is limited to user-selected HTTP(S) dictionary or
source links and the HTTPS signed-update endpoint in production builds. The
`runtime-boundary` test rejects reintroduction of PHP routes, server commands,
external binaries, or a MySQL driver into executable desktop code.

Intentionally retired behavior is recorded in [SETTINGS_PARITY.md](SETTINGS_PARITY.md):
the legacy frameset dimensions/mobile mode have responsive replacements, and
obsolete term-table-only display controls are not part of an active desktop
workflow. The diagnostic legacy score shown in Statistics does not invoke the
old runtime; it is a local Rust calculation used only for migration comparison.
