# E2 Recognition Evaluation — g8-regression-2-4-1 / deepseek-production

- Run ID: `deepseek-production-2026-08-09T08-18-37-171Z`
- Dataset: `e2-holdout-1.0.0` (40 samples)
- Observed Prompt: `recognition-2.4.1`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `9d958e3e3073eec2c9de66f6921c9b8aeecd0eb926d0b5386ca3886e6238ec31`
- Started: 2026-08-09T08:08:11.587Z
- Completed: 2026-08-09T08:18:37.171Z
- Completed cases: 40/40

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 97.50% |
| Milestone Precision | 55.17% |
| Milestone Recall | 55.17% |
| Task Precision | 77.27% |
| Task Recall | 64.15% |
| Material Precision | 98.08% |
| Material Recall | 96.23% |
| TimePoint Precision | 87.93% |
| TimePoint Recall | 85.00% |
| TimePoint Type Accuracy | 76.67% |
| TimePoint Value Accuracy | 75.00% |
| TimePoint Accuracy | 76.67% |
| Event Accuracy | 82.35% |
| Evidence Coverage | 96.72% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 69.57% |
| Ambiguity Recall | 66.67% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 67.50% |
| Severe Error Rate | 0.00% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 0.00% |
| Repair Trigger Rate | 30.00% |
| Repair Applied Rate | 75.00% |
| Repair Success Rate | 0.00% |
| Repair Harm Rate | 0.00% |
| Repair Latency Mean | 2224 ms |
| Repair Latency P95 | 2894 ms |
| Retry Rate | 0.00% |
| Latency Mean | 7781 ms |
| Latency P50 | 7321 ms |
| Latency P95 | 14225 ms |
| Token Usage | 137202 input / 58426 output |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 100.00% | 75.00% | 60.00% | 100.00% | 100.00% | 100.00% | 100.00% | 50.00% | 0.00% |
| competition | 100.00% | 66.67% | 50.00% | 100.00% | 100.00% | 100.00% | 95.83% | 100.00% | 0.00% |
| application | 100.00% | 100.00% | 80.00% | 100.00% | 50.00% | 100.00% | 94.74% | 100.00% | 0.00% |
| scholarship | 100.00% | 0.00% | 0.00% | 100.00% | 50.00% | 100.00% | 87.50% | 66.67% | 0.00% |
| meeting | 100.00% | 100.00% | 100.00% | 100.00% | 66.67% | 66.67% | 100.00% | 33.33% | 0.00% |
| event | 100.00% | 100.00% | 0.00% | 100.00% | 75.00% | 66.67% | 100.00% | 66.67% | 0.00% |
| complex_notice | 100.00% | 88.89% | 72.73% | 100.00% | 81.25% | 100.00% | 97.73% | 100.00% | 0.00% |
| multi_deadline | 100.00% | 87.50% | 87.50% | 100.00% | 77.78% | 100.00% | 100.00% | 33.33% | 0.00% |
| material | 66.67% | 33.33% | 33.33% | 88.89% | 100.00% | 100.00% | 84.62% | 66.67% | 0.00% |
| vague_time | 100.00% | 66.67% | 50.00% | 0.00% | 50.00% | 0.00% | 100.00% | 100.00% | 0.00% |
| information_only | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| ocr_noise | 100.00% | 100.00% | 50.00% | 100.00% | 100.00% | 100.00% | 100.00% | 50.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 100.00% | 50.00% | 100.00% | 100.00% | 50.00% | 0.00% |

## Complexity profile

| Route | Cases | Latency mean | P50 | P95 | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 18 | 6094 ms | 6221 ms | 7971 ms | 54271 | 19447 |
| medium | 18 | 7983 ms | 7886 ms | 12654 ms | 60010 | 27247 |
| complex | 4 | 14463 ms | 14225 ms | 15705 ms | 22921 | 11732 |
| unknown | 0 | 0 ms | 0 ms | 0 ms | NOT OBSERVABLE | NOT OBSERVABLE |

## Operation tokens

| Operation | Input | Output |
| --- | ---: | ---: |
| recognize | 94318 | 54753 |
| repair | 42884 | 3673 |
| extractFacts | NOT OBSERVABLE | NOT OBSERVABLE |

## Error taxonomy

| Category | Count |
| --- | ---: |
| task_missing | 19 |
| milestone_missing | 13 |
| task_spurious | 10 |
| time_missing | 9 |
| ambiguity_missing | 8 |
| ambiguity_spurious | 7 |
| evidence_missing | 6 |
| time_incorrect | 5 |
| time_spurious | 5 |
| event_missing | 3 |
| material_missing | 2 |
| material_spurious | 1 |
| milestone_spurious | 1 |
| project_decision | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
