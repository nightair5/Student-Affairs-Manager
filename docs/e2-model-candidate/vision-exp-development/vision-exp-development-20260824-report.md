# DeepSeek model candidate evaluation — vision-exp-development-20260824

- Dataset: `e2-generalization-development-1.0.0`
- Started: 2026-08-23T17:39:15.467Z
- Completed: 2026-08-23T17:55:42.349Z
- Scope: text-only recognition; no image or file body was uploaded.
- Isolation: frozen expected data was used only by the local scorer and was never sent to either model.

## Quality comparison

| Metric | deepseek-v4-flash-vision-exp | Candidate improvement |
| --- | ---: | ---: |
| projectDecisionAccuracy | 92.59% | N/A |
| taskPrecision | 76.52% | N/A |
| taskRecall | 72.14% | N/A |
| materialRecall | 89.19% | N/A |
| timePointAccuracy | 67.10% | N/A |
| eventAccuracy | 65.63% | N/A |
| evidenceCoverage | 95.73% | N/A |
| majorCorrectionRate | 73.15% | N/A |
| severeErrorRate | 0.93% | N/A |
| invalidOutputRate | 0.00% | N/A |
| requestFailureRate | 0.93% | N/A |

Positive Candidate improvement means the candidate is better; lower-is-better metrics are sign-adjusted.

## Operations

| Model | Samples | Mean latency | P95 latency | Tokens input/output | Cost | Frozen E2 gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| deepseek-v4-flash-vision-exp | 108 | 7918 ms | 14019 ms | 294984/107516 (partial) | NOT OBSERVABLE | FAIL |

## Model lineage and prompt control

| Model | Provider calls | Exact returned-model lineage | Semantic prompt SHA-256 |
| --- | ---: | --- | --- |
| deepseek-v4-flash-vision-exp | 120 | PASS | 0235855bedd0f9308addb616b8cec66f8f91714cbfa6125fa31fe11a2cb3bf9f |

Raw normalized results and transport evidence remain only in the Git-ignored evaluation cache. API keys, Authorization headers, and clipboard contents are not persisted.
