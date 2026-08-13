# E2.9-R5 Protocol 3.3.0 — Local Harness Readiness Report

Date: 2026-08-13
Branch: `codex/e2-9-r5-harness-preflight`
Starting commit: `e6bb4fe`
Status: `PROTOCOL 3.3.0 MANIFESTS FROZEN — PREVIEW NOT ACTIVATED`

## Scope and conclusion

The R5 local Harness scaffold is implemented and passes local engineering checks. This is not a model-quality result, a Preview activation, or permission to run Readiness, Smoke, Screening, Selection, or Blind.

No DeepSeek request was made. No Cloudflare deployment was performed. Production and the normal Preview configuration keep the R5 endpoint disabled.

## Implemented controls

1. A fresh Protocol `3.3.0` namespace, run ID, run label, phase labels, observation IDs, cache path, Worker route, Durable Object ledger, and Preview configuration are defined for R5.
2. `pure_information` is preserved through manifest, runner, Worker normalizer, validation, checkpoint, and path-masked packet projection. A `requiresAction=false` result with zero business entities is accepted only for that role.
3. `requestedModel`, `returnedModel`, `executionModel`, and `result.modelName` are server-authoritative and must all equal the frozen arm model.
   Missing upstream model identity is classified as `MODEL_IDENTITY_UNVERIFIABLE`; a present but different model is classified as `MODEL_FALLBACK_DETECTED`. Neither is retried or scorable.
4. Failed observations are immutable. A duplicate reservation cannot rerun or overwrite a failure. Only one evidence-qualified truncated-JSON retry is allowed under the same observation ID. The Ledger preregisters and rechecks case ID, semantic role, source hash, input hash, phase-manifest hash, paired-arm cardinality, and final model lineage.
5. Checkpoint completion requires every planned observation to have a complete status; any integrity failure yields `INTEGRITY_FAILURE`.
6. The machine-enforced stage chain is:

   `READINESS_OPEN -> SMOKE_OPEN -> SCREENING_OPEN -> PATH_MASK_PREVIEW_OPEN -> ADJUDICATION_OPEN -> SCORING_OPEN -> COMPLETE`

   Selection and Blind remain explicitly unauthorized.
7. Manifest generation refuses a dirty worktree before reading the implementation commit, creating Vite, or writing any frozen artifact.
8. The protocol bundle covers the Worker route and tests, the frozen provider adapter, complete R2-R5 benchmark/transport/ledger deployment chain, Wrangler configs, package lock, Secret scanner, R5 runner, scorer, packet/reveal/gate entrypoints, activation verifier, and protocol schemas.
9. The scorer revalidates the run manifest, source/phase/bundle manifests, ordered deployment activation chain, complete checkpoint, immutable Ledger, protocol attempts, four-way model lineage, Prompt/Schema/Pipeline versions, output hashes, formal packet, labels, reveal key, assignment commitments, review chronology, and exact screening checkpoint before expected fixtures are loaded.
   Unified fail-closed assertions emit `SCORING_NOT_ALLOWED`, `SCORING_INPUT_DRIFT`, or `ARTIFACT_BINDING_MISMATCH` for incomplete runs, frozen-input drift, or cross-run artifacts.
10. The normal Preview config sets `E2_R5_BENCHMARK_ENABLED=false`. The isolated R5 activation config sets only R5 true and exposes only the R5 ledger binding. Production has no R5 flag or ledger binding.
11. Packet preview generation repeats bundle, deployment, checkpoint, Ledger, and per-observation binding checks. Formal packet creation requires a schema-bound fresh read-only leak review completed after preview creation. Labels require a separate strict schema, including paired X/Y Major Correction and Planning Error judgments, and must be frozen after adjudication opens but before the mapping key is created.

## Verification evidence

- `npm ci`: PASS; 242 packages audited, 0 vulnerabilities.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `TZ=UTC npm run test`: PASS.
- `TZ=Asia/Shanghai npm run test`: PASS.
  - Vitest: 50 files, 213 tests.
  - Node protocol/data tests: 87 tests.
  - Server tests: 8 tests.
  - Worker tests: 81 tests.
  - Firebase Functions tests: 5 tests.
- Focused R5 protocol/Worker/path-masking tests: 52 tests, all PASS.
- `npm run build`: PASS; 1,679 modules transformed.
- `npm run security:scan`: PASS across 553 source/build files.
- `npm audit --audit-level=high`: PASS; 0 vulnerabilities.
- `npm run cloudflare:check`: PASS, including R5 ledger, isolated R5 Preview, normal Preview, and Production dry-runs.
- R4-to-R5 core module normalization audit: benchmark, ledger, transport policy, hashing, path masking, and entrypoint preflight are byte-equivalent after version/name rewriting, apart from final newline normalization.
- Dirty-worktree freeze probe: correctly rejected with `PROTOCOL_FREEZE_REQUIRES_CLEAN_WORKTREE`.

## Current boundaries

- Protocol 3.3.0 manifests were frozen from clean implementation commit `2c91384515ac559fc943628b22179d8b3884c003`.
- Frozen run-manifest SHA-256: `590373a478a266df0440c9005b58718686d8dc3c47ad677d24e66ced82a5a8ab`.
- Frozen protocol/deployment bundle SHA-256: `d6b4729b4a80582363cd112d2143d24a347d96dc635e8dca7ac4400b2b7c0b1b`.
- Independent local recomputation passed every manifest, bundle, cardinality, pairing, semantic-role, retry-policy, and Selection-stop check.
- No Preview activation record exists.
- No Cloudflare Secret was created or changed.
- No Readiness, Smoke, or Screening observation exists for R5.
- No expected answer was read during generation because generation has not started.
- No packet, labels, mapping key, score, Selection set, Candidate Freeze, or Blind set was created.
- Model quality remains `NOT_AVAILABLE`.

## Next gated actions

1. Commit and push the frozen public manifests and updated readiness report; keep the source-only input manifest in Git-ignored cache.
2. Re-run local checks against the committed frozen bundle.
3. Only after explicit model-run authorization: deploy the isolated R5 Preview and ledger, configure a fresh temporary `E2_R5_BENCHMARK_TOKEN` Secret, create and verify the activation record, and run Readiness.
4. Smoke may run only after Readiness passes; Screening may run only after Smoke passes. Stop after the Screening report. Selection and Blind remain unauthorized.
