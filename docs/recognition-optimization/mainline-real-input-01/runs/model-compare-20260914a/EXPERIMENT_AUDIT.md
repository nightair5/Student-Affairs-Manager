# Experiment Audit Report

**Date**: 2026-09-14

**Auditor**: fresh same-family Codex reviewer (`/root/model_compare_independent_audit`, read-only, provisional)

**Project**: MAINLINE-REAL-INPUT-01 / model-compare-20260914a

**Overall Verdict**: `PASS_WITH_DISCLOSED_LIMITATIONS`

**Integrity Status**: `pass`

## Executive finding

No current-run blocker was found. Independent local recomputation, without a model or network request, confirms that the 40 formal calls form 20 matched pairs whose serialized request bodies differ only in `model`; every raw response is HTTP 200, every returned model identity matches its arm, all 40 response IDs are unique, and the append-only ledger contains exactly one grant plus 40 reserve/settle pairs. The conservative decision `DO_NOT_ADOPT_PRO` is supported.

The exact business totals remain provisional because the 20 notices are already-seen synthetic development material and the case-level business adjudications are authored in the same experiment workspace rather than by blinded independent human judges. This limitation is disclosed in the run report and does not weaken the conservative non-adoption decision.

## Blockers

None.

## Non-blocking limitations

1. The references are frozen, pre-existing synthetic development references, not external real-world ground truth or an unseen blind set. They were not derived from this run's A/B outputs, but they only support an already-seen development regression claim (`REFERENCES_FINAL.json:2-3`; `candidate08-20260913a/AUDIT.md:14-16`).
2. Business error labels are explicit case-level adjudications in `REPORT.mjs:26-75`. The aggregate is reproducible, but the rules/adjudications are not cryptographically bound into `BINDING_FINAL.json`; exact `17/20` versus `15/20` and `6` versus `10` therefore remain same-author, provisional business judgments rather than blinded human-evaluation estimates.
3. W01-B's immutable provider bytes, identity, usage and ledger receipt are bound and valid. Its current `_RESULT.json` still records `REAL_INPUT_MODEL_IDENTITY` (`W01-B_RESULT.json:10-25`), while the analysis parses a cloned envelope after replacing only the parser-visible model name (`ANALYZE.mjs:29-38`). `REPARSE.json:6-10` calls the provider-response SHA `originalResultSha`; there is no separate pre-analysis hash of the whole `_RESULT.json`. This is a naming/provenance precision issue, not evidence that raw data were overwritten.
4. Provider billed amount is unavailable; only the documented peak-price upper bound is reported (`BILLING.json:44-54`). The current external price page was not re-fetched by this no-network auditor.
5. New browser journeys, refresh readback, independent repository read and two downloads are all honestly `NOT_RUN` after the single control failure (`BROWSER.json:4-10,19-24`). Prior product evidence is clearly marked reused, not newly executed (`BROWSER.json:26-29`).
6. The old RCO-5-007 lockfile freeze assertion is still a separate known failure (`CHECKS.json:75-86`). `package-lock.json` has no current Git diff, so it is not attributable to this model-comparison change; the overall engineering state must not be described as an entirely green historical gate.

## Checks

### A. Ground Truth Provenance: WARN

- The run copies the already-frozen 20-item references and records their SHA-256 in the binding (`BINDING_FINAL.json:58`; `REFERENCES_FINAL.json:2-3`). Recalculation matched the declared reference hash `ab7da30f...f565d` and all declared dependency/file hashes.
- The parent material explicitly states that the later eight notices were anonymous synthetic notices frozen before their original comparison (`candidate08-20260913a/AUDIT.md:14-16`). These references predate the present Flash/Pro responses and are not generated from either arm.
- Classification: synthetic development reference, not real dataset ground truth. The report correctly calls all 20 notices “已见材料开发回归”, not blind accuracy (`BINDING_FINAL.json:2780`).

### B. Score Normalization: PASS_WITH_LIMITATION

- `REPORT.mjs:22-23,77-83` defines raw category counts and sums them directly; no score is divided by a model-derived maximum, mean or other prediction statistic.
- Independent summation of all `COMPARISON.json` case records reproduced Flash `17/20`, 6 errors and 1 structural blocker, and Pro `15/20`, 10 errors and 6 structural blockers (`COMPARISON.json:243-299`).
- Frozen strict scores remain separate from the business adjudication and are not used to inflate the adoption result (`COMPARISON.json:330`).
- Limitation: the case-level adjudications are hard-coded manual judgments, not blinded human labels. Spot checks of W02, W11, W12, X05 and X07 support the direction of the reported differences, but exact error counts should retain the “provisional development adjudication” qualifier.

### C. Result File Existence and Binding: PASS

- All 40 `_RAW.jsonl` and all 40 `_RESULT.json` files exist. Each raw file contains exactly one record.
- Recalculated SHA-256 values match each raw `responseSha`; raw request/candidate/input identities match `BINDING_FINAL.json`; result request/response/binding identities match the raw and binding.
- All 40 envelopes are completed HTTP 200 responses, with 20 `deepseek-flash` and 20 `deepseek-v4-pro`, 40 unique response IDs, and zero reasoning tokens. W01-B's strict-score failure is preserved rather than removed (`W01-B_RESULT.json:20-25`).
- Independent ledger replay verified all 507 rows, sequence and previous-hash links, every row hash, the frozen 426-row prefix, and the final tail `7c5fd950...e65b8`. The new suffix is exactly 81 rows: one model-comparison grant, 40 reserves and 40 settlements (`CHECKS.json:86-91`).

### D. Dead Code Detection: PASS

- `ANALYZE.mjs` consumes the bound raw/results and writes `BUSINESS_INPUTS.json` plus `REPARSE.json`; both outputs exist.
- `REPORT.mjs` consumes those inputs and writes `COMPARISON.json`; its aggregate fields and adoption decision are present (`REPORT.mjs:151-200`; `COMPARISON.json:321-329`).
- No claimed metric is sourced from an absent result file. W01-B's unavailable frozen strict score remains null and is not silently fabricated.

### E. Scope Assessment: WARN

- Scope is 20 already-seen synthetic notices, one response per model per notice, one fixed prompt/wire and one parameter setting. There are no independent seeds, unseen holdout, real-user timing, or current browser acceptance.
- The narrative consistently limits the claim to a development regression and explicitly avoids commercial-accuracy or human-conversion claims. The scope therefore supports model selection for this isolated experiment only.

### F. Evaluation Type

- Model quality: `synthetic_proxy` / already-seen paired development regression with frozen references.
- Business adjudication: same-family, same-workspace manual case review; provisional.
- Product conversion cited in this run: previously completed zero-call engineering replay, not this run's browser result (`COMPARISON.json:331-339`).
- Current browser evaluation: `NOT_RUN` (`BROWSER.json:19-24`).

## Additional integrity checks

### Only-model variable: PASS

- Binding records candidate03 and model-wire v1 plus A/B model identities (`BINDING_FINAL.json:3-8`).
- For every pair, removing only the top-level `model` field makes the two parsed request objects deeply equal. The A-arm request, after the same removal, is deeply equal to the corresponding frozen candidate09 `-03` request. Parameters are identical: temperature 0, reasoning effort none, stream false and max output 8192.
- The fixed order contains ten A-first and ten B-first pairs and is bound with seed 20260914 (`BINDING_FINAL.json:2697-2780`).

### Identity, ledger and budget: PASS

- Raw and result identity checks independently reproduced 40/40 exact returned identities.
- Per-response peak-price recomputation matched every settlement. Flash totals 431,170 micro-CNY; Pro totals 1,825,677 micro-CNY; batch total is 2,256,847 micro-CNY.
- Adding the frozen starting upper bound 8,302,966 micro-CNY yields 10,559,813 micro-CNY, below the 20,000,000 micro-CNY cap (`BASELINE.json:27-29`; `BILLING.json:9-41`). Provider actual billing remains `NOT_OBSERVABLE`.

### Adoption decision: PASS

- The stored totals are internally consistent: Flash `17/20`, 6 business errors and 1 structural blocker versus Pro `15/20`, 10 errors and 6 blockers (`COMPARISON.json:243-299`).
- Direct source/response spot checks confirm material Pro regressions: W02 omits both uncertain-time facts; X05 adds an “出示工作证” task and moves the material ownership; W11 adds a sample material and still retains the extra bag task. Pro benefits on W11 condition state and X07 material granularity do not offset these regressions.
- Because Pro is slower and more expensive while not improving the target business outcome, `DO_NOT_ADOPT_PRO` is a conservative and evidence-supported decision (`COMPARISON.json:321-329`). It does not claim Flash is commercially accurate.

### W01-B neutral reparse: PASS_WITH_DISCLOSURE

- Gateway/ledger evidence fixes the returned provider identity as `deepseek-v4-pro`; raw bytes and response SHA are unchanged.
- The analysis clones that envelope and changes only the parser-visible model string so the historical Flash-only parser can read the schema (`ANALYZE.mjs:29-38`). The original result remains a strict-score failure (`W01-B_RESULT.json:18-25`).
- The business facts can be inspected, but the frozen strict Pro denominator remains 19/20, as disclosed. This reparse must not be presented as a new provider response or as a repaired strict score.

### Browser and historical freeze separation: PASS

- Browser status is conservative: exactly one failed control attempt is recorded and all new interactive evidence is `NOT_RUN` (`BROWSER.json:4-10,19-24`).
- The historical lockfile freeze mismatch is explicitly retained as `KNOWN_HISTORICAL_FAILURE`, while current model-comparison checks are reported separately (`CHECKS.json:75-105`).

## Claim impact

- C1 — “The paired requests differ only by model”: **supported**.
- C2 — “40/40 responses have the requested model identity and are ledger-bound”: **supported**.
- C3 — “Flash is 17/20 with 6 errors; Pro is 15/20 with 10 errors”: **supported as provisional same-author development adjudication; not a blind accuracy estimate**.
- C4 — “Do not adopt Pro for the 6632 isolated trial”: **supported**.
- C5 — “20 tasks were saved in the existing reliable engineering replay”: **needs qualifier already present; reused zero-call engineering evidence, not this run's browser or human conversion**.
- C6 — “This run completed two new browser journeys/downloads”: **unsupported and correctly not claimed (`NOT_RUN`)**.

## Action items

- Keep `DO_NOT_ADOPT_PRO` and the current Flash/candidate03 isolated baseline.
- Preserve the development-only qualifier and do not turn these 20 seen synthetic notices into a general accuracy claim.
- In a future run, bind the business rules/adjudication protocol into the pre-dispatch binding, and use an independent blinded judge if exact business-error rates will support a stronger claim.
- Rename a future `originalResultSha` field to `providerResponseSha` or add a separate whole-result-file hash; do not rewrite this frozen run solely for naming cleanup.
- Keep current browser work marked `NOT_RUN` unless actual new interactive, repository-read and download evidence is obtained.

## Review trace

The parent executor supplied the artifact paths to this fresh audit agent. This file and `EXPERIMENT_AUDIT.json` are the allowed in-run forensic record; the task explicitly prohibited creating a third trace artifact. No network or model request was made by the auditor.
