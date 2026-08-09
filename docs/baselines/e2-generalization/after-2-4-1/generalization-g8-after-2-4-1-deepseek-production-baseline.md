# E2 Recognition Evaluation — g8-after-2-4-1 / deepseek-production

- Run ID: `deepseek-production-2026-08-09T07-40-32-969Z`
- Dataset: `e2-generalization-development-1.0.0` (108 samples)
- Observed Prompt: `recognition-2.4.1`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `9d958e3e3073eec2c9de66f6921c9b8aeecd0eb926d0b5386ca3886e6238ec31`
- Started: 2026-08-09T07:12:25.743Z
- Completed: 2026-08-09T07:40:32.969Z
- Completed cases: 108/108

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 90.74% |
| Milestone Precision | 32.94% |
| Milestone Recall | 58.33% |
| Task Precision | 82.17% |
| Task Recall | 75.71% |
| Material Precision | 97.87% |
| Material Recall | 93.24% |
| TimePoint Precision | 92.11% |
| TimePoint Recall | 94.59% |
| TimePoint Type Accuracy | 78.85% |
| TimePoint Value Accuracy | 74.36% |
| TimePoint Accuracy | 75.00% |
| Event Accuracy | 93.94% |
| Evidence Coverage | 98.72% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 60.78% |
| Ambiguity Recall | 51.67% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 67.59% |
| Severe Error Rate | 0.00% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 0.00% |
| Repair Trigger Rate | 9.26% |
| Repair Applied Rate | 100.00% |
| Repair Success Rate | 10.00% |
| Repair Harm Rate | 0.00% |
| Repair Latency Mean | 2813 ms |
| Repair Latency P95 | 3504 ms |
| Retry Rate | 0.00% |
| Latency Mean | 7671 ms |
| Latency P50 | 7351 ms |
| Latency P95 | 11788 ms |
| Token Usage | 291508 input / 157438 output |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 87.50% | 90.91% | 83.33% | 70.83% | 93.75% | 100.00% | 98.44% | 75.00% | 0.00% |
| competition | 100.00% | 75.00% | 75.00% | 100.00% | 81.25% | 100.00% | 100.00% | 87.50% | 0.00% |
| application | 100.00% | 61.54% | 66.67% | 100.00% | 83.33% | 100.00% | 100.00% | 75.00% | 0.00% |
| scholarship | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% | 100.00% | 50.00% | 0.00% |
| meeting | 100.00% | 66.67% | 50.00% | 100.00% | 100.00% | 100.00% | 100.00% | 75.00% | 0.00% |
| event | 100.00% | 100.00% | 75.00% | 87.50% | 90.00% | 100.00% | 100.00% | 83.33% | 0.00% |
| multi_deadline | 100.00% | 100.00% | 87.50% | 91.67% | 58.33% | 100.00% | 98.91% | 75.00% | 0.00% |
| vague_time | 62.50% | 50.00% | 50.00% | 100.00% | 57.14% | 75.00% | 89.29% | 100.00% | 0.00% |
| material | 91.67% | 64.29% | 56.25% | 100.00% | 100.00% | 100.00% | 100.00% | 33.33% | 0.00% |
| information_only | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| ocr_noise | 0.00% | 75.00% | 75.00% | 100.00% | 100.00% | 100.00% | 93.75% | 100.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| complex_notice | 100.00% | 91.67% | 91.67% | 100.00% | 88.89% | 100.00% | 100.00% | 25.00% | 0.00% |

## Complexity profile

| Route | Cases | Latency mean | P50 | P95 | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 69 | 6847 ms | 6949 ms | 8885 ms | 178015 | 87332 |
| medium | 37 | 8693 ms | 8514 ms | 13058 ms | 98846 | 63168 |
| complex | 2 | 17173 ms | 17055 ms | 17291 ms | 14647 | 6938 |
| unknown | 0 | 0 ms | 0 ms | 0 ms | NOT OBSERVABLE | NOT OBSERVABLE |

## Operation tokens

| Operation | Input | Output |
| --- | ---: | ---: |
| recognize | 255843 | 152861 |
| repair | 35665 | 4577 |
| extractFacts | NOT OBSERVABLE | NOT OBSERVABLE |

## Error taxonomy

| Category | Count |
| --- | ---: |
| task_missing | 34 |
| ambiguity_missing | 29 |
| time_incorrect | 23 |
| task_spurious | 22 |
| milestone_missing | 20 |
| ambiguity_spurious | 19 |
| project_decision | 11 |
| material_missing | 10 |
| milestone_spurious | 10 |
| time_spurious | 10 |
| time_missing | 8 |
| evidence_missing | 6 |
| material_spurious | 3 |
| event_missing | 1 |
| event_spurious | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
