# E2 Recognition Evaluation — e2-final / local-fallback

- Run ID: `local-fallback-2026-08-08T14-39-02-819Z`
- Dataset: `e2-a-golden-1.0.0` (110 samples)
- Observed Prompt: `recognition-2.1.0`
- Model: `local-rules`
- Local recognition source SHA-256: `8787e4f64977e22b587719d8c563467ab7b22eded9217c4be65b4827395279b5`
- Started: 2026-08-08T14:39:00.422Z
- Completed: 2026-08-08T14:39:02.819Z
- Completed cases: 110/110

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 79.09% |
| Milestone Precision | 58.97% |
| Milestone Recall | 31.51% |
| Task Precision | 69.40% |
| Task Recall | 73.23% |
| Material Precision | 86.76% |
| Material Recall | 58.42% |
| TimePoint Precision | 90.85% |
| TimePoint Recall | 98.58% |
| TimePoint Type Accuracy | 25.81% |
| TimePoint Value Accuracy | 41.29% |
| TimePoint Accuracy | 25.81% |
| Event Accuracy | 52.00% |
| Evidence Coverage | 87.94% |
| Evidence Validity | 90.20% |
| Ambiguity Precision | 28.74% |
| Ambiguity Recall | 92.59% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 94.55% |
| Severe Error Rate | 18.18% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 0.00% |
| Repair Trigger Rate | 0.00% |
| Repair Success Rate | NOT OBSERVABLE |
| Repair Latency Mean | NOT OBSERVABLE |
| Repair Latency P95 | NOT OBSERVABLE |
| Retry Rate | 0.00% |
| Latency Mean | 0 ms |
| Latency P50 | 0 ms |
| Latency P95 | 1 ms |
| Token Usage | NOT OBSERVABLE：接口未对每个 operation 回传完整 usage |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 80.00% | 80.00% | 72.73% | 88.89% | 18.18% | 50.00% | 100.00% | 90.00% | 10.00% |
| complex_notice | 50.00% | 59.26% | 59.26% | 34.78% | 32.35% | 55.56% | 75.86% | 100.00% | 10.00% |
| competition | 30.00% | 90.00% | 90.00% | 20.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| application | 100.00% | 80.00% | 80.00% | 50.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| event | 90.00% | 100.00% | 100.00% | 100.00% | 100.00% | 60.00% | 80.00% | 50.00% | 0.00% |
| multi_deadline | 100.00% | 100.00% | 100.00% | 100.00% | 33.33% | 100.00% | 100.00% | 100.00% | 0.00% |
| material | 100.00% | 90.00% | 90.00% | 40.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| vague_time | 60.00% | 0.00% | 0.00% | 100.00% | 60.00% | 0.00% | 100.00% | 100.00% | 10.00% |
| information_only | 70.00% | 0.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% | 100.00% | 100.00% |
| ocr_noise | 90.00% | 66.67% | 60.00% | 22.22% | 10.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| security | 100.00% | 70.00% | 70.00% | 100.00% | 0.00% | 100.00% | 0.00% | 100.00% | 70.00% |

## Error taxonomy

| Category | Count |
| --- | ---: |
| time_incorrect | 101 |
| ambiguity_spurious | 52 |
| milestone_missing | 50 |
| material_missing | 42 |
| task_spurious | 37 |
| task_missing | 34 |
| project_decision | 23 |
| evidence_missing | 18 |
| evidence_invalid | 15 |
| time_spurious | 13 |
| event_missing | 10 |
| forbidden_output | 8 |
| material_spurious | 8 |
| event_spurious | 6 |
| ambiguity_missing | 2 |
| task_hierarchy | 2 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
