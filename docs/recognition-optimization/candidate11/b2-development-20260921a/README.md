# Candidate11 B2 冻结 Development 消融结果

状态：`B2_DEVELOPMENT_RESULTS_READY_FOR_REVIEW`。日期：2026-09-21。

本目录保存 B1 Manifest 中 24 个冻结身份的唯一一次执行结果。数据角色始终是**已见 Development**；参照是模型辅助单工程作者标签，不是独立人工真值、盲测、真人试用或真实识别转化率。

## 执行事实

- 固定顺序完成 24/24 次调用；全部 HTTP 200、raw 单次落盘、usage 明确、settled，retry=0、repair=0、verifier=0。
- 模型为 `deepseek-flash`，temperature=0，reasoning=none，max_output_tokens=8192。
- 授权最坏预算 ¥51.904512；按官方峰值价和 provider usage 计算的本地可审计费用上界为 ¥0.523928。provider 实际扣费不可观察，记为 `NOT_OBSERVABLE`。
- 权威账本从 644 行扩展到 693 行：1 条 grant、24 条 reserve、24 条 settle；没有 halt/uncertain。
- 账本最终 SHA-256：`2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`；tail：`13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd`。

## 评分结果

| 变体 | 完整来源 | TP / FP / FN | Precision | Recall | F1 | Major | Severe | Forbidden |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| V00 | 1/6 | 11 / 5 / 2 | 68.75% | 84.62% | 75.86% | 26 | 1 | 5 |
| V10 | 1/6 | 11 / 5 / 2 | 68.75% | 84.62% | 75.86% | 27 | 1 | 5 |
| V01 | 1/6 | 11 / 4 / 2 | 73.33% | 84.62% | 78.57% | 25 | 1 | 4 |
| V11 | 1/6 | 10 / 5 / 3 | 66.67% | 76.92% | 71.43% | 33 | 1 | 5 |

四臂均为 6/6 Schema 与引用有效，教学例越界复制均为 0，但四臂均有 Severe 和 Forbidden。V00 在 D06 丢失两个独立历史端点并把它们合并，因此触发预注册 `REJECT_CANDIDATE11`。没有增强臂满足净收益门槛，不能选择候选，也不能进入 Holdout 模型调用。

M、E 和 M×E 以完整来源数做描述性差分均为 0。六份来源不足以报告显著性、泛化率或真实转化率。

## 执行器诊断

实时结果文件把 `packet.context` 传给冻结适配器，而冻结上下文实际位于 `packet.prepared.context`，因此 24 个结果文件都记录了本地 `SCHEMA_OR_ADAPTER_REJECTED`。这不是模型输出损坏：24 份未改动 raw 通过同一冻结适配器和冻结请求上下文只读重放后全部 PASS。

原始错误结果保存在 `ANALYSIS_RUNNER_INITIAL.json` 与 `REPORT_RUNNER_INITIAL.md`；`ADAPTER_REPLAY.json`逐单元记录更正依据。正式 `ANALYSIS.json` 只修正本地上下文绑定，不改模型 JSON、不补事实、不重试，也没有增加模型调用。

## 文件导航

- `BASELINE.json`、`BINDING.json`、`BILLING.json`、`SEND_REVIEW.json`、`GRANT.json`：发送前绑定、计价与授权。
- `raw/`、`results/`：24 份原始响应和发送期结果记录。
- `EXECUTION_LEDGER.json`：逐请求 reserve、provider request ID、usage、settle 与账本哈希。
- `ADAPTER_REPLAY.json`：执行器上下文路径缺陷的逐单元只读复核。
- `ANALYSIS.json`、`REPORT.md`：规范评分、四臂汇总、描述性因子分析与拒绝决定。
- `ERROR_CLASSIFICATION.md`：逐来源错误类别与选择门槛解释。
- `VALIDATION.md`：测试、保护检查和保留失败。
- `NEXT_HOLDOUT_PREPARATION_PROMPT.md`：下一阶段零调用 Candidate12、独立人工参照与 Holdout 准备的完整执行提示词。

停止点：`B2_DEVELOPMENT_RESULTS_READY_FOR_REVIEW`。默认候选、Production、Preview、旧库和历史 Expected 均未修改。
