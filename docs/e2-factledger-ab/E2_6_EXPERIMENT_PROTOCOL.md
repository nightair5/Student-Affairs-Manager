# E2.6 FactLedger Paired A/B Experiment Protocol

## Status and scope

- Baseline commit: `70dd976`
- Branch: `codex/e2-factledger-ab-preview`
- Evaluation type: exposed diagnostic, paired, single generation per path and case
- Frozen sample: the 24 cases in `docs/e2-factledger/d5-complex-selection.json`
- Blind eligibility: false
- Production, E3, E4, Workspace v8, Repository, Migration and DomainCommitPlan are out of scope.

## Isolation boundary

The experiment endpoint is `/api/experiments/e2-factledger/generate`. It is usable only when `E2_FACTLEDGER_EXPERIMENT_ENABLED=true` and a separate bearer Secret is present. The default/Production Wrangler environment sets the flag to `false`; Preview sets it to `true` and has no custom-domain route.

Path A is one direct `recognition-2.4.1` call. Path B is `fact-ledger-extraction-1.1.0` → deterministic FactLedger validation → `fact-ledger-planner-1.0.0`. Router, production Validator and Repair do not participate. Both paths use `deepseek-v4-flash`, temperature 0, disabled thinking, `max_tokens=8192`, JSON mode and zero harness retries.

## Frozen inputs and generation firewall

- Selection SHA-256: `9c9275e42e872899602c005d4d69fd378c8592db5cac553b809438c73970416e`
- Input manifest SHA-256: `77e7fbac95ac1614326de41eadbfec656058f5fe29a99fa283a4f2449036bf89`
- Pair-order seed: `e2.6-paired-2026-08-11`

`scripts/prepare-e2-6-inputs.mjs` is the only preparation step that loads dataset modules. It writes source-only inputs and hashes to `.evaluation-cache/e2-6/input-manifest.json`. `scripts/run-e2-6-paired-generation.mjs` reads only that ignored manifest and the Preview response; it does not import dataset or scoring modules. Expected answers are loaded only by the later scoring command after all 48 scheduled observations finish.

Case order is sorted by SHA-256 of `seed:case:caseId`. Within each adjacent pair, the first path is chosen from SHA-256 of `seed:path:caseId`; the other path runs second. The schedule is immutable within a labeled checkpoint. A failed observation is retained and is not silently retried; a retry requires a new run label.

## Provenance captured per observation

- case and paired sequence (stored only in ignored raw cache)
- source SHA-256 and canonical input SHA-256
- model, Schema, Prompt and experiment versions
- SHA-256 of all three system prompts
- result SHA-256 and, for B, Ledger SHA-256
- per-operation and total server latency
- round-trip latency
- per-operation and total observed input/output tokens
- operation list and zero-retry parameters

Raw model completions, source, Ledger and RecognitionResult payloads remain under `.evaluation-cache/` and are Git ignored. Committed results contain aggregate metrics and anonymized paired counts only.

FactLedger Validation may correct an evidence offset only when the model-provided `quote` occurs exactly once in the source; it sets the canonical JavaScript UTF-16 `[start,end)` span and records the adjustment. Missing or repeated quotes remain validation failures. This deterministic step cannot add, delete or rewrite a fact.

## Scoring contract

Strict structural metrics use the same frozen E2 scorer for both paths. No expected record may be edited. The reported metrics are:

- Task precision and recall
- Material precision and recall
- Time-point role/type accuracy and value accuracy
- Milestone precision and recall
- Event accuracy
- Ambiguity precision and recall
- Evidence coverage and validity
- Strict Major Correction and Severe Error
- latency and observed input/output tokens

Fact Recall is a declared final-output proxy because Path A has no intermediate ledger: micro recall over expected Task, Material, detected TimePoint, Event and Ambiguity fact units using the same scorer matches. It is not represented as an independently annotated source-fact ground truth.

Planning Error and User-impact Major Correction require a post-generation, path-blinded adjudication. Planning Error means relevant source facts are present in the output evidence/facts but their Task, Milestone, Time role, Event or relationship organization requires correction. User-impact Major means a user must add, remove or materially reclassify an actionable obligation, required material, consequential time role/value, or event/task distinction. Reasonable equivalent task grouping alone is not major. Strict Major remains the unchanged scorer result.

Paired differences are reported with case-level counts and a deterministic paired bootstrap interval where applicable. With only 24 exposed cases, intervals are descriptive and do not convert the experiment into Blind evidence.

## Decision rule

FactLedger is supported only if all safeguards pass and at least one primary improvement passes:

- Task Recall improves by at least 8 percentage points, or User-impact Major Correction falls by at least 15 percentage points;
- Task Precision falls by no more than 3 percentage points;
- Evidence Coverage is at least 95%;
- Severe Error does not increase;
- Planning Error actually decreases;
- latency and token increases are separately reported.

If B is not genuinely completed through the authenticated Preview endpoint, the result is `EXPERIMENT INCONCLUSIVE`; mock, fallback and legacy cache results are inadmissible.
