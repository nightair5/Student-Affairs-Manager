# E2.6 Experiment Integrity Audit

**Date:** 2026-08-11

**Auditor:** fresh Codex same-family reviewer, read-only, provisional

**Audited snapshot:** branch `codex/e2-factledger-ab-preview`, HEAD `c35429c`, including the then-uncommitted report/scorer artifacts bound by the hashes below

**Overall verdict:** `WARN`
**Core decision impact:** the end-to-end conclusion `FACTLEDGER NOT SUPPORTED` remains supported. The warnings invalidate two narrower audit claims, but they do not reverse any decision gate.

## Executive findings

1. Independent recomputation from the ignored candidate raw file reproduced every committed Path A/Path B strict metric, Fact Recall proxy, latency aggregate, observed-token aggregate, failure count, human-label count, and exact McNemar p-value.
2. The frozen datasets, frozen selection, and frozen scorer have no diff from baseline `70dd976`. The source-only manifest contains no `expected`, target, answer, gold, or ground-truth keys. The generation runner imports only that manifest; datasets and scoring code are loaded later by the scoring process (`scripts/prepare-e2-6-inputs.mjs:31-40`, `scripts/run-e2-6-paired-generation.mjs:115-123`, `scripts/score-e2-6-paired.mjs:170-182`).
3. All 48 scheduled cells exist and are unique; pair order is deterministic and interleaved, with A first for 10 cases and B first for 14. All 43 successful responses match the declared model, parameters, schema/version identifiers, input hashes, prompt hashes, raw-output hashes, Ledger hash where applicable, and result hash (`scripts/run-e2-6-paired-generation.mjs:68-103`). No mock, fallback, or alternate-provider marker was found.
4. The candidate is honestly partial: A succeeded 23/24 and B 20/24. All five failures remain in intent-to-treat scoring as invalid output or request failure (`scripts/score-e2-6-paired.mjs:183-200`). A complete-pair sensitivity check over the 20 successful pairs still has B Task Recall 25.53% versus A 70.21%, B Time Role 0% versus A 87.10%, B Strict Major 100% versus A 85%, and B Ambiguity Recall 0% versus A 65%; the negative decision is therefore not an artifact of counting failed calls.

## Resolved finding

### W1. RESOLVED — FactLedger ambiguity projection

The scorer now reads the contract fields `targetFactIds` and `message` (`scripts/score-e2-6-paired.mjs:110-114`, `cloudflare/factledger-experiment.mjs:78-89`). A bounded independent recheck reproduced the updated Ledger diagnostic: 11 extracted ambiguities, Ambiguity Precision 72.73%, Ambiguity Recall 34.78%, and Fact Recall proxy 69.96% (156/223).

The corrected value remains below Path A's 82.06% and does not alter Path B's final-output metrics or `FACTLEDGER NOT SUPPORTED`.

## Material warnings

### W2. Report qualification addressed; blind chronology remains unprovable

The key file was created at `2026-08-11T07:46:55.614Z`; the labels file was created at `2026-08-11T07:52:51.439Z`, 355.825 seconds later. The scorer writes the packet and key together (`scripts/score-e2-6-paired.mjs:346-353`). Therefore the report statement that labels were frozen before the key was opened (`docs/e2-factledger-ab/E2_6_PAIRED_AB_REPORT.md:52-60`) is not supported by the artifact chronology.

The current report now states this limitation explicitly and treats the endpoints as path-masked corroboration rather than independent blinded evidence (`docs/e2-factledger-ab/E2_6_PAIRED_AB_REPORT.md:52-62`). The label arithmetic itself is correct: Planning Error is A 6/24 versus B 20/24 (exact McNemar p=0.000518798828125), and User-impact Major is A 3/24 versus B 24/24 (p=9.5367431640625e-7). The underlying chronology cannot be repaired retrospectively, but the report claim is now accurate and the strict automated gates reject B without the human endpoints.

### W3. Per-observation claim addressed; run-start chronology remains invalid

The current report correctly distinguishes successful observations, validation failures, and pre-request TLS failures (`docs/e2-factledger-ab/E2_6_PAIRED_AB_REPORT.md:18-25`) and continues to disclose token coverage of A 23/24 and B 22/24 (`docs/e2-factledger-ab/E2_6_PAIRED_AB_REPORT.md:85-96`). The earlier overbroad per-observation claim is resolved.

Also, `generationStartedAt` is reassigned on each checkpoint write because the in-memory `checkpoint` value is not advanced (`scripts/run-e2-6-paired-generation.mjs:128-137,197-213`). In the candidate it is only 17 ms before `generationCompletedAt`, so it is not a valid run-start timestamp. Per-call latency values and their reported arithmetic still reproduce exactly.

### W4. Deployment-version claim addressed; live Production state remains unverified

The source boundary is sound: default/Production sets `E2_FACTLEDGER_EXPERIMENT_ENABLED=false`; Preview sets it true and has no routes (`wrangler.jsonc:29-46`). The handler checks the flag, same-origin policy, server-side DeepSeek secret, and separate bearer secret before execution (`cloudflare/worker.mjs:473-525`). All 31 Worker tests passed, including disabled-by-default, authorization, equal parameter, and Ledger-validation cases.

Live Preview history showed code deployment `4f320b6f-20a9-44af-8db1-cc0f8bfc9fec`, followed by secret-change deployment version `6af56989-00e4-4904-bace-086ab548fafd` before the candidate run. The current report now identifies both correctly (`docs/e2-factledger-ab/E2_6_PAIRED_AB_REPORT.md:22-24`). Two read-only attempts to list the default/Production deployments failed on network fetch, so this audit confirms Production-off by repository config/tests but still cannot independently prove the absence of an external Production deployment during this run.

## A-F checklist

### A. Ground-truth provenance: PASS

- Evaluation type is exposed diagnostic with dataset-provided expected records, not Blind.
- The 24-case selection is unchanged from `70dd976`: 10 Development, 10 Golden, and 4 Exposed Holdout.
- Manifest SHA-256 `77e7fbac95ac1614326de41eadbfec656058f5fe29a99fa283a4f2449036bf89`; selection SHA-256 `9c9275e42e872899602c005d4d69fd378c8592db5cac553b809438c73970416e`.
- Expected answers are absent from generation inputs and are loaded only after the candidate raw run is closed.

### B. Score normalization: PASS

- The scorer uses micro counts against frozen expected records; no score is divided by a statistic from the model's own output (`src/recognition/e2/scoring.ts:326-328,398-424`).
- Empty denominators use explicit fixed defaults, not prediction-derived maxima.

### C. Result existence and arithmetic: WARN

- Candidate raw SHA-256 `60b959d4bb7aa5a8079e5f0253ec45b03743618621b74fcd3669d42c6b5e835c` exists in ignored cache and binds all 48 schedule cells.
- Results SHA-256 at recheck time: `bee234c2b283883027669e2d2b9e999245870efba78a63690266fd75efcaa617`.
- Report raw-byte SHA-256 at final refresh: `08f279ec551b724b409afd7b2c5e07d3bd372ad7a23790c0429bb6a443e28d99`.
- All reported primary arithmetic reproduced exactly.
- WARN for the inherent portions of W2-W4: unprovable key-opening chronology, invalid absolute run-start time, and unavailable live default/Production deployment listing. The current report now states each limitation accurately.

### D. Metric code execution: PASS

- Primary Path A/B scoring and aggregation functions are called and independently reproduce the result (`scripts/score-e2-6-paired.mjs:183-260`).
- The corrected FactLedger ambiguity projection uses the contract fields and independently reproduces the updated intermediate-Ledger diagnostic values.

### E. Scope assessment: PASS WITH LIMITATIONS

- The report accurately calls this a fixed, exposed, 24-case, single-generation diagnostic and does not claim Blind generalization (`docs/e2-factledger-ab/E2_6_PAIRED_AB_REPORT.md:7-9,110-116`).
- Only 20/24 pairs have two successful outputs; intent-to-treat and complete-pair sensitivity both reject B.

### F. Evaluation classification

- Primary structural metrics: `real_gt` using frozen dataset expected records.
- Fact Recall: explicitly labeled diagnostic structural proxy, not an atomic-fact gold annotation.
- User-impact/Planning Error: `human_eval`, arithmetic verified, but blind independence is unproven (W2).
- Preview isolation/security tests: deterministic engineering validation; not model-quality evidence.

## Decision-gate audit

| Gate | Independently verified result |
| --- | --- |
| Task Recall +8 pp or User-impact Major -15 pp | FAIL: strict Task Recall -43.86 pp; human result also worsens, though blinding is unproven |
| Task Precision decline no worse than 3 pp | PASS: -0.33 pp |
| Evidence Coverage at least 95% | FAIL: B 84.89% |
| Severe Error does not increase | FAIL: +12.50 pp |
| Planning Error decreases | FAIL in supplied labels: +58.33 pp; strict complete-pair structure metrics independently corroborate major Planner loss |

## Scope-boundary checks

- `git diff 70dd976` shows no change to Golden, Holdout, Development datasets or `src/recognition/e2/scoring.ts`.
- No change was found to Workspace v8, Repository, Migration, or DomainCommitPlan paths.
- Production-default feature flag remains false; Preview routes are empty.
- Repository secret scan passed across 312 source/build files; an additional cache pattern scan found zero bearer/key-like residues.
- No evidence of E3/E4 implementation or `student-affairs.site` deployment appears in the audited diff. External Production deployment listing was unavailable as noted in W4.

## Claim impact

- **End-to-end `FACTLEDGER NOT SUPPORTED`: supported.** Four of five required safeguards fail, and the complete-pair sensitivity remains materially worse.
- **“The Planner loses facts retained by the Ledger”: supported.** Successful B Ledgers contain 56 obligations and 60 time expressions while final B emits 14 tasks and zero time points.
- **Updated intermediate-Ledger ambiguity and Fact Recall claims: supported.** The rechecked values are 72.73% Precision, 34.78% Recall, and 69.96% Fact Recall proxy.
- **Path-masked human corroboration claim: supported with the report's current qualification.** Counts and p-values are correct; blind independence remains unprovable.
- **Production not deployed: repository configuration supports the boundary, but live default-environment verification is unavailable.**

## Evidence trace

The reviewer performed only read/check operations before creating or refreshing these two permitted audit artifacts: Git diff/hash checks; recursive manifest key scan; schedule/response/prompt/result/Ledger hash verification; frozen scorer recomputation; corrected Ledger-projection sensitivity; human-label/key arithmetic and file-time check; secret scan; Worker tests; Preview deployment listing; two unsuccessful default deployment listings; and a final raw-byte report hash/qualification check. No code, dataset, expected answer, raw cache, result JSON, or existing report was modified by the reviewer.
