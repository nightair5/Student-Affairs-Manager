# E2 Recognition Evaluation — before / deepseek-production

- Run ID: `deepseek-production-2026-08-08T14-39-44-986Z`
- Dataset: `e2-holdout-1.0.0` (40 samples)
- Observed Prompt: `recognition-2.0.0`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `8787e4f64977e22b587719d8c563467ab7b22eded9217c4be65b4827395279b5`
- Started: 2026-08-08T14:39:43.923Z
- Completed: 2026-08-08T14:39:44.986Z
- Completed cases: 38/40

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 80.00% |
| Milestone Precision | 83.33% |
| Milestone Recall | 34.48% |
| Task Precision | 68.57% |
| Task Recall | 45.28% |
| Material Precision | 94.44% |
| Material Recall | 32.08% |
| TimePoint Precision | 100.00% |
| TimePoint Recall | 3.33% |
| TimePoint Type Accuracy | 3.33% |
| TimePoint Value Accuracy | 3.33% |
| TimePoint Accuracy | 3.33% |
| Event Accuracy | 66.67% |
| Evidence Coverage | 83.61% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 0.00% |
| Ambiguity Recall | 0.00% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 90.00% |
| Severe Error Rate | 10.00% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 5.00% |
| Repair Trigger Rate | 0.00% |
| Repair Success Rate | NOT OBSERVABLE |
| Repair Latency Mean | NOT OBSERVABLE |
| Repair Latency P95 | NOT OBSERVABLE |
| Retry Rate | 0.00% |
| Latency Mean | 6854 ms |
| Latency P50 | 6056 ms |
| Latency P95 | 13211 ms |
| Token Usage | NOT OBSERVABLE：接口未对每个 operation 回传完整 usage |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 100.00% | 66.67% | 40.00% | 0.00% | 0.00% | 100.00% | 100.00% | 75.00% | 0.00% |
| competition | 75.00% | 66.67% | 25.00% | 16.67% | 0.00% | 100.00% | 91.67% | 100.00% | 0.00% |
| application | 25.00% | 75.00% | 60.00% | 57.14% | 0.00% | 100.00% | 89.47% | 100.00% | 0.00% |
| scholarship | 66.67% | 33.33% | 50.00% | 100.00% | 0.00% | 100.00% | 87.50% | 100.00% | 33.33% |
| meeting | 100.00% | 0.00% | 0.00% | 100.00% | 33.33% | 66.67% | 100.00% | 66.67% | 0.00% |
| event | 100.00% | 0.00% | 0.00% | 0.00% | 25.00% | 100.00% | 100.00% | 100.00% | 33.33% |
| complex_notice | 50.00% | 100.00% | 27.27% | 18.18% | 0.00% | 50.00% | 47.73% | 100.00% | 50.00% |
| multi_deadline | 66.67% | 87.50% | 87.50% | 0.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| material | 100.00% | 33.33% | 33.33% | 33.33% | 0.00% | 100.00% | 84.62% | 100.00% | 0.00% |
| vague_time | 100.00% | 66.67% | 50.00% | 0.00% | 0.00% | 0.00% | 100.00% | 100.00% | 0.00% |
| information_only | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 100.00% | 0.00% | 0.00% |
| ocr_noise | 100.00% | 100.00% | 50.00% | 33.33% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 50.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |

## Error taxonomy

| Category | Count |
| --- | ---: |
| time_missing | 49 |
| material_missing | 30 |
| ambiguity_spurious | 29 |
| task_missing | 24 |
| ambiguity_missing | 22 |
| milestone_missing | 13 |
| task_spurious | 11 |
| project_decision | 9 |
| evidence_missing | 7 |
| event_missing | 2 |
| request_failure | 2 |
| event_spurious | 1 |
| material_spurious | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
