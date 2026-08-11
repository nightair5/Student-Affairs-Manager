# P5 RC2 Development comparison

状态：`RC2_REQUIRED`。

## 运行完整性

- 108/108 条完成，108 个唯一 caseId；请求失败、无效输出、重试均为 0。
- 模型：`deepseek-v4-flash`；Prompt：`recognition-2.5.0-rc.2`。
- 原始输出只保存在 Git ignored checkpoint；checkpoint SHA-256：`ae570de5c7c088072a9267f15d621bd06ac24cacd020ec16e59e6bf474851199`。
- source/input hash 缺失均为 0。成功行 Token 缺失 0；成功行 result hash 缺失 100。历史运行未持久化逐行 result hash 时，不声称具备该证据；整文件哈希仍绑定全部原始行。
- User-impact Major：`NOT RUN FOR RC2`。Strict Major 不替代人工语义判定。

## 冻结 Development 对比

| Metric | 2.4.1 baseline | RC2 | Delta |
| --- | ---: | ---: | ---: |
| projectDecisionAccuracy | 90.74% | 87.96% | -2.78 pp |
| milestonePrecision | 32.94% | 50.94% | +18.00 pp |
| milestoneRecall | 58.33% | 56.25% | -2.08 pp |
| taskPrecision | 82.17% | 77.95% | -4.22 pp |
| taskRecall | 75.71% | 70.71% | -5.00 pp |
| materialPrecision | 97.87% | 97.69% | -0.18 pp |
| materialRecall | 93.24% | 85.81% | -7.43 pp |
| timePointPrecision | 92.11% | 89.36% | -2.74 pp |
| timePointRecall | 94.59% | 85.14% | -9.46 pp |
| timePointTypeAccuracy | 78.85% | 69.62% | -9.23 pp |
| timePointValueAccuracy | 74.36% | 68.35% | -6.00 pp |
| timePointAccuracy | 75.00% | 65.19% | -9.81 pp |
| eventAccuracy | 93.94% | 81.25% | -12.69 pp |
| evidenceCoverage | 98.72% | 87.61% | -11.11 pp |
| evidenceValidity | 100.00% | 100.00% | +0.00 pp |
| ambiguityPrecision | 60.78% | 51.92% | -8.86 pp |
| ambiguityRecall | 51.67% | 45.00% | -6.67 pp |
| majorCorrectionRate | 67.59% | 65.74% | -1.85 pp |
| severeErrorRate | 0.00% | 8.33% | +8.33 pp |
| invalidOutputRate | 0.00% | 0.00% | +0.00 pp |
| requestFailureRate | 0.00% | 7.41% | +7.41 pp |
| repairTriggerRate | 9.26% | 10.00% | +0.74 pp |
| repairHarmRate | 0.00% | 0.00% | +0.00 pp |
| duplicateRate | 0.00% | 0.00% | +0.00 pp |
| overFragmentationRate | 0.00% | 0.93% | +0.93 pp |

Strict Major 逐例迁移：改善 14，恶化 4，持续 Major 57，持续非 Major 33。

## 性能与 Token

- Mean latency：7671 ms → 8076 ms（5.29%）。
- P95 latency：11788 ms → 12075 ms。
- Total tokens：NOT OBSERVABLE：存在无 Token 的请求失败，禁止将成功子集总量冒充完整运行总量。
- 成功请求 operation tokens：recognize 278660 input / 136586 output；repair 38827 input / 4403 output。
- Cost：`NOT OBSERVABLE`，不得估算。

## 成功子集敏感性分析

以下只聚合 100 条成功返回，目的是分离传输失败影响；它存在选择偏差，不能替代 108 条正式指标，也不是新的正式 run。

- Task P/R：77.95% / 78.57%
- Time Role/Value：77.46% / 76.06%
- Event：89.66%
- Evidence Coverage/Validity：97.62% / 100.00%
- Strict Major / Severe：63.00% / 1.00%

## 决策

RC2 是第二轮也是最后一轮 Prompt 候选。正式全样本未达到 Task、Time、Event、Evidence、Strict Major、Severe 和 Transport 门槛；成功子集也不能消除选择偏差。因此 P5 停止 Prompt 调优，RC1/RC2 都不冻结为 Candidate，后续组件消融保留冻结的 2.4.1 Prompt。
