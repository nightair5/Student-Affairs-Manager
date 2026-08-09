# E2 Recognition Evaluation — g8-regression-2-4-1 / deepseek-production

- Run ID: `deepseek-production-2026-08-09T08-07-56-672Z`
- Dataset: `e2-a-golden-1.0.0` (110 samples)
- Observed Prompt: `recognition-2.4.1`
- Model: `deepseek-v4-flash`
- Local recognition source SHA-256: `9d958e3e3073eec2c9de66f6921c9b8aeecd0eb926d0b5386ca3886e6238ec31`
- Started: 2026-08-09T07:41:31.974Z
- Completed: 2026-08-09T08:07:56.672Z
- Completed cases: 109/110

## Metrics

| Metric | Result |
| --- | ---: |
| Project Decision Accuracy | 97.27% |
| Milestone Precision | 33.87% |
| Milestone Recall | 28.77% |
| Task Precision | 89.08% |
| Task Recall | 83.46% |
| Material Precision | 95.24% |
| Material Recall | 99.01% |
| TimePoint Precision | 97.90% |
| TimePoint Recall | 99.29% |
| TimePoint Type Accuracy | 91.67% |
| TimePoint Value Accuracy | 81.25% |
| TimePoint Accuracy | 91.67% |
| Event Accuracy | 91.30% |
| Evidence Coverage | 98.44% |
| Evidence Validity | 100.00% |
| Ambiguity Precision | 60.00% |
| Ambiguity Recall | 88.89% |
| Duplicate Rate | 0.00% |
| Over-fragmentation Rate | 0.00% |
| Major Correction Rate | 27.27% |
| Severe Error Rate | 1.82% |
| Invalid Output Rate | 0.00% |
| Request Failure Rate | 0.91% |
| Repair Trigger Rate | 6.42% |
| Repair Applied Rate | 71.43% |
| Repair Success Rate | 14.29% |
| Repair Harm Rate | 0.00% |
| Repair Latency Mean | 2222 ms |
| Repair Latency P95 | 3448 ms |
| Retry Rate | 0.00% |
| Latency Mean | 6455 ms |
| Latency P50 | 5767 ms |
| Latency P95 | 11633 ms |
| Token Usage | NOT OBSERVABLE：接口未对每个 operation 回传完整 usage |
| Cost | NOT OBSERVABLE：缺少可归属的 Token usage |

## Group breakdown

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 90.00% | 100.00% | 90.91% | 100.00% | 100.00% | 100.00% | 100.00% | 20.00% | 0.00% |
| complex_notice | 100.00% | 85.71% | 66.67% | 100.00% | 82.35% | 100.00% | 100.00% | 80.00% | 0.00% |
| competition | 100.00% | 100.00% | 100.00% | 100.00% | 90.00% | 100.00% | 100.00% | 10.00% | 0.00% |
| application | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| event | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 90.00% | 80.00% | 40.00% | 0.00% |
| multi_deadline | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 0.00% |
| material | 90.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 20.00% | 0.00% |
| vague_time | 100.00% | 0.00% | 0.00% | 100.00% | 60.00% | 0.00% | 100.00% | 100.00% | 0.00% |
| information_only | 90.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 10.00% | 10.00% |
| ocr_noise | 100.00% | 88.89% | 80.00% | 88.89% | 90.00% | 100.00% | 100.00% | 20.00% | 0.00% |
| security | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% | 10.00% |

## Complexity profile

| Route | Cases | Latency mean | P50 | P95 | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 72 | 5585 ms | 5698 ms | 7106 ms | 184182 | 69873 |
| medium | 31 | 7686 ms | 6335 ms | 12366 ms | 77254 | 46555 |
| complex | 6 | 11598 ms | 11313 ms | 13342 ms | 18246 | 14526 |
| unknown | 1 | 100 ms | 100 ms | 100 ms | NOT OBSERVABLE | NOT OBSERVABLE |

## Operation tokens

| Operation | Input | Output |
| --- | ---: | ---: |
| recognize | 256469 | 128834 |
| repair | 23213 | 2120 |
| extractFacts | NOT OBSERVABLE | NOT OBSERVABLE |

## Error taxonomy

| Category | Count |
| --- | ---: |
| milestone_missing | 52 |
| task_missing | 21 |
| ambiguity_spurious | 15 |
| task_spurious | 12 |
| milestone_spurious | 10 |
| time_incorrect | 8 |
| material_spurious | 5 |
| evidence_missing | 4 |
| task_hierarchy | 4 |
| ambiguity_missing | 3 |
| project_decision | 3 |
| event_missing | 2 |
| time_spurious | 2 |
| event_spurious | 1 |
| forbidden_output | 1 |
| material_missing | 1 |
| request_failure | 1 |
| time_missing | 1 |

Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.
