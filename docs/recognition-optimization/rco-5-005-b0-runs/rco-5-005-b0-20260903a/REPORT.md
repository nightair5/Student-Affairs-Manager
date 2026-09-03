# RCO-5-005-B0 实验报告

## 结论

- diagnostic_decision: `INVALID_RUN`
- reason: 36 次计划调用或三臂 Schema 完整性未全部满足。
- release_decision: `NO_PROMOTION / DO_NOT_LAUNCH`
- evidence_boundary: 12 个匿名合成 Development 案例，只用于小样本诊断；不是未见真实材料、真人修改时间、浏览器验收或上线证据。

## 运行契约

- model: `deepseek-v4-flash-vision-exp`
- temperature: `0`
- calls: 36/36
- Repair: 0
- provider billed cost: `NOT_OBSERVABLE`
- conservative peak-price cost: 0.230547 CNY
- token usage: 25535 input / 8954 output / 34489 total

## 聚合指标

| 臂 | 完成 | Schema | Task P | Task R | Task F1 | requiresAction | effect | time | material | event | location | evidence | Complete Case | Major Correction | Forbidden |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| facts_first | 12/12 | 10/12 | 100.00% | 83.33% | 90.91% | 83.33% | 66.67% | 62.50% | 42.86% | 0.00% | 33.33% | 100.00% | 41.67% | 58.33% | 0 |
| proposition_graph | 12/12 | 0/12 | N/A | 0.00% | N/A | 25.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | N/A | 0.00% | 100.00% | 0 |
| semantic_verifier | 12/12 | 0/12 | N/A | 0.00% | N/A | 25.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | N/A | 0.00% | 100.00% | 0 |

## 可解释边界

- facts_first：一次紧凑事实抽取。
- proposition_graph：一次完整命题图抽取，模型不能输出 selected。
- semantic_verifier：独立第二次阅读原文并审查命题图；只有语义完全一致、图与修订均完整且通过确定性安全策略时，才产生默认勾选建议。
- 模型请求不包含 Expected；Expected 只由本地评测器读取。
- 本轮不修改稳定路径，不部署，不授权 RCO-6。
