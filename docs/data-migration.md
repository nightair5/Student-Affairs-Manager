# Workspace schema migration

## Current schema

The development runtime now persists Workspace schema v8 as the canonical IndexedDB record. SourceVersion, RecognitionRun, ExtractionDraft, Project hierarchy, Task/Subtask, Material, TimePoint, Event, Evidence, History and Reminder are independent entities; UI compatibility projections are not persisted as replacements for these arrays.

## Migration

Schemas v3-v6 are first normalized through the v7 compatibility contract; v7 is then upgraded to v8. Existing confirmed tasks and projects retain their IDs and content. Old structures that cannot be classified confidently are preserved in `legacyData` and recorded as `needs_review`; migration never invents parent relationships.

Before v7→v8 replacement, the repository stores the untouched v7 record under a separate `backup:*` key with an integrity hash. It then migrates in memory, validates the complete domain graph and verifies an export/import round-trip. If any step fails, loading reports recovery required and leaves the current v7 record untouched.

## Backup and rollback

The Privacy & Data page can download the latest pre-migration JSON. The canonical repository can restore the exact v7 snapshot by backup ID after rechecking its hash. Before rollback, export the current v8 workspace; a later v8 load will intentionally offer migration again rather than silently running v7 in place.

Current v8 JSON imports validate required arrays, time semantics, unique IDs, references, hierarchy depth and dependency cycles. v7 imports use the protected migration path; unsupported or unsafe input is rejected. Unrecognized legacy content is retained rather than discarded.

## Product v2 Workspace v8 preparation

E1 Phase A adds a pure, offline v7→v8 preparation contract under `src/domain/v2`. It creates an independent v7 backup before constructing a candidate, preserves uncertain values in `legacyData`, represents unknown deadlines as `null` plus `needsReview`, validates the complete graph, and refuses apply when validation fails. A rollback helper returns a cloned original v7 snapshot.

E1 Phase B now wires this preparation into a schema-aware local repository, but it is not deployed to Production in this phase. The repository stores an immutable raw v7 backup with an integrity hash, validates the in-memory v8 graph and a JSON round-trip, and only then replaces the local `current` record in an IndexedDB transaction. Any failure leaves v7 untouched and reports a recovery state. A backup ID can restore the exact original v7 snapshot; the rehearsal uses an anonymized serialized v7 workspace copy and never touches Production data.
