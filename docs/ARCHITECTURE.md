# Architecture

LWT is a single Rust application with a TypeScript WebView. The repository root
is the Cargo and Tauri project root, so standard commands such as `cargo test`
and `npm run build` work without changing directories or locating a nested
native crate.

## Native Runtime

- `src/main.rs` starts the application.
- `src/lib.rs` declares the crate's modules and exposes the runtime entry point.
- `src/commands.rs` is the Tauri boundary. Commands translate typed WebView
  requests into database operations and expose errors as user-facing strings.
- `src/models.rs` contains the serializable request and response contracts used
  across the command and persistence boundaries.
- `src/database.rs` owns SQLite transactions and domain persistence.
- `src/parser.rs` performs deterministic Unicode-aware text parsing.
- `src/schema.rs` owns the ordered migration inventory; SQL lives in
  `migrations/`.

SQLite is opened in the platform application-data directory as `lwt.sqlite3`.
Migrations are ordered, transactional, and covered by upgrade and rollback
tests. Audio is copied into application-managed storage rather than exposing
arbitrary paths to the WebView.

## Web Interface

The `web/src/domain/` contracts describe application data independently of the
transport. `LibraryGateway` is the interface between screens and persistence:
`TauriLibraryGateway` invokes native commands, while `MockLibraryGateway`
supports isolated browser development and tests. Reusable DOM, media, and term
status behavior lives under `web/src/ui/`; screen orchestration remains in
`web/src/main.ts`.

The native boundary allows only explicit operations for texts, languages,
terms, tags, reviews, settings, media, statistics, and backups. It provides no
raw SQL, shell command, PHP sidecar, MySQL connection, or unrestricted
filesystem API.

## Quality Boundaries

`npm run check` validates TypeScript and Rust formatting/types. `npm test` runs
web unit tests, Rust database/parser tests, and release-script tests. The Linux
E2E suite builds a real DEB and drives the packaged WebView with isolated
application data. See [QA Test Scenarios](QA_TEST_SCENARIOS.md) for manual
cross-platform coverage and [Schema Migrations](SCHEMA_MIGRATIONS.md) for the
database compatibility contract.
