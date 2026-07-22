# SQLite Schema Upgrade Coverage

Desktop migrations are ordered, transactional, and recorded with SQLite's
`user_version`. Startup applies only versions newer than the database and does
not advance `user_version` when a migration fails.

| Version | Data introduced | Upgrade evidence |
| --- | --- | --- |
| 1 | Languages and texts | Populated text upgrades and is parsed. |
| 2 | Sentences and ordered items | Version 1 backfill verifies sentence and term counts. |
| 3 | Saved term status | Existing status survives later column additions. |
| 4 | Translation and romanization | Empty defaults and saved details are verified. |
| 5 | Compound terms and occurrences | Positions and word counts survive. |
| 6 | Review schedule and events | Counts, dates, ratings, and expressions survive. |
| 7 | Shared tags and assignments | Text and term relationships survive. |
| 8 | Archived texts | Existing archive state survives. |
| 9 | Embedded audio | File metadata and exact bytes survive. |
| 10 | Application settings | Older databases receive one validated default row. |

Tests build representative in-memory databases at versions 1, 3, 6, 8, and 9,
then run the production migration path through version 10. A conflicting version
9 fixture deliberately fails migration 10 and verifies that its schema version,
texts, and media remain unchanged. Portable backup compatibility is tested
separately because it is a data contract rather than an SQLite schema upgrade.
