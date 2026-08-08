# E2 Recognition Evaluation — after-2-3-holdout / deepseek-production

- Run ID: `deepseek-production-2026-08-08T19-41-10-019Z`
- Dataset: `e2-holdout-1.0.0` (40 samples)
- Observed Prompt: `recognition-2.3.0`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `c2732ce95e9033837c50c73d052cb1c3f8b560b023c3731b8d25998fb1b7e71a`
- Started: 2026-08-08T19:29:45.319Z
- Completed: 2026-08-08T19:41:10.019Z
- Completed cases: 39/40

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 95.00% |
| Milestone Precision | 66.67% |
| Milestone Recall | 48.28% |
| Task Precision | 70.69% |
| Task Recall | 77.36% |
| Material Precision | 98.15% |
| Material Recall | 100.00% |
| TimePoint Precision | 89.66% |
| TimePoint Recall | 86.67% |
| TimePoint Type Accuracy | 78.69% |
| TimePoint Value Accuracy | 77.05% |
| TimePoint Accuracy | 78.69% |
| Event Accuracy | 82.35% |
| Evidence Coverage | 95.63% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 88.89% |
| Ambiguity Recall | 66.67% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 60.00% |
| Severe Error Rate | 2.50% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 2.50% |
| Repair Trigger Rate | 23.08% |
| Repair Success Rate | 66.67% |
| Repair Latency Mean | 8038 ms |
| Repair Latency P95 | 14342 ms |
| Retry Rate | 0.00% |
| Latency Mean | 9262 ms |
| Latency P50 | 7013 ms |
| Latency P95 | 22876 ms |
| Token Usage | NOT OBSERVABLE：接口未对每个 operation 回传完整 usage |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 75.00% | 80.00% | 80.00% | 100.00% | 100.00% | 100.00% | 100.00% | 50.00% | 25.00% |
| competition | 100.00% | 75.00% | 75.00% | 100.00% | 100.00% | 100.00% | 91.67% | 75.00% | 0.00% |
| application | 75.00% | 57.14% | 80.00% | 100.00% | 66.67% | 100.00% | 94.74% | 100.00% | 0.00% |
| scholarship | 100.00% | 25.00% | 50.00% | 100.00% | 100.00% | 100.00% | 87.50% | 66.67% | 0.00% |
| meeting | 100.00% | 100.00% | 100.00% | 100.00% | 66.67% | 66.67% | 100.00% | 33.33% | 0.00% |
| event | 100.00% | 100.00% | 0.00% | 100.00% | 75.00% | 66.67% | 100.00% | 66.67% | 0.00% |
| complex_notice | 100.00% | 76.92% | 90.91% | 100.00% | 87.50% | 100.00% | 97.73% | 75.00% | 0.00% |
| multi_deadline | 100.00% | 87.50% | 87.50% | 100.00% | 77.78% | 100.00% | 100.00% | 33.33% | 0.00% |
| material | 100.00% | 33.33% | 33.33% | 100.00% | 100.00% | 100.00% | 84.62% | 66.67% | 0.00% |
| vague_time | 100.00% | 66.67% | 50.00% | 100.00% | 20.00% | 0.00% | 90.00% | 100.00% | 0.00% |
| information_only | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| ocr_noise | 100.00% | 66.67% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 100.00% | 50.00% | 100.00% | 100.00% | 50.00% | 0.00% |

## Error taxonomy

| Category | Count |
| --- | ---: |
| milestone_missing | 15 |
| task_missing | 12 |
| task_spurious | 11 |
| ambiguity_missing | 8 |
| evidence_missing | 8 |
| time_missing | 8 |
| time_incorrect | 4 |
| time_spurious | 4 |
| event_missing | 3 |
| ambiguity_spurious | 2 |
| material_spurious | 1 |
| project_decision | 1 |
| request_failure | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
