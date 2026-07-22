# LWT Desktop Migration Plan

## Objective

Turn the official `hapepo23/learning-with-texts` codebase into an installable Windows, macOS, and Linux desktop application. End users must not need to install PHP, Apache, MySQL/MariaDB, XAMPP, MAMP, or Docker. The final application should preserve LWT's core reading and vocabulary workflows and work offline.

## Current-State Assessment

This repository is a procedural PHP application rather than a separately built web client. Root-level PHP files combine request handling, SQL, business rules, and HTML rendering. Shared logic is concentrated in `utilities.inc.php`; JavaScript and CSS are static files under `js/` and `css/`. The schema and upgrades are also embedded in `utilities.inc.php` and use MySQL-specific behavior, including `mysqli`, MyISAM, `AUTO_INCREMENT`, table prefixes, binary collations, `SHOW TABLES`, and session SQL modes.

Unlike the previously evaluated fork, this repository has no REST API, Vite build, TypeScript client, or `dist-app/` output. Pake can wrap a URL or static directory, but it cannot convert these PHP pages or embed MySQL. A simple Pake command would still require a running LAMP stack and would not meet the objective.

The currently visible mandatory PHP extensions are primarily `mysqli` and `mbstring`. PHP `dom`, `zip`, and EPUB support are not part of this repository's core dependency set, so they do not need replacement unless those features are added later.

## Target Architecture

```text
Pake/Tauri desktop shell
    -> static HTML/CSS/TypeScript frontend
    -> typed Tauri command gateway
    -> Rust application services
    -> SQLite database in the platform app-data directory
```

Pake remains the packaging layer, while a maintained Tauri customization supplies local commands, filesystem access, dialogs, logs, and updates. The WebView must not receive unrestricted SQL, shell, or filesystem access. Commands such as `list_texts`, `parse_text`, `save_term`, and `start_review` should enforce validation and business rules in Rust.

The desktop application should be local-first and single-user. Multi-user hosting and remote synchronization are separate products and should not constrain the initial SQLite design.

## Options Considered

### A. Wrap the Existing Website

Point Pake at a hosted or localhost LWT URL. This is useful only as a UI experiment. It does not remove PHP/MySQL and does not provide a standalone offline application. Reject as the product architecture.

### B. Bundle PHP as a Sidecar

Ship a PHP runtime, local HTTP server, required extensions, and either SQLite/PDO or an embedded database. This can produce an earlier compatibility prototype, but every operating system needs its own runtime bundle and security updates. It also preserves the procedural coupling. Use only if an early demonstration is required; set a removal milestone before adopting it.

### C. Replace the Runtime with Rust and SQLite

Extract the UI into static assets and migrate complete workflows behind Tauri commands. This requires more initial work but produces the smallest dependency surface and meets the installation goal. This is the recommended final architecture.

## Technology Replacement Map

| Current component | Target component | Migration approach |
| --- | --- | --- |
| PHP pages and handlers | Rust commands and services | Migrate complete user workflows, not individual files. |
| PHP-rendered HTML | Static HTML + TypeScript | Reuse visual structure and CSS initially; replace inline PHP with client rendering. |
| MySQL/MariaDB | SQLite | Create a new schema and versioned transactional migrations. |
| `mysqli` | `sqlx` or `rusqlite` | Keep persistence behind Rust repositories. |
| `mbstring` | ICU4X/Unicode crates | Test case folding, length, normalization, and segmentation per language. |
| PHP sessions/forms | In-memory UI state + Tauri commands | Local single-user mode does not require server sessions or CSRF tokens. |
| AJAX PHP endpoints | Typed frontend gateway | Return serializable DTOs and structured errors from Tauri. |
| Translate Shell process | Optional Rust adapter or HTTP provider | Never expose arbitrary command execution to the WebView. |
| SQL backup files | Versioned portable export | Use JSON metadata plus media files, with checksums and schema version. |

Old bundled libraries, especially jQuery, jQuery UI, Overlib, and Flash-era jPlayer assets, should be inventoried for known vulnerabilities. They may be retained briefly for visual parity, but the desktop shell must not grant them native capabilities.

## MVP Scope

Include:

- language configuration;
- text creation, editing, parsing, and reading;
- term creation, translation, romanization, status changes, and expressions;
- text and term tags;
- vocabulary testing/review;
- essential statistics and settings;
- import/export and backup/restore;
- local audio files and fully offline startup.

Defer WordPress integration, server installation modes, remote multi-user support, Translate Shell, automatic online translation, and cross-device synchronization. Reintroduce optional network features only after local workflows are stable.

## Migration Phases

### Phase 0 — Baseline and Characterization

- Capture screenshots and manual scripts for every major workflow.
- Create representative fixtures: a demo database, multilingual texts, right-to-left text, CJK character splitting, tags, audio, and review history.
- Inventory every page, AJAX endpoint, table, setting, and SQL query.
- Add automated smoke coverage before changing behavior. Use browser tests against the legacy PHP application and golden files for parsing results.
- Document exact behavior for term status scheduling, sentence splitting, multi-word expressions, and scoring.

**Exit criterion:** repeatable tests can identify behavior changes in the legacy application.

### Phase 1 — Static Desktop Shell

- Introduce a minimal Node/Vite/TypeScript build under `desktop/` without modifying legacy runtime behavior.
- Package the static entry point with a project-local, pinned Pake CLI.
- Add a typed gateway with a mock implementation and a Tauri placeholder implementation.
- Recreate only application navigation and a read-only sample library in the first shell.
- Validate native packaging on all three operating systems in CI.

**Exit criterion:** one command builds a desktop artifact that opens offline and renders fixture data without PHP.

### Phase 2 — SQLite Foundation

- Define a normalized SQLite schema based on the current tables, but remove MyISAM, table prefixes, zero dates, prefix indexes, and MySQL administration queries.
- Enable foreign keys for every connection and define explicit cascade behavior.
- Create ordered, transactional Rust migrations and automatic pre-migration backups.
- Add repositories and round-trip tests for languages, texts, sentences, text items, words, tags, and settings.
- Decide and document Unicode collation behavior before enforcing unique term keys.

**Exit criterion:** the Rust layer creates, upgrades, backs up, and restores populated SQLite databases without the UI.

### Phase 3 — Vertical Workflow Migration

Migrate in this order:

1. settings and language configuration;
2. text CRUD and parsing;
3. reading and word-status interaction;
4. term and expression editing;
5. review/testing and scoring;
6. tags, statistics, media, and imports.

For each workflow, record current behavior, expose Rust commands, connect the TypeScript gateway, compare results with PHP fixtures, and remove the corresponding PHP dependency only after parity is demonstrated.

**Exit criterion:** every MVP workflow operates locally with no PHP process.

### Phase 4 — Data Migration

- Add a versioned JSON export to the legacy application rather than connecting the desktop app directly to MySQL.
- Include language settings, texts, parsed items where necessary, terms, tags, review fields, and media references.
- Validate counts, relationships, timestamps, and content hashes during import.
- Preserve the original export until the user verifies the migrated database.
- Support re-import safely or clearly reject duplicate imports.

**Exit criterion:** representative and real user backups migrate without silent data loss.

### Phase 5 — Hardening and Distribution

- Produce MSI/NSIS, DMG, and AppImage/DEB artifacts in GitHub Actions.
- Sign/notarize releases, publish checksums and an SBOM, and configure signed updates.
- Store databases, backups, logs, and media in platform-specific app-data directories.
- Test upgrades with databases from at least two earlier desktop versions.
- Add crash-safe writes, recovery instructions, and a user-visible backup command.

**Exit criterion:** a nontechnical user installs, uses, backs up, updates, and removes the application without managing services.

## Required Test Strategy

- legacy PHP characterization tests and browser smoke tests;
- Rust unit tests for parsing, scheduling, validation, and repositories;
- contract tests comparing legacy fixture results with Rust results;
- frontend component and gateway tests;
- packaged-app end-to-end tests for first launch, reading, review, and restore;
- Unicode golden tests for combining characters, CJK, RTL scripts, and locale-sensitive case handling;
- migration tests for malformed, large, interrupted, and older exports.

## Security Requirements

- Use a strict Tauri capability allowlist and Content Security Policy.
- Never expose raw SQL, arbitrary shell commands, or unrestricted paths to frontend code.
- Validate all imported paths, archives, HTML, URLs, and media types.
- Keep network access opt-in and protect importers against SSRF and unsafe redirects.
- Back up before every schema migration and sign every application update.
- Keep secrets out of the repository and OS-independent configuration files.

## Completion Criteria

The migration is complete when a user can download one installer, launch LWT without external services, import existing data, complete the core reading and review workflows offline, restart without losing state, export a portable backup, and upgrade without data loss. The distributed application must neither contain nor start PHP, Apache, MySQL, or MariaDB.

## References

- [Pake](https://github.com/tw93/Pake)
- [Tauri SQL plugin](https://v2.tauri.app/plugin/sql/)
- [Tauri sidecars](https://v2.tauri.app/develop/sidecar/)
- [Tauri distribution](https://v2.tauri.app/distribute/)
- [Appropriate Uses for SQLite](https://www.sqlite.org/whentouse.html)
