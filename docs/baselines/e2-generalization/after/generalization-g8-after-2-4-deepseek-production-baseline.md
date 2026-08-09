# E2 Recognition Evaluation — g8-after-2-4 / deepseek-production

- Run ID: `deepseek-production-2026-08-09T07-02-42-076Z`
- Dataset: `e2-generalization-development-1.0.0` (108 samples)
- Observed Prompt: `recognition-2.4.0`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `c2732ce95e9033837c50c73d052cb1c3f8b560b023c3731b8d25998fb1b7e71a`
- Started: 2026-08-09T06:34:16.659Z
- Completed: 2026-08-09T07:02:42.076Z
- Completed cases: 108/108

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 92.59% |
| Milestone Precision | 36.49% |
| Milestone Recall | 56.25% |
| Task Precision | 61.24% |
| Task Recall | 77.86% |
| Material Precision | 98.59% |
| Material Recall | 94.59% |
| TimePoint Precision | 90.79% |
| TimePoint Recall | 93.24% |
| TimePoint Type Accuracy | 77.71% |
| TimePoint Value Accuracy | 77.07% |
| TimePoint Accuracy | 75.80% |
| Event Accuracy | 85.29% |
| Evidence Coverage | 98.08% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 62.22% |
| Ambiguity Recall | 46.67% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 7.41% |
| Major Correction Rate | 70.37% |
| Severe Error Rate | 0.00% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 0.00% |
| Repair Trigger Rate | 13.89% |
| Repair Applied Rate | 86.67% |
| Repair Success Rate | 6.67% |
| Repair Harm Rate | 0.00% |
| Repair Latency Mean | 2578 ms |
| Repair Latency P95 | 2996 ms |
| Retry Rate | 0.00% |
| Latency Mean | 7840 ms |
| Latency P50 | 6906 ms |
| Latency P95 | 12589 ms |
| Token Usage | 280875 input / 160117 output |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 100.00% | 80.00% | 83.33% | 75.00% | 93.75% | 100.00% | 96.88% | 68.75% | 0.00% |
| competition | 100.00% | 50.00% | 66.67% | 100.00% | 87.50% | 100.00% | 100.00% | 87.50% | 0.00% |
| application | 100.00% | 23.33% | 58.33% | 100.00% | 75.00% | 100.00% | 98.08% | 91.67% | 0.00% |
| scholarship | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% | 100.00% | 50.00% | 0.00% |
| meeting | 100.00% | 66.67% | 50.00% | 100.00% | 100.00% | 100.00% | 100.00% | 75.00% | 0.00% |
| event | 100.00% | 100.00% | 75.00% | 87.50% | 95.00% | 100.00% | 94.23% | 75.00% | 0.00% |
| multi_deadline | 100.00% | 96.88% | 96.88% | 95.83% | 69.44% | 100.00% | 98.91% | 83.33% | 0.00% |
| vague_time | 50.00% | 50.00% | 50.00% | 100.00% | 33.33% | 25.00% | 92.86% | 87.50% | 0.00% |
| material | 100.00% | 45.83% | 68.75% | 100.00% | 100.00% | 100.00% | 100.00% | 58.33% | 0.00% |
| information_only | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| ocr_noise | 0.00% | 42.86% | 75.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| complex_notice | 100.00% | 55.00% | 91.67% | 100.00% | 88.89% | 100.00% | 100.00% | 25.00% | 0.00% |

## Complexity profile

| Route | Cases | Latency mean | P50 | P95 | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 69 | 6985 ms | 6374 ms | 11434 ms | 161894 | 88948 |
| medium | 37 | 8952 ms | 8953 ms | 16885 ms | 104885 | 64617 |
| complex | 2 | 16754 ms | 16539 ms | 16968 ms | 14096 | 6552 |
| unknown | 0 | 0 ms | 0 ms | 0 ms | NOT OBSERVABLE | NOT OBSERVABLE |

## Operation tokens

| Operation | Input | Output |
| --- | ---: | ---: |
| recognize | 227871 | 153846 |
| repair | 53004 | 6271 |
| extractFacts | NOT OBSERVABLE | NOT OBSERVABLE |

## Error taxonomy

| Category | Count |
| --- | ---: |
| task_spurious | 38 |
| ambiguity_missing | 32 |
| task_missing | 31 |
| milestone_missing | 21 |
| time_incorrect | 19 |
| ambiguity_spurious | 16 |
| time_spurious | 12 |
| project_decision | 10 |
| time_missing | 10 |
| evidence_missing | 9 |
| material_missing | 8 |
| milestone_spurious | 8 |
| over_fragmentation | 8 |
| event_missing | 3 |
| event_spurious | 2 |
| material_spurious | 2 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
