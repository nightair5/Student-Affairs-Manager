# E2 Recognition Evaluation — after-2-3-golden-pass / deepseek-production

- Run ID: `deepseek-production-2026-08-08T19-29-34-147Z`
- Dataset: `e2-a-golden-1.0.0` (110 samples)
- Observed Prompt: `recognition-2.3.0`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `c2732ce95e9033837c50c73d052cb1c3f8b560b023c3731b8d25998fb1b7e71a`
- Started: 2026-08-08T19:00:02.656Z
- Completed: 2026-08-08T19:29:34.147Z
- Completed cases: 110/110

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 97.27% |
| Milestone Precision | 59.26% |
| Milestone Recall | 21.92% |
| Task Precision | 86.61% |
| Task Recall | 86.61% |
| Material Precision | 93.40% |
| Material Recall | 98.02% |
| TimePoint Precision | 97.90% |
| TimePoint Recall | 99.29% |
| TimePoint Type Accuracy | 92.36% |
| TimePoint Value Accuracy | 78.47% |
| TimePoint Accuracy | 91.67% |
| Event Accuracy | 91.30% |
| Evidence Coverage | 98.05% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 34.04% |
| Ambiguity Recall | 59.26% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 30.91% |
| Severe Error Rate | 0.00% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 0.00% |
| Repair Trigger Rate | 15.45% |
| Repair Success Rate | 29.41% |
| Repair Latency Mean | 8926 ms |
| Repair Latency P95 | 12330 ms |
| Retry Rate | 0.00% |
| Latency Mean | 8153 ms |
| Latency P50 | 6017 ms |
| Latency P95 | 20983 ms |
| Token Usage | 268472 input / 158683 output |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 90.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 20.00% | 0.00% |
| complex_notice | 90.00% | 80.77% | 77.78% | 95.65% | 82.35% | 88.89% | 100.00% | 80.00% | 0.00% |
| competition | 100.00% | 90.91% | 100.00% | 100.00% | 90.00% | 100.00% | 100.00% | 10.00% | 0.00% |
| application | 90.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 97.50% | 10.00% | 0.00% |
| event | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 80.00% | 40.00% | 0.00% |
| multi_deadline | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| material | 100.00% | 90.91% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| vague_time | 100.00% | 0.00% | 0.00% | 100.00% | 70.00% | 0.00% | 100.00% | 100.00% | 0.00% |
| information_only | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| ocr_noise | 100.00% | 88.89% | 80.00% | 88.89% | 80.00% | 100.00% | 100.00% | 80.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |

## Error taxonomy

| Category | Count |
| --- | ---: |
| milestone_missing | 57 |
| ambiguity_spurious | 29 |
| task_missing | 17 |
| task_spurious | 15 |
| ambiguity_missing | 11 |
| time_incorrect | 8 |
| material_spurious | 7 |
| evidence_missing | 5 |
| task_hierarchy | 4 |
| milestone_spurious | 3 |
| project_decision | 3 |
| event_missing | 2 |
| material_missing | 2 |
| time_spurious | 2 |
| event_spurious | 1 |
| time_missing | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
