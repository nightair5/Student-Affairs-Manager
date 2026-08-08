# Recognition evaluation

## E2-A baseline contract

E2-A freezes the current production recognizer and measures it; it does not improve it.

- Dataset: `e2-a-golden-1.0.0`, 110 synthetic anonymous school-affairs cases.
- Prompt: `recognition-2.0.0` (unchanged).
- Production model identifier: `deepseek-v4-flash` (unchanged).
- Reference time: `2026-08-08T08:00:00+08:00`.
- Timezone: `Asia/Shanghai`.
- Providers are reported separately as `local-fallback` and `deepseek-production`.
- Raw production outputs are held only in ignored `.evaluation-cache/`; committed failure files contain case IDs, categories and reasons, not credentials or user data.

Coverage is balanced across 11 groups with 10 cases each: course, complex notice, competition, application, event, multiple deadlines, material-heavy notices, vague time, information-only, OCR noise and hostile/prompt-injection input. Every case explicitly carries expected Project, Milestone, Task/Subtask, Material, TimePoint, Event, Evidence, Ambiguity and forbidden-output collections. An empty collection means the entity must not be invented.

Run the deterministic fallback:

```bash
npm run eval:recognition:e2 -- --provider=local-fallback --write-dir=docs/baselines/e2-a
```

Run the unchanged production endpoint with rate-limit-safe pacing and resumable local checkpoints:

```bash
npm run eval:recognition:e2 -- --provider=deepseek-production --endpoint=https://student-affairs.site/api/deepseek --delay-ms=8000 --resume=true --write-dir=docs/baselines/e2-a
```

Omit `--resume=true` for a clean run. `--limit=N` is available only for harness smoke checks; a published baseline must use all 110 cases.

## Metric definitions

| Metric | Definition |
| --- | --- |
| Project Decision | Case accuracy for `new_project` / `existing_project` / `standalone_task` / `uncertain`. |
| Milestone Precision / Recall | Micro-averaged one-to-one title-alias matches. |
| Task Precision / Recall | Micro-averaged one-to-one action + object matches; hierarchy mismatches are separately classified. |
| Material Recall | Expected material names found, micro-averaged. |
| TimePoint Accuracy | One-to-one match over type, source time phrase, precision/confirmation semantics and normalized local time when the golden value is exact. Denominator is the larger of expected and predicted counts. |
| Event Accuracy | One-to-one event title match divided by the larger of expected and predicted counts. |
| Evidence Coverage | Expected entity evidence whose quote is a literal substring of the source. |
| Duplicate | Duplicate normalized action + object + linked-time tuples divided by predicted tasks. |
| Over-fragmentation | Case rate where predicted tasks exceed golden task count by more than `max(2, ceil(expected * 0.5))`. |
| Major Correction | Wrong project decision, task/time recall below 50%, or any major taxonomy failure. |
| Severe Error | Forbidden output, a task invented for an information-only source, invalid output or request failure. |
| Invalid Output | Result failing the existing `RecognitionResult 2.0` runtime validator. |
| Latency | Client-observed end-to-end mean, P50 and P95. |
| Token / Cost | Observed only when the existing response exposes usage. The current production response does not, so E2-A reports `NOT OBSERVABLE` and does not substitute estimates. |

Failure categories are saved per case and aggregated into the Error Taxonomy. Scoring code is deterministic, has no network dependency, and does not call the model from the regular test suite.

The completed E2-A report is available at [`baselines/e2-a/BASELINE_REPORT.md`](baselines/e2-a/BASELINE_REPORT.md). It records the production run correction note as well as the final metrics; do not cite the pre-correction invalid-output count.

## Legacy 60-case check

`npm run eval:recognition` remains as a compatibility regression for the deterministic fallback. It is not a DeepSeek benchmark and must not be compared with the E2-A dataset because its contract and denominators differ.
