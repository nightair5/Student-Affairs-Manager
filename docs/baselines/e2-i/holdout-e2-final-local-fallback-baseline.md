# E2 Recognition Evaluation — e2-final / local-fallback

- Run ID: `local-fallback-2026-08-08T14-39-05-501Z`
- Dataset: `e2-holdout-1.0.0` (40 samples)
- Observed Prompt: `recognition-2.1.0`
- Model: `local-rules`
- Local recognition source SHA-256: `8787e4f64977e22b587719d8c563467ab7b22eded9217c4be65b4827395279b5`
- Started: 2026-08-08T14:39:05.164Z
- Completed: 2026-08-08T14:39:05.501Z
- Completed cases: 40/40

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 77.50% |
| Milestone Precision | 50.00% |
| Milestone Recall | 37.93% |
| Task Precision | 40.82% |
| Task Recall | 37.74% |
| Material Precision | 84.21% |
| Material Recall | 30.19% |
| TimePoint Precision | 90.00% |
| TimePoint Recall | 90.00% |
| TimePoint Type Accuracy | 28.79% |
| TimePoint Value Accuracy | 21.21% |
| TimePoint Accuracy | 28.79% |
| Event Accuracy | 50.00% |
| Evidence Coverage | 89.07% |
| Evidence Validity | 93.33% |
| Ambiguity Precision | 40.00% |
| Ambiguity Recall | 75.00% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 100.00% |
| Severe Error Rate | 22.50% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 0.00% |
| Repair Trigger Rate | 0.00% |
| Repair Success Rate | NOT OBSERVABLE |
| Repair Latency Mean | NOT OBSERVABLE |
| Repair Latency P95 | NOT OBSERVABLE |
| Retry Rate | 0.00% |
| Latency Mean | 1 ms |
| Latency P50 | 0 ms |
| Latency P95 | 1 ms |
| Token Usage | NOT OBSERVABLE：接口未对每个 operation 回传完整 usage |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 75.00% | 75.00% | 60.00% | 0.00% | 25.00% | 100.00% | 100.00% | 100.00% | 25.00% |
| competition | 75.00% | 50.00% | 37.50% | 50.00% | 37.50% | 50.00% | 79.17% | 100.00% | 0.00% |
| application | 75.00% | 50.00% | 40.00% | 42.86% | 33.33% | 100.00% | 94.74% | 100.00% | 0.00% |
| scholarship | 100.00% | 0.00% | 0.00% | 75.00% | 0.00% | 100.00% | 87.50% | 100.00% | 33.33% |
| meeting | 100.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 100.00% | 100.00% | 66.67% |
| event | 100.00% | 0.00% | 0.00% | 0.00% | 50.00% | 66.67% | 100.00% | 100.00% | 33.33% |
| complex_notice | 50.00% | 45.45% | 45.45% | 18.18% | 50.00% | 66.67% | 97.73% | 100.00% | 0.00% |
| multi_deadline | 33.33% | 50.00% | 50.00% | 40.00% | 22.22% | 100.00% | 100.00% | 100.00% | 0.00% |
| material | 66.67% | 50.00% | 33.33% | 11.11% | 0.00% | 100.00% | 53.85% | 100.00% | 0.00% |
| vague_time | 100.00% | 50.00% | 25.00% | 100.00% | 0.00% | 0.00% | 100.00% | 100.00% | 0.00% |
| information_only | 100.00% | 0.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% | 100.00% | 100.00% |
| ocr_noise | 50.00% | 0.00% | 0.00% | 0.00% | 50.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| security | 100.00% | 50.00% | 50.00% | 50.00% | 0.00% | 100.00% | 0.00% | 100.00% | 100.00% |

## Error taxonomy

| Category | Count |
| --- | ---: |
| time_incorrect | 41 |
| material_missing | 37 |
| task_missing | 33 |
| task_spurious | 24 |
| ambiguity_spurious | 23 |
| milestone_missing | 18 |
| evidence_missing | 9 |
| project_decision | 9 |
| event_missing | 8 |
| ambiguity_missing | 6 |
| time_spurious | 6 |
| evidence_invalid | 4 |
| forbidden_output | 4 |
| material_spurious | 3 |
| event_spurious | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
