# Student Affairs Product v2.0 - E2.6 FactLedger Paired A/B Report

## Final status

`FACTLEDGER NOT SUPPORTED`

The tested two-stage Path B did not improve complex-notice recognition and failed four of the five decision safeguards. The intermediate FactLedger retained substantially more structure than the Planner emitted, so the dominant Path B failure is localized to planning/serialization; however, the intermediate Ledger did not outperform Path A on the declared intent-to-treat Fact Recall and therefore does not justify recommending the architecture yet.

This is an exposed 24-case diagnostic, not Blind evidence. E2 remains blocked; E3, E4 and Production remain out of scope.

## Execution integrity

- Baseline: `70dd976`; branch: `codex/e2-factledger-ab-preview`.
- Frozen selection: 24 cases from the already exposed E2.5 complex selection.
- Selection SHA-256: `9c9275e42e872899602c005d4d69fd378c8592db5cac553b809438c73970416e`.
- Source-only input manifest SHA-256: `77e7fbac95ac1614326de41eadbfec656058f5fe29a99fa283a4f2449036bf89`.
- Candidate raw run SHA-256: `60b959d4bb7aa5a8079e5f0253ec45b03743618621b74fcd3669d42c6b5e835c`.
- All 48 scheduled observations were retained. A completed 23/24 and B completed 20/24; all failures remain in intent-to-treat scoring.
- Generation recorded `generationExpectedDataLoaded=false`. Expected answers were loaded only after generation closed.
- Both paths used `deepseek-v4-flash`, temperature 0, thinking disabled, `max_tokens=8192`, identical canonical inputs and the same RecognitionResult 2.0 target schema.
- Router, production Validator, Repair, mock, fallback and legacy result caches did not participate.
- Every successful observation in the ignored raw cache contains source/input hashes, prompt and pipeline versions, prompt hashes, result/Ledger/raw-output hashes, latency and tokens. Validation failures retain completed extraction diagnostics and tokens; pre-request TLS failures cannot have model-result hashes or tokens. The interleaved schedule retains all cells.
- Preview endpoint: `https://student-affairs-manager-preview.nightsdell.workers.dev/api/experiments/e2-factledger/generate`; code deployment version: `4f320b6f-20a9-44af-8db1-cc0f8bfc9fec`. A later Secret rotation created active deployment `6af56989-00e4-4904-bace-086ab548fafd` before the candidate run without changing code.
- The endpoint required both `E2_FACTLEDGER_EXPERIMENT_ENABLED=true` and a separate bearer Secret. The default/Production environment remains disabled and no custom production route was deployed.
- During transport diagnosis, one ignored local probe briefly captured the experiment bearer credential. The credential was immediately rotated, the exact probe was deleted, the runner was changed to redact transport errors, and a cache scan found zero remaining `Bearer` residues. No credential was committed.

## Primary paired results

All rates below use the full 24 cases per path. Failed invocations are not dropped: they count as request/invalid-output failures and feed Strict Major/Severe Error under the frozen scorer.

| Metric | Path A | Path B | B - A |
| --- | ---: | ---: | ---: |
| Fact Recall proxy | 82.06% | 31.39% | -50.67 pp |
| Task Precision | 86.05% | 85.71% | -0.33 pp |
| Task Recall | 64.91% | 21.05% | -43.86 pp |
| Material Precision | 97.96% | 86.67% | -11.29 pp |
| Material Recall | 94.12% | 76.47% | -17.65 pp |
| Time Role Accuracy | 80.82% | 0.00% | -80.82 pp |
| Time Value Accuracy | 76.71% | 0.00% | -76.71 pp |
| Milestone Precision | 52.50% | 50.00% | -2.50 pp |
| Milestone Recall | 40.38% | 51.92% | +11.54 pp |
| Event Accuracy | 95.24% | 86.36% | -8.87 pp |
| Ambiguity Precision | 78.95% | 100.00% | +21.05 pp |
| Ambiguity Recall | 65.22% | 0.00% | -65.22 pp |
| Evidence Coverage | 97.84% | 84.89% | -12.95 pp |
| Evidence Validity | 100.00% | 100.00% | 0.00 pp |
| Strict Major Correction | 83.33% | 100.00% | +16.67 pp |
| Severe Error | 4.17% | 16.67% | +12.50 pp |

Fact Recall is the preregistered final-output proxy: micro recall over expected Task, Material, detected TimePoint, Event and Ambiguity units using the unchanged scorer. It is not a separately annotated atomic-fact gold standard.

## Path-blinded human adjudication

The adjudication packet used X/Y sides and reasonable equivalent grouping was not counted as user-impact Major Correction. The key file existed before labeling because the scorer emitted packet and key together; artifact chronology therefore cannot prove that the key remained unopened. Treat these endpoints as path-masked but not independently blinded corroboration.

| Metric | Path A | Path B | B - A | Paired exact result |
| --- | ---: | ---: | ---: | --- |
| Planning Error | 6/24 (25.00%) | 20/24 (83.33%) | +58.33 pp | 1 improved, 15 worsened; two-sided p=0.000519 |
| Planning or generation failure | 7/24 (29.17%) | 24/24 (100.00%) | +70.83 pp | descriptive composite |
| User-impact Major Correction | 3/24 (12.50%) | 24/24 (100.00%) | +87.50 pp | 0 improved, 21 worsened; two-sided p=0.000000954 |

The supplied labels show B as materially worse on both human-impact endpoints, and their paired arithmetic is exact. Because key-opening chronology is not independently provable, the p-values are corroborating rather than independent blinded evidence. The inference remains limited to this fixed diagnostic sample.

## FactLedger-versus-Planner localization

A post-generation, read-only projection of the validated B Ledger through the same scorer produced:

- Ledger Fact Recall proxy: 69.96%, versus B final output 31.39% and A final output 82.06%.
- Ledger obligation-as-task recall: 64.91%, versus B final Task Recall 21.05%.
- Ledger Time Role Accuracy: 73.61%, versus B final 0.00%.
- Ledger Time Value Accuracy: 75.00%, versus B final 0.00%.
- Ledger Evidence Coverage: 84.89%; Evidence Validity: 100.00%.
- Ledger Ambiguity Precision/Recall: 72.73% / 34.78%.

Across the 20 successful B results, validated Ledgers contained 56 obligations, 60 time expressions and 11 ambiguities. The Planner emitted only 14 tasks, zero time points and zero ambiguities. This localizes the largest observed loss to Planner/schema serialization, while also showing that the FactLedger extractor itself has low Ambiguity Recall and does not beat Path A Fact Recall under intent-to-treat scoring.

## Reliability failures

- Path A: one pre-request TLS handshake failure (4.17%).
- Path B: two pre-request TLS handshake failures and two FactLedger validation failures (16.67% total unavailable output).
- Complete successful pairs: 20/24.

The transport harness retried only curl code 35, which occurs before an HTTP request is established, at most twice. Other failures were retained. A prior partial run (46/48 successful) was preserved in ignored cache but was not used for candidate scoring because it preceded the frozen `planned_end` contract correction.

## Latency and tokens

| Measure | Path A | Path B | B - A |
| --- | ---: | ---: | ---: |
| Mean latency | 9,596.92 ms | 10,252.96 ms | +656.04 ms (+6.84%) |
| P50 latency | 9,296 ms | 10,119 ms | +823 ms |
| P95 latency | 12,690 ms | 13,297 ms | +607 ms |
| Observed input tokens / measured invocation | 2,377.30 | 2,063.00 | -314.30 |
| Observed output tokens / measured invocation | 2,202.61 | 2,203.50 | +0.89 |
| Observed total tokens / measured invocation | 4,579.91 | 4,266.50 | -313.41 |

Token coverage was 23/24 for A and 22/24 for B. B token usage is the sum of extraction and planning operations when both exist; validation failures include their completed extraction usage. Because missing observations differ, token means are reported as observed, not imputed. Provider cost was `NOT OBSERVABLE` and was not estimated.

## Decision gates

| Gate | Result |
| --- | --- |
| Task Recall +8 pp or User-impact Major -15 pp | FAIL: -43.86 pp / +87.50 pp |
| Task Precision decline no worse than 3 pp | PASS: -0.33 pp |
| Evidence Coverage at least 95% | FAIL: 84.89% |
| Severe Error does not increase | FAIL: +12.50 pp |
| Planning Error actually decreases | FAIL: +58.33 pp |

One of five safeguards passed. The fact that the intermediate Ledger retained more facts than the Planner does not override the end-to-end gate.

## Contract and scorer audit limitations

- The same frozen scorer was used for A and B, and no expected answer was edited.
- The scorer is a strict structural matcher and can still classify semantically equivalent structures as Strict Major. The separate path-blinded User-impact metric mitigates, but does not eliminate, this limitation.
- The Fact Recall proxy mixes structural categories and is not an independent atomic-fact annotation.
- The Ledger projection is diagnostic only: FactLedger has no expected-native scoring contract, and empty/invalid Ledgers are counted as empty projections.
- Human-label arithmetic is reproducible, but the pre-existing key prevents an artifact-only proof of blind independence.
- Repository config and Worker tests prove the default environment is disabled; the independent reviewer could not complete a live default-environment deployment listing because of network failure.
- All datasets are exposed. Results cannot establish unseen generalization.

## Scope, files and next step

The experiment added only an isolated Preview endpoint, FactLedger experiment contract/validator, source-only preparation and paired-generation harnesses, scorer, aggregate results and audit documentation. Workspace v8, Repository, Migration, DomainCommitPlan, production recognition defaults, Golden/Holdout/Development expected records, E3/E4 and `student-affairs.site` were not changed.

Do not connect Path B to Production. If another explicitly authorized diagnostic is run, the narrow next step is to repair the Planner's lossless serialization of obligations, time expressions and ambiguities, then create a new versioned Preview run label and rerun the same paired protocol without changing expected answers. This report does not authorize that follow-up.
