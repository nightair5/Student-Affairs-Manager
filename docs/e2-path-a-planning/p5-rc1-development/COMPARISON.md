# P5 RC1 Development comparison

状态：`RC2_REQUIRED`。

## 运行完整性

- 108/108 条完成，108 个唯一 caseId；请求失败、无效输出、重试均为 0。
- 模型：`deepseek-v4-flash`；Prompt：`recognition-2.5.0-rc.1`。
- 原始输出只保存在 Git ignored checkpoint；checkpoint SHA-256：`172f878015e9d3497fa919e393a1a0dbed03901a6b64ced29a93b269faa6f451`。
- source/input hash 和 Token 缺失均为 0。Checkpoint 未持久化单行 result hash，因此不声称具备逐行 result-hash 证据；整文件哈希绑定全部原始行。
- User-impact Major：`NOT RUN FOR RC1`。Strict Major 不替代人工语义判定。

## 冻结 Development 对比

| Metric | 2.4.1 baseline | RC1 | Delta |
| --- | ---: | ---: | ---: |
| projectDecisionAccuracy | 90.74% | 96.30% | +5.56 pp |
| milestonePrecision | 32.94% | 40.98% | +8.04 pp |
| milestoneRecall | 58.33% | 52.08% | -6.25 pp |
| taskPrecision | 82.17% | 79.17% | -3.00 pp |
| taskRecall | 75.71% | 81.43% | +5.71 pp |
| materialPrecision | 97.87% | 97.14% | -0.73 pp |
| materialRecall | 93.24% | 91.89% | -1.35 pp |
| timePointPrecision | 92.11% | 91.61% | -0.49 pp |
| timePointRecall | 94.59% | 95.95% | +1.35 pp |
| timePointTypeAccuracy | 78.85% | 76.77% | -2.07 pp |
| timePointValueAccuracy | 74.36% | 78.06% | +3.71 pp |
| timePointAccuracy | 75.00% | 74.19% | -0.81 pp |
| eventAccuracy | 93.94% | 64.71% | -29.23 pp |
| evidenceCoverage | 98.72% | 98.93% | +0.21 pp |
| evidenceValidity | 100.00% | 100.00% | +0.00 pp |
| ambiguityPrecision | 60.78% | 57.38% | -3.41 pp |
| ambiguityRecall | 51.67% | 58.33% | +6.67 pp |
| majorCorrectionRate | 67.59% | 62.96% | -4.63 pp |
| severeErrorRate | 0.00% | 0.00% | +0.00 pp |
| invalidOutputRate | 0.00% | 0.00% | +0.00 pp |
| requestFailureRate | 0.00% | 0.00% | +0.00 pp |
| repairTriggerRate | 9.26% | 10.19% | +0.93 pp |
| repairHarmRate | 0.00% | 0.00% | +0.00 pp |
| duplicateRate | 0.00% | 0.00% | +0.00 pp |
| overFragmentationRate | 0.00% | 0.00% | +0.00 pp |

Strict Major 逐例迁移：改善 10，恶化 5，持续 Major 61，持续非 Major 32。

## 性能与 Token

- Mean latency：7671 ms → 8359 ms（8.97%）。
- P95 latency：11788 ms → 12396 ms。
- Input tokens：291508 → 330435（13.35%）。
- Output tokens：157438 → 154820（-1.66%）。
- Cost：`NOT OBSERVABLE`，不得估算。

## 决策

RC1 改善 Task Recall、Project Decision、Ambiguity Recall 与 Strict Major，但 Task Precision 降至 82% 门槛以下，Event Accuracy 大幅回归，Time Role/Value 仍未达到内部候选门槛。因此 RC1 不冻结为 Candidate，使用唯一剩余的原则性 RC2，聚焦“发生型安排与可交付 Task”的业务边界。不得进行第三轮 Prompt 调优。
