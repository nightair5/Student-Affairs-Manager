# E2 Recognition Evaluation — before / deepseek-production

- Run ID: `deepseek-production-2026-08-08T14-39-42-129Z`
- Dataset: `e2-a-golden-1.0.0` (110 samples)
- Observed Prompt: `recognition-2.0.0`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `8787e4f64977e22b587719d8c563467ab7b22eded9217c4be65b4827395279b5`
- Started: 2026-08-08T14:39:41.183Z
- Completed: 2026-08-08T14:39:42.129Z
- Completed cases: 108/110

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 84.55% |
| Milestone Precision | 52.17% |
| Milestone Recall | 16.44% |
| Task Precision | 81.90% |
| Task Recall | 74.80% |
| Material Precision | 96.88% |
| Material Recall | 30.69% |
| TimePoint Precision | 100.00% |
| TimePoint Recall | 6.38% |
| TimePoint Type Accuracy | 6.38% |
| TimePoint Value Accuracy | 4.96% |
| TimePoint Accuracy | 6.38% |
| Event Accuracy | 86.96% |
| Evidence Coverage | 95.33% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 0.00% |
| Ambiguity Recall | 0.00% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 87.27% |
| Severe Error Rate | 5.45% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 1.82% |
| Repair Trigger Rate | 0.00% |
| Repair Success Rate | NOT OBSERVABLE |
| Repair Latency Mean | NOT OBSERVABLE |
| Repair Latency P95 | NOT OBSERVABLE |
| Retry Rate | 0.00% |
| Latency Mean | 6266 ms |
| Latency P50 | 5698 ms |
| Latency P95 | 12725 ms |
| Token Usage | NOT OBSERVABLE：接口未对每个 operation 回传完整 usage |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 90.00% | 90.00% | 81.82% | 11.11% | 0.00% | 50.00% | 100.00% | 90.00% | 10.00% |
| complex_notice | 90.00% | 65.00% | 48.15% | 73.91% | 6.45% | 88.89% | 86.21% | 100.00% | 10.00% |
| competition | 60.00% | 100.00% | 60.00% | 50.00% | 0.00% | 100.00% | 90.00% | 100.00% | 10.00% |
| application | 0.00% | 90.00% | 90.00% | 40.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| event | 100.00% | 0.00% | 100.00% | 100.00% | 70.00% | 100.00% | 80.00% | 60.00% | 20.00% |
| multi_deadline | 90.00% | 100.00% | 100.00% | 0.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| material | 100.00% | 100.00% | 100.00% | 30.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| vague_time | 100.00% | 0.00% | 0.00% | 100.00% | 0.00% | 0.00% | 100.00% | 100.00% | 0.00% |
| information_only | 100.00% | 0.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 10.00% | 10.00% |
| ocr_noise | 100.00% | 88.89% | 80.00% | 11.11% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |

## Error taxonomy

| Category | Count |
| --- | ---: |
| time_missing | 127 |
| ambiguity_spurious | 77 |
| material_missing | 67 |
| milestone_missing | 56 |
| project_decision | 29 |
| task_missing | 29 |
| ambiguity_missing | 26 |
| task_spurious | 17 |
| evidence_missing | 6 |
| event_missing | 2 |
| request_failure | 2 |
| task_hierarchy | 2 |
| material_spurious | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
