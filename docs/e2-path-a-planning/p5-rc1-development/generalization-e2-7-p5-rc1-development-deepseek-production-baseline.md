# E2 Recognition Evaluation — e2-7-p5-rc1-development / deepseek-production

- Run ID: `deepseek-production-2026-08-11T11-10-34-384Z`
- Dataset: `e2-generalization-development-1.0.0` (108 samples)
- Observed Prompt: `recognition-2.5.0-rc.1`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `de5afa6afad5ed2171f35ab60cb4dc311dd04367eb33fb1d1383cf9aa4de5eaf`
- Started: 2026-08-11T10:41:12.868Z
- Completed: 2026-08-11T11:10:34.384Z
- Completed cases: 108/108

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 96.30% |
| Milestone Precision | 40.98% |
| Milestone Recall | 52.08% |
| Task Precision | 79.17% |
| Task Recall | 81.43% |
| Material Precision | 97.14% |
| Material Recall | 91.89% |
| TimePoint Precision | 91.61% |
| TimePoint Recall | 95.95% |
| TimePoint Type Accuracy | 76.77% |
| TimePoint Value Accuracy | 78.06% |
| TimePoint Accuracy | 74.19% |
| Event Accuracy | 64.71% |
| Evidence Coverage | 98.93% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 57.38% |
| Ambiguity Recall | 58.33% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 62.96% |
| Severe Error Rate | 0.00% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 0.00% |
| Repair Trigger Rate | 10.19% |
| Repair Applied Rate | 100.00% |
| Repair Success Rate | 0.00% |
| Repair Harm Rate | 0.00% |
| Repair Latency Mean | 2701 ms |
| Repair Latency P95 | 3255 ms |
| Retry Rate | 0.00% |
| Latency Mean | 8359 ms |
| Latency P50 | 7959 ms |
| Latency P95 | 12396 ms |
| Token Usage | 330435 input / 154820 output |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 100.00% | 91.67% | 91.67% | 62.50% | 100.00% | 100.00% | 95.31% | 75.00% | 0.00% |
| competition | 100.00% | 66.67% | 66.67% | 100.00% | 75.00% | 100.00% | 100.00% | 75.00% | 0.00% |
| application | 100.00% | 69.23% | 75.00% | 100.00% | 75.00% | 100.00% | 100.00% | 75.00% | 0.00% |
| scholarship | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% | 100.00% | 50.00% | 0.00% |
| meeting | 100.00% | 75.00% | 75.00% | 100.00% | 100.00% | 100.00% | 100.00% | 50.00% | 0.00% |
| event | 100.00% | 50.00% | 75.00% | 75.00% | 50.00% | 50.00% | 98.08% | 83.33% | 0.00% |
| multi_deadline | 100.00% | 96.88% | 96.88% | 95.83% | 72.22% | 100.00% | 98.91% | 75.00% | 0.00% |
| vague_time | 100.00% | 50.00% | 50.00% | 100.00% | 76.92% | 50.00% | 100.00% | 75.00% | 0.00% |
| material | 100.00% | 66.67% | 62.50% | 100.00% | 100.00% | 100.00% | 100.00% | 25.00% | 0.00% |
| information_only | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| ocr_noise | 0.00% | 75.00% | 75.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| complex_notice | 100.00% | 91.67% | 91.67% | 100.00% | 88.89% | 100.00% | 100.00% | 25.00% | 0.00% |

## Complexity profile

| Route | Cases | Latency mean | P50 | P95 | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 69 | 7567 ms | 7443 ms | 10156 ms | 203845 | 84972 |
| medium | 37 | 9391 ms | 9540 ms | 15128 ms | 110929 | 63343 |
| complex | 2 | 16580 ms | 16397 ms | 16763 ms | 15661 | 6505 |
| unknown | 0 | 0 ms | 0 ms | 0 ms | NOT OBSERVABLE | NOT OBSERVABLE |

## Operation tokens

| Operation | Input | Output |
| --- | ---: | ---: |
| recognize | 288027 | 150273 |
| repair | 42408 | 4547 |
| extractFacts | NOT OBSERVABLE | NOT OBSERVABLE |

## Error taxonomy

| Category | Count |
| --- | ---: |
| task_spurious | 27 |
| time_incorrect | 27 |
| task_missing | 26 |
| ambiguity_missing | 25 |
| milestone_missing | 23 |
| ambiguity_spurious | 22 |
| material_missing | 12 |
| time_spurious | 11 |
| event_missing | 10 |
| milestone_spurious | 6 |
| time_missing | 6 |
| evidence_missing | 5 |
| project_decision | 5 |
| material_spurious | 4 |
| event_spurious | 2 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
