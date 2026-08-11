# E2 Recognition Evaluation — e2-7-p5-rc2-development / deepseek-production

- Run ID: `deepseek-production-2026-08-11T11-48-55-880Z`
- Dataset: `e2-generalization-development-1.0.0` (108 samples)
- Observed Prompt: `recognition-2.5.0-rc.2`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `de5afa6afad5ed2171f35ab60cb4dc311dd04367eb33fb1d1383cf9aa4de5eaf`
- Started: 2026-08-11T11:20:05.082Z
- Completed: 2026-08-11T11:48:55.880Z
- Completed cases: 100/108

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 87.96% |
| Milestone Precision | 50.94% |
| Milestone Recall | 56.25% |
| Task Precision | 77.95% |
| Task Recall | 70.71% |
| Material Precision | 97.69% |
| Material Recall | 85.81% |
| TimePoint Precision | 89.36% |
| TimePoint Recall | 85.14% |
| TimePoint Type Accuracy | 69.62% |
| TimePoint Value Accuracy | 68.35% |
| TimePoint Accuracy | 65.19% |
| Event Accuracy | 81.25% |
| Evidence Coverage | 87.61% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 51.92% |
| Ambiguity Recall | 45.00% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.93% |
| Major Correction Rate | 65.74% |
| Severe Error Rate | 8.33% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 7.41% |
| Repair Trigger Rate | 10.00% |
| Repair Applied Rate | 100.00% |
| Repair Success Rate | 0.00% |
| Repair Harm Rate | 0.00% |
| Repair Latency Mean | 2629 ms |
| Repair Latency P95 | 3253 ms |
| Retry Rate | 0.00% |
| Latency Mean | 8076 ms |
| Latency P50 | 7809 ms |
| Latency P95 | 12075 ms |
| Token Usage | NOT OBSERVABLE：接口未对每个 operation 回传完整 usage |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 100.00% | 88.00% | 91.67% | 83.33% | 88.24% | 100.00% | 96.88% | 50.00% | 0.00% |
| competition | 100.00% | 83.33% | 83.33% | 100.00% | 87.50% | 100.00% | 100.00% | 75.00% | 0.00% |
| application | 91.67% | 50.00% | 66.67% | 89.29% | 66.67% | 100.00% | 90.38% | 83.33% | 8.33% |
| scholarship | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% | 50.00% | 0.00% |
| meeting | 100.00% | 60.00% | 37.50% | 100.00% | 100.00% | 100.00% | 100.00% | 75.00% | 0.00% |
| event | 91.67% | 83.33% | 62.50% | 75.00% | 75.00% | 87.50% | 86.54% | 83.33% | 16.67% |
| multi_deadline | 66.67% | 96.15% | 78.13% | 79.17% | 47.22% | 100.00% | 80.43% | 91.67% | 16.67% |
| vague_time | 87.50% | 42.86% | 37.50% | 75.00% | 53.85% | 25.00% | 75.00% | 87.50% | 12.50% |
| material | 100.00% | 60.00% | 56.25% | 100.00% | 100.00% | 100.00% | 100.00% | 33.33% | 0.00% |
| information_only | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| ocr_noise | 0.00% | 100.00% | 75.00% | 75.00% | 75.00% | 100.00% | 68.75% | 100.00% | 25.00% |
| security | 75.00% | 100.00% | 75.00% | 75.00% | 0.00% | 100.00% | 75.00% | 100.00% | 25.00% |
| complex_notice | 75.00% | 88.89% | 66.67% | 75.00% | 60.00% | 75.00% | 75.00% | 50.00% | 25.00% |

## Complexity profile

| Route | Cases | Latency mean | P50 | P95 | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 66 | 7556 ms | 7711 ms | 10131 ms | 208390 | 79764 |
| medium | 33 | 9678 ms | 10232 ms | 12976 ms | 100842 | 57660 |
| complex | 1 | 13958 ms | 13958 ms | 13958 ms | 8255 | 3565 |
| unknown | 8 | 5032 ms | 5030 ms | 5043 ms | NOT OBSERVABLE | NOT OBSERVABLE |

## Operation tokens

| Operation | Input | Output |
| --- | ---: | ---: |
| recognize | 278660 | 136586 |
| repair | 38827 | 4403 |
| extractFacts | NOT OBSERVABLE | NOT OBSERVABLE |

## Error taxonomy

| Category | Count |
| --- | ---: |
| ambiguity_missing | 28 |
| task_missing | 27 |
| task_spurious | 23 |
| time_incorrect | 23 |
| ambiguity_spurious | 21 |
| milestone_missing | 17 |
| time_spurious | 12 |
| project_decision | 11 |
| evidence_missing | 8 |
| request_failure | 8 |
| material_missing | 6 |
| time_missing | 6 |
| milestone_spurious | 4 |
| event_missing | 3 |
| material_spurious | 3 |
| over_fragmentation | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
