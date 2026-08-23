# DeepSeek model candidate evaluation — vision-exp-screening-20260824

- Dataset: `e2-generalization-development-1.0.0`
- Started: 2026-08-23T17:36:29.053Z
- Completed: 2026-08-23T17:55:41.449Z
- Scope: text-only recognition; no image or file body was uploaded.
- Isolation: frozen expected data was used only by the local scorer and was never sent to either model.

## Quality comparison

| Metric | deepseek-v4-flash | deepseek-v4-flash-vision-exp | Candidate improvement |
| --- | ---: | ---: | ---: |
| projectDecisionAccuracy | 87.50% | 100.00% | +12.50 pp |
| taskPrecision | 53.85% | 88.89% | +35.04 pp |
| taskRecall | 63.64% | 72.73% | +9.09 pp |
| materialRecall | 100.00% | 100.00% | +0.00 pp |
| timePointAccuracy | 66.67% | 50.00% | -16.67 pp |
| eventAccuracy | 50.00% | 50.00% | +0.00 pp |
| evidenceCoverage | 100.00% | 100.00% | +0.00 pp |
| majorCorrectionRate | 87.50% | 75.00% | +12.50 pp |
| severeErrorRate | 0.00% | 0.00% | +0.00 pp |
| invalidOutputRate | 0.00% | 0.00% | +0.00 pp |
| requestFailureRate | 0.00% | 0.00% | +0.00 pp |

Positive Candidate improvement means the candidate is better; lower-is-better metrics are sign-adjusted.

## Operations

| Model | Samples | Mean latency | P95 latency | Tokens input/output | Cost | Frozen E2 gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| deepseek-v4-flash | 8 | 7392 ms | 11197 ms | 25337/11844 | NOT OBSERVABLE | FAIL |
| deepseek-v4-flash-vision-exp | 8 | 7325 ms | 12600 ms | 21873/7288 | NOT OBSERVABLE | FAIL |

## Model lineage and prompt control

| Model | Provider calls | Exact returned-model lineage | Semantic prompt SHA-256 |
| --- | ---: | --- | --- |
| deepseek-v4-flash | 10 | PASS | 0235855bedd0f9308addb616b8cec66f8f91714cbfa6125fa31fe11a2cb3bf9f |
| deepseek-v4-flash-vision-exp | 9 | PASS | 0235855bedd0f9308addb616b8cec66f8f91714cbfa6125fa31fe11a2cb3bf9f |

Raw normalized results and transport evidence remain only in the Git-ignored evaluation cache. API keys, Authorization headers, and clipboard contents are not persisted.
