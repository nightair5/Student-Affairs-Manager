# E2.9-R3 V4 PRO SUCCESSOR SCREENING REPORT

## Final status

`EXPERIMENT BLOCKED`

Quality conclusion: `NOT_AVAILABLE`. Selection was not run, no candidate was frozen, no Blind was created, and no E3/E4 or Production work was performed.

## 1–6. Baseline and protocol

1. R2 stopped because a formal Screening observation ended with an upstream JSON truncation. R2 observations were never resumed, edited, scored into, or reused by R3.
2. R3 used frozen Protocol `e2-9-v4-pro-protocol-3.1.0`, run `e29r3-run-20260813-a`, and 32 unique new observation IDs.
3. Git baseline was `a16cf67`; implementation commit was `307590a`. The run manifest is bound by `4396344a…`, and the protocol/deployment bundle by `954e48c…`.
4. `UPSTREAM_JSON_TRUNCATED` requires HTTP 200, JSON content type, exact model identity visible in the outer envelope, and an end-of-input parse failure inside an unfinished JSON structure. Complete malformed JSON and Schema-invalid results remain `MODEL_JSON_INVALID`.
5. Only `UPSTREAM_JSON_TRUNCATED` permits one retry inside the same observation. Attempt 1 is append-only; attempt 3, new observation IDs, overwrite, Best-of-N, and all other retries are forbidden.
6. T01–T10 and generation-firewall/model-lineage tests passed. An extra negative test confirms complete malformed JSON is not classified as truncation.

## 7–10. Readiness, Smoke, Screening, retry

| Stage | Result | Attempts | Truncated | Retried | Final failures |
| --- | ---: | ---: | ---: | ---: | ---: |
| Readiness | 6/6 | 6 | 0 | 0 | 0 |
| Smoke | 10/10 | 10 | 0 | 0 | 0 |
| Screening | 16/16 | 16 | 0 | 0 | 0 |

The server ledger ended `COMPLETE` at `SCORING_OPEN`. All four model-lineage fields matched the server-returned model, with zero fallback and zero unauthorized retry.

## 11–18. Screening metrics

These frozen strict-scorer outputs were computed only after all 16 paired results and bindings passed. They are retained as diagnostic measurements, but cannot support a final model-quality conclusion because the later path-masked review failed integrity.

| Metric | Flash | Pro |
| --- | ---: | ---: |
| Task Precision | 93.33% | 92.86% |
| Task Recall | 87.50% | 81.25% |
| Milestone P/R | 38.46% / 38.46% | 58.33% / 53.85% |
| Material P/R | 91.67% / 84.62% | 92.31% / 92.31% |
| TimePoint Type / Value | 89.47% / 78.95% | 89.47% / 94.74% |
| Event Accuracy | 100% | 100% |
| Ambiguity P/R | 100% / 71.43% | 100% / 71.43% |
| Evidence Coverage / Validity | 100% / 100% | 100% / 100% |
| Strict Major Correction | 75.00% | 62.50% |
| Planning Error | 87.50% | 75.00% |
| Severe Error | 0% | 0% |
| Mean final latency | 9,012 ms | 16,190 ms |
| Total / mean tokens | 34,455 / 4,306.88 | 33,962 / 4,245.25 |

Pro Task Recall was 6.25 percentage points below Flash; Task Precision was 0.48 points lower. Pro mean latency was 7,177.63 ms (79.64%) higher, while total tokens were 493 (1.43%) lower.

## 19–22. Reliability, integrity, cleanup, independent review

Transport reliability was 8 observations / 8 attempts / 0 truncations / 0 retries / 0 final failures for each model.

The fresh reviewer detected that every X/Y result retained `modelName`. The packet therefore disclosed model identity before judgment. All eight labels were correctly recorded as `INSUFFICIENT_INFORMATION`; pair improvements/worsening are `NOT_AVAILABLE`. The machine gate file says `V4_PRO_SCREENING_V3_FAIL`, but it is non-authoritative because one failed input is the invalid blind-review count. Protocol integrity failure takes precedence, yielding `EXPERIMENT BLOCKED` and no model-quality conclusion.

Preview was returned to flag `false`; the R3 endpoint returned HTTP 404; the temporary bearer was removed; the remaining Preview Secret list contains only `DEEPSEEK_API_KEY`. Production remains on version `3b6d6ba2…` from 2026-08-08 and was not deployed. A fresh independent audit is recorded separately.

## 23–28. Files, risks, and stage status

Changed files are confined to the R3 Preview harness, append-only ledger, transport policy, runner/scorer/adjudication scripts, tests, Wrangler Preview/ledger configs, package scripts, and `docs/e2-v4-pro-benchmark-r3/**`. No Prompt, Schema, scorer semantics, expected fixture, Workspace v8, Repository, Migration, DomainCommitPlan, E3/E4, or Production default path changed.

Remaining risks: path masking must recursively strip all lineage/provider fields and be tested before another experiment; the first attempted Secret creation used an unsupported PowerShell RNG API and produced an unusable empty Secret before calls, then was replaced and the final deployment re-bound; only eight exposed Screening cases were measured; no Blind evidence exists.

- E2: `BLOCKED`
- Selection readiness: `NOT READY / NOT RUN`
- E3: `NOT READY`
- Production: `NOT READY / NOT DEPLOYED`
- Final instruction: `STOP BEFORE SELECTION`
