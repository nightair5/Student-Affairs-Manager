# Workspace schema migration

## Current schema

IndexedDB workspace schema v7 adds work packages, events, migration logs, recognition feedback and RecognitionResult metadata while preserving sources, drafts, projects, tasks, time points, materials, evidence, history and reminders.

## Migration

Schemas v3-v6 are normalized into v7. Existing confirmed tasks and projects retain their IDs and content. Old milestone structures that cannot be classified confidently are preserved in `legacyData` and recorded as `needs_review`; the migration does not invent parent relationships.

Before the first in-browser migration, the repository stores the untouched old record under a separate `migration-backup-*` key in the same IndexedDB database. If this backup cannot be written, loading fails instead of continuing with an unprotected migration. The current record is not deleted during normalization.

## Backup and rollback

The Privacy & Data page can download the latest pre-migration JSON. To roll back data, first export the current v7 workspace, deploy a compatible earlier application build, then import/restore the pre-migration JSON with that version's supported procedure. A v7 application will intentionally migrate an old backup forward again; it cannot run an old schema in place.

Current v7 JSON imports are strict: required arrays, enums, dates, unique IDs, references and dependency cycles are validated. Older supported backups use the migration path; unsupported or unsafe input is rejected. Unrecognized legacy content is retained rather than discarded.

## Product v2 Workspace v8 preparation

E1 Phase A adds a pure, offline v7→v8 preparation contract under `src/domain/v2`. It creates an independent v7 backup before constructing a candidate, preserves uncertain values in `legacyData`, represents unknown deadlines as `null` plus `needsReview`, validates the complete graph, and refuses apply when validation fails. A rollback helper returns a cloned original v7 snapshot.

This preparation is deliberately **not wired into IndexedDB or the production load path**. The running application remains schema v7. Phase B must add repository stores, an actual pre-migration backup transaction, recovery rehearsal, atomic canonical commit and production fixtures before any user workspace is upgraded. See `product-v2-e1-phase-a.md` for the canonical matrix and field-by-field mapping.
