# DeepSeek model candidate evaluation — vision-exp-preflight-20260824

- Dataset: `e2-generalization-development-1.0.0`
- Started: 2026-08-23T17:35:50.418Z
- Completed: 2026-08-23T17:36:05.625Z
- Scope: text-only recognition; no image or file body was uploaded.
- Isolation: frozen expected data was used only by the local scorer and was never sent to either model.

## Quality comparison

| Metric | deepseek-v4-flash | deepseek-v4-flash-vision-exp | Candidate improvement |
| --- | ---: | ---: | ---: |
| projectDecisionAccuracy | 100.00% | 100.00% | +0.00 pp |
| taskPrecision | 100.00% | 100.00% | +0.00 pp |
| taskRecall | 100.00% | 100.00% | +0.00 pp |
| materialRecall | 0.00% | 100.00% | +100.00 pp |
| timePointAccuracy | 100.00% | 100.00% | +0.00 pp |
| eventAccuracy | 100.00% | 100.00% | +0.00 pp |
| evidenceCoverage | 100.00% | 100.00% | +0.00 pp |
| majorCorrectionRate | 100.00% | 0.00% | +100.00 pp |
| severeErrorRate | 0.00% | 0.00% | +0.00 pp |
| invalidOutputRate | 0.00% | 0.00% | +0.00 pp |
| requestFailureRate | 0.00% | 0.00% | +0.00 pp |

Positive Candidate improvement means the candidate is better; lower-is-better metrics are sign-adjusted.

## Operations

| Model | Samples | Mean latency | P95 latency | Tokens input/output | Cost | Frozen E2 gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| deepseek-v4-flash | 1 | 6595 ms | 6595 ms | 2359/1093 | NOT OBSERVABLE | FAIL |
| deepseek-v4-flash-vision-exp | 1 | 7600 ms | 7600 ms | 2365/963 | NOT OBSERVABLE | PASS |

## Model lineage and prompt control

| Model | Provider calls | Exact returned-model lineage | Semantic prompt SHA-256 |
| --- | ---: | --- | --- |
| deepseek-v4-flash | 1 | PASS | 0235855bedd0f9308addb616b8cec66f8f91714cbfa6125fa31fe11a2cb3bf9f |
| deepseek-v4-flash-vision-exp | 1 | PASS | 0235855bedd0f9308addb616b8cec66f8f91714cbfa6125fa31fe11a2cb3bf9f |

Raw normalized results and transport evidence remain only in the Git-ignored evaluation cache. API keys, Authorization headers, and clipboard contents are not persisted.
