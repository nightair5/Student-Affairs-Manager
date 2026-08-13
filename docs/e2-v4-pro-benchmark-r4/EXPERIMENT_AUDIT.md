# E2.9-R4 Fresh Experiment Integrity Audit

**Date:** 2026-08-13

**Auditor:** fresh Codex same-family reviewer, read-only, provisional

**Scope:** Protocol 3.2.0 generation, path-masking handoff, scoring preconditions, deployment chain, and cleanup

**Overall verdict:** **FAIL**
**Model quality conclusion:** **NOT AVAILABLE**

The generation evidence is internally consistent: the frozen manifests and bundles re-hash, all 32 preregistered observations exist exactly once, all 32 ledger records have one attempt, four-way model lineage is exact, and output/result hashes match. The experiment nevertheless fails integrity because the frozen packet-preview entry point cannot load. No masked packet, independent path-identification review, labels, mapping key, expected-answer scoring, or quality gate exists. Therefore no Flash-versus-Pro quality conclusion is valid.

## Independent recomputation

| Check | Status | Evidence |
|---|---|---|
| R3 freeze provenance | PASS | Local and remote tag `v2-e2-9-r3-path-mask-blocked` resolve to `73b507e48df999d0a83026c9fc9b623782c769a2`; the R4 branch has that commit as merge-base. |
| Fresh R4 identity | PASS | R4 run ID, run label, all phase labels, and all 32 observation IDs are disjoint from R3 (`run-manifest.json:3-16`). |
| Frozen-file boundary | PASS | Prompt, schema, types, and Golden/Holdout/Development dataset files have no diff from the R3 tag. |
| Hash bindings | PASS | The run self-hash, five bundle hashes and entries, source-only hash, and Readiness/Smoke/Screening manifest hashes were independently recomputed (`bundle-hash-manifest.json:9-258`; `run-manifest.json:87-99`). |
| Generation ledger | PASS | 6 Readiness + 10 Smoke + 16 Screening = 32 unique observations; 32 final records; 32 total attempts; zero retry, overwrite, fallback, lineage mismatch, or response-hash mismatch (`readiness-result.json:8-15`; `smoke-result.json:8-25`; `screening-integrity.json:8-35`). |
| Result-summary hashes | PASS after correction | Four report-layer SHA transcription defects were found during this audit, corrected by the executor, and rechecked against the raw ignored cache. The raw run was not changed. |
| Path-mask handoff | **FAIL** | `prepare-e2-9-r4-packet-preview.mjs:6` imports `completeObservationStatus`; `e2-9-r4-integrity.mjs:3-46` does not export it. A direct invocation reproduces the ESM binding `SyntaxError` before module-body reads or writes. |
| Post-generation artifacts | PASS fail-closed | No packet preview, formal packet, labels, mapping key, scoring cache, aggregate, or quality-gate result exists. `expectedLoaded`, `strictScoringRun`, and post-failure model calls are all false/zero (`protocol-failure.json:5-18`). |
| Cleanup | PASS | Live read-only checks confirmed Preview endpoint HTTP 404, Preview secret names contain only `DEEPSEEK_API_KEY`, cleanup deployments are current, and Production's latest deployment remains `3b6d6ba2-e21f-495c-80e4-c4bac62366be` from 2026-08-08 (`security-cleanup.json:4-14`). |

The corrected cache bindings are:

- Readiness checkpoint `2a2cdcb...6ff747`, ledger `56114d9c...17120`.
- Smoke checkpoint `5c011ccd...2fffc3`, ledger `cbbf85a3...2fc2b6`.
- Screening checkpoint `c8f547b2...d0ebfb`, ledger `53e33db4...24dfee9`.

## Experiment-audit checks

### A. Ground-truth provenance: PASS (design), NOT EXECUTED

The scorer is designed to load the repository's frozen Golden, Holdout, and Development fixtures only after checkpoint, ledger, adjudication, chronology, and hash checks (`score-e2-9-r4.mjs:57-117`). The import failure occurs before packet creation, so expected answers were not read and real-ground-truth scoring was never executed.

### B. Score normalization: PASS (static), NOT EXECUTED

Static inspection found raw per-case scores and ordinary aggregate metrics, not normalization against either model's own maximum (`score-e2-9-r4.mjs:118-151`; `scoring.ts:336-414`). No R4 quality score was produced.

### C. Result existence and claim matching: FAIL for quality, PASS for diagnostics

All claimed generation counts, lineage counts, token totals, and provider-latency totals recompute from checkpoint payloads. Required quality artifacts do not exist, and the report correctly states `NOT RUN` / `NOT_AVAILABLE` (`screening-report.json:46-57`). Any claim that Pro is better, equal, or worse than Flash is unsupported.

### D. Dead-code / reachability: FAIL

The packet builder, formal adjudication, reveal, and scorer are unreachable in this frozen run because the first packet-preview module cannot instantiate. This is a protocol implementation failure, not evidence about either model.

### E. Scope assessment: PASS

The report confines evidence to Readiness, five Smoke cases, eight paired Screening cases, and performance diagnostics. It does not claim Selection, Blind, E3, E4, or Production readiness (`run-manifest.json:500`; `SCREENING_REPORT.md:45-57`).

### F. Evaluation type

**Planned:** `real_gt` plus human adjudication.
**Actually completed:** generation-only diagnostic with real model outputs; quality evaluation incomplete. It must not be represented as a completed benchmark.

## Preview bearer incident and remaining risk

The first PowerShell RNG Fill attempt was incompatible and created an invalid temporary bearer version at 08:30:52Z. After the R4 code deployment at 08:31:10Z, that invalid version existed for about 20.8 seconds until a CSPRNG-generated token replaced it at 08:31:31Z (`preview-activation.json:10-31`). Readiness did not begin until 08:32:55Z, the activation record reports zero calls with the invalid bearer, and the registered ledger contains exactly the 32 planned observations beginning after replacement. This does not contaminate the recorded run, but it is a deployment-order and exposure-window risk. A successor infrastructure design should provision and verify a cryptographic bearer while the feature flag is disabled, then enable the route; this audit does not authorize a successor run.

Other remaining risks:

- The ledger reports generation completion at `PATH_MASK_PREVIEW_OPEN`; the separate protocol-failure record is therefore essential to prevent that generation status from being misread as experiment completion.
- No path-masking packet reached the recursive scanner or a fresh path-identification reviewer, so PM01-PM12 prove unit behavior only, not this run's packet safety.
- Same-family reviewer independence is provisional, not cross-family acceptance.

## Claim impact and stop decision

- “32 registered real-model observations completed with exact lineage and no rerun”: **supported**.
- “Reported token and latency diagnostics match raw observations”: **supported**.
- “Protocol 3.2.0 produced a valid blinded comparison”: **unsupported**.
- “V4 Pro is better, equal, or worse than Flash”: **unsupported**.
- “Preview cleanup completed and Production was unchanged”: **supported by live read-only verification**.

Final state: **EXPERIMENT BLOCKED**. Keep V4 Pro quality **NOT AVAILABLE**, do not run Selection or create Blind, and do not start R5 automatically. Benchmark infrastructure needs redesign before any further model calls.
