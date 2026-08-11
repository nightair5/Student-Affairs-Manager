# P8 Repair Ablation Report

## Verdict

**R2 retained for P9.**

R0 uses the frozen first-pass RecognitionResult with Repair disabled. R1 and R2 reuse that exact base output and make one real repair-only DeepSeek call only for the 24 frozen Validator triggers. All 48 planned calls completed; no mock, fallback, or failed call was substituted.

| Arm | Task P | Task R | Material R | Time Role | Event | Evidence | Strict Major | Severe | Trigger | Success | Harm | Repair latency mean / p95 | Repair tokens in / out |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| R0 | 80.00% | 67.80% | 95.54% | 80.00% | 84.62% | 97.35% | 66.25% | 0.00% | 0.00% | NOT OBSERVABLE | NOT OBSERVABLE | 0 / 0 ms | 0 / 0 |
| R1 | 80.00% | 67.80% | 100.00% | 80.00% | 87.18% | 97.94% | 60.00% | 0.00% | 30.00% | 37.50% | 0.00% | 2634 / 4252 ms | 91106 / 6086 |
| R2 | 80.00% | 67.80% | 100.00% | 80.00% | 89.74% | 97.94% | 60.00% | 0.00% | 30.00% | 41.67% | 0.00% | 2606 / 3917 ms | 94034 / 5380 |

## Net effect

- R2 leaves Task Precision/Recall unchanged at 80.00% / 67.80%; Repair cannot solve the dominant missing-Task planning gap under the bounded patch contract.
- Material Recall improves from 95.54% to 100.00%, Event Accuracy from 84.62% to 89.74%, Ambiguity Recall from 65.96% to 80.85%, and Strict Major from 66.25% to 60.00%.
- Evidence Coverage rises from 97.35% to 97.94%; Evidence Validity remains 100%; Severe Error remains 0%.
- R2 adds 94,034 input and 5,380 output tokens across 24 attempts. Mean repair-only latency is 2.61 s and P95 is 3.92 s; full-path mean latency rises from 7.73 s to 8.51 s.
- The first 44-call run used already-repaired cached results by mistake. It is retained only as `.evaluation-cache/e2-7/p8-repair-ablation-invalid-postrepair-pilot.json`, explicitly excluded from every metric above, and replaced by the bound 48-call run over true pre-repair R0 outputs.

## Integrity boundary

- Generation read only the stripped, SHA-256-bound input package; expected answers and scoring code were loaded only after all calls completed.
- R1/R2 order was deterministically interleaved by source hash.
- Same model: `deepseek-v4-flash`; same source and same frozen R0 result for both repair arms.
- Raw outputs, request metadata, result hashes, latency, and observed token usage remain in Git-ignored cache.
- Aggregate metrics bind checkpoint `764024ad3f4f6e6bfde798aa0a61509ff500cda93c38c5bbf842b643147f0c1e` and Preview deployment `250576f6-f9d6-4ebf-9558-30d4f89198f2`.
- User-impact Major was not re-adjudicated for changed repair outputs; this report uses Strict Major only and does not relabel old human judgments.
- A repair is harmful if it creates Severe/Major, increases duplicates/over-fragmentation, or reduces matched Task/Material/Time/Event/Evidence facts under the frozen scorer.

## Scope

The experiment endpoint is Preview-only, flag-gated, bearer protected, and not part of the default Recognition route. No Workspace v8, Repository, Migration, DomainCommitPlan, E3/E4, Production route, or expected answer changed.
