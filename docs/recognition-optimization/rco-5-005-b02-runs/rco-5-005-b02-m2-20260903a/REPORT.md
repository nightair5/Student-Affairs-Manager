# RCO-5-005-B02-M2 真实模型实验报告

## 结论

- 实验决定：`INVALID_RUN`
- 原因：至少一臂未达到全部计划案例完成且 Schema 合格。
- 发布决定：`NO_PROMOTION / DO_NOT_LAUNCH`
- 证据边界：12 个匿名合成 Development 案例，标签由 Codex 单一作者制定；不是独立人工真值、真实材料、真人修改时间、浏览器验收或上线证据。

## 运行事实

- model：`deepseek-v4-flash-vision-exp`
- temperature：`0`
- 逻辑单元：36/36
- 实际请求：25/36
- 确认回执：25
- 回执未知：0
- 因命题图不合格而零调用跳过复核：11
- Repair / retry：0 / 0
- Provider billed cost：`NOT_OBSERVABLE`
- 可观测 token：59061 input / 13017 output / 72078 total
- 按冻结峰值单价折算：0.431693 CNY
- 全轮理论最大预算：8.7360768 CNY，小于 10 CNY 硬上限

## 同批案例指标

| 臂 | 完成 | Schema | Task P | Task R | Task F1 | requiresAction | effect | time | materials | event | location | Evidence | Complete Case | Major Correction | Forbidden | Safe Default Recall | Missed Safe Default |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| facts_first | 12/12 | 12/12 | 40.0% | 40.0% | 40.0% | 100.0% | 18.8% | 27.3% | 14.3% | 33.3% | 14.3% | 100.0% | 33.3% | 66.7% | 5 | 44.4% | 5 |
| proposition_graph | 12/12 | 1/12 | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID |
| semantic_verifier | 1/12 | 0/12 | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID |

## 解释边界

- facts_first、命题图和复核器使用同一模型、相同 temperature 与同一批原文；Expected 从未进入请求。
- 命题图不合格时，复核器不会被调用；失败仍留在分母，不会通过重试或 Repair 追分。
- 模型没有权力输出默认勾选；默认勾选由本地验证和确定性安全策略生成。
- 本轮不修改稳定路径，不接 RCO-6，不部署。
