# E2-A Recognition Baseline — deepseek-production

- Run ID: `deepseek-production-2026-08-08T13-04-07-666Z`
- Dataset: `e2-a-golden-1.0.0` (110 samples)
- Prompt: `recognition-2.0.0`
- Model: `deepseek-v4-flash`
- Production recognition source SHA-256: `75e0bcdf8e09f88241e92d8cc97fc18bdf2362c80ff355192e904443f9f57793`
- Started: 2026-08-08T12:38:00.856Z
- Completed: 2026-08-08T13:04:07.666Z
- Completed cases: 108/110

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 84.55% |
| Milestone Precision | 52.17% |
| Milestone Recall | 16.44% |
| Task Precision | 81.90% |
| Task Recall | 74.80% |
| Material Recall | 30.69% |
| TimePoint Accuracy | 6.38% |
| Event Accuracy | 86.96% |
| Evidence Coverage | 95.33% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 87.27% |
| Severe Error Rate | 5.45% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 1.82% |
| Latency Mean | 6266 ms |
| Latency P50 | 5698 ms |
| Latency P95 | 12725 ms |
| Token Usage | NOT OBSERVABLE：现有生产接口未回传 usage |
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

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
