# Migrating from Legacy PHP LWT

The PHP/MySQL application is frozen as a migration-only release at
`legacy-php-migration-v25.10.0`. It receives no new features and should be run
only on a trusted local machine long enough to export existing data. The
maintained desktop application never connects directly to MySQL.

## Export the Existing Library

1. Make a normal SQL backup and keep it unchanged until the desktop library has
   been verified.
2. Check out `legacy-php-migration-v25.10.0` (or the
   `legacy-php-maintenance` branch) in the existing local PHP installation. It
   requires PHP 8.2 or newer with `mysqli` and `mbstring`, plus the existing
   MySQL/MariaDB database and `connect.inc.php` configuration.
3. Sign in locally, open **Backup/Restore/Empty Database**, and select
   **Download Desktop Migration JSON**. The read-only endpoint is also available
   as `export_desktop_backup.php` after normal LWT authentication/setup.
4. Store the resulting `lwt-desktop-migration-*.json` beside the SQL backup. Do
   not edit the JSON.

The stable export contract is `format: "lwt-desktop-backup"`, `version: 1`.
It includes languages and parsing preferences, active and archived texts,
terms, statuses, translations, romanization, tags and assignments, compound
occurrences, selected application settings, source references, and supported
local audio. The exporter never changes the MySQL data.

Remote audio is retained only as a reference. Missing, unsupported, external,
or oversized local media produces a warning. Legacy review-event history does
not exist and cannot be reconstructed; imported learning terms are initially
due. Regular-expression parser fields are retained for reference, while the
desktop parser uses Unicode rules. Read every warning after restore.

## Restore and Verify

1. Install and open LWT Desktop, then choose **Backup**.
2. Select the migration JSON and confirm the replacement of the current local
   desktop library.
3. Compare language, active/archived text, term, tag, and media counts. Open
   representative texts, compound expressions, dictionary links, and audio.
4. Export a new desktop backup, close and reopen the application, and verify the
   restored data again.
5. Keep both the original SQL backup and migration JSON until routine desktop
   use and a desktop backup restore have succeeded.

If export fails, preserve the database and inspect the PHP error log; never
empty or upgrade the database as a troubleshooting step. A JSON restore failure
is transactional and leaves the previous desktop library intact. Report the
exact warning/error and the legacy tag, PHP version, database version, and table
prefix without attaching private study data publicly.
