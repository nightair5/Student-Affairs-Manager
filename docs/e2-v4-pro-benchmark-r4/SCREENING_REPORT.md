# E2.9-R4 V4 Pro Path-Masked Screening Report

Final status: **EXPERIMENT BLOCKED**. Model quality conclusion: **NOT AVAILABLE**.

## 1. R3 failure and Protocol 3.2

R3 exposed `result.modelName` in every X/Y output. R4 therefore used a fresh run, fresh labels/IDs, a recursive forbidden-lineage registry, explicit allowlist projection, anonymous case IDs, removal of latency/token side channels, a secret-derived per-case assignment commitment, and delayed mapping reveal. No R3 observation, packet, mapping, label, or quality result was reused.

## 2. Path-masking threat model and schema

The frozen packet schema permits only Source, X/Y business projections, side hashes, anonymous IDs, the human rubric, and assignment commitments. PM01–PM12 all passed; a 100-pair synthetic assignment test passed its balance and no-hint checks. Selection and Blind remain machine-denied.

## 3. Readiness, Smoke, and Screening execution

| Phase | Observations | Complete | Retry | Fallback | Lineage mismatch |
|---|---:|---:|---:|---:|---:|
| Readiness | 6 | 6 | 0 | 0 | 0 |
| Smoke | 10 | 10 | 0 | 0 | 0 |
| Screening | 16 | 16 | 0 | 0 | 0 |

All 32 preregistered observation IDs were unique, all completed in one attempt, and the append-only ledger recorded no overwrite or unauthorized rerun. The Screening ledger stopped at `PATH_MASK_PREVIEW_OPEN`.

## 4. Path-masking dry run failure

The first post-Screening command failed before creating any packet: `prepare-e2-9-r4-packet-preview.mjs` imports `completeObservationStatus`, but the frozen integrity module does not export it. Repairing the import after generation would alter a file covered by the frozen protocol bundle. The experiment therefore failed closed.

- packet preview: not created
- formal packet: not created
- fresh path-identification review: not run
- human labels: not created
- mapping key: not created
- expected answers loaded: no
- strict scoring: not run
- model calls after failure: zero

No Flash/Pro quality comparison, strict metric, human preference, win/loss count, or quality gate is available. The 16 Screening outputs remain diagnostic raw data in Git-ignored cache only.

## 5. Latency and token diagnostics

Across Readiness + Smoke + Screening, Flash used 54,850 observed tokens and 115,264 ms provider latency; Pro used 54,447 tokens and 205,173 ms. For Screening alone, Flash used 34,356 tokens / 72,086 ms; Pro used 33,729 tokens / 124,925 ms. These are performance diagnostics only and are not model-quality evidence.

## 6. Security cleanup

The Preview flag was returned to false, the R4 endpoint returned HTTP 404, and the temporary Bearer was deleted. The only remaining Preview secret name is `DEEPSEEK_API_KEY`; no value was read. Secret scan passed. Production's latest deployment remains `3b6d6ba2-e21f-495c-80e4-c4bac62366be` from 2026-08-08, so R4 did not deploy Production.

## 7. Status and remaining risk

- independent audit: **FAIL** (fresh same-family read-only review; provisional). Generation evidence is internally consistent after correcting four report-layer SHA transcription errors, but the frozen packet-preview import failure prevents adjudication and scoring. Model quality remains **NOT AVAILABLE**.
- Selection readiness: NOT READY
- Selection: NOT RUN
- Blind: NOT CREATED
- E2: BLOCKED
- E3: NOT READY
- Production: NOT READY

The blocking defect is in the frozen adjudication Harness, not model quality. Recommendation: **Benchmark infrastructure needs redesign before further model calls.** Do not start R5 automatically.
