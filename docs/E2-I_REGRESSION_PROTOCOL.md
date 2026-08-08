# E2-I Regression Protocol

E2 最终评估使用同一评分器分别运行：110 条冻结 Golden、40 条冻结 Holdout、本地 fallback 与真实 DeepSeek。`--dataset=golden|holdout`、`--label=before|after` 生成独立 checkpoint 和报告，避免恢复错数据。Worker 内部已负责传输重试，评估器不再额外重试或改变失败结果。

门禁版本 `e2-quality-gate-1.0.0`：Project ≥ 88%，Task P ≥ 85%、R ≥ 82%，Material R ≥ 75%，TimePoint ≥ 75%，Event ≥ 86.96%，Evidence ≥ 95.33%，Duplicate ≤ 3%，Over-fragmentation ≤ 5%，Major Correction ≤ 35%，Severe ≤ 2%，Invalid/Transport failure 各 ≤ 1%。所有门槛必须同时通过。

响应中的 execution、repair、route 与真实/null token usage 会写入本机 checkpoint 和失败报告；模型原始正文不提交 Git。没有运行条件时必须写 `NOT RUN`，不得用 local fallback、Mock 或旧生产 Prompt 冒充 After。

## 指标口径冻结

- Project Decision：逐样例比较是否应创建项目；分母为全部样例。
- Milestone、Task、Material：使用别名归一化后一对一匹配；Precision 分母为预测数量，Recall 分母为 Golden 数量。Task 同时校验层级类型，Subtask 不得当作普通 Task 重复计分。
- TimePoint Detection：先按原文时间表达一对一匹配，分别计算 Precision 和 Recall。Type Accuracy 与 Value Accuracy 的分母均为逐样例 `max(expected, predicted)` 之和；Value 同时要求归一化本地值、精度和 `needsConfirmation` 一致。门禁中的 TimePoint Accuracy 继续要求原文表达、类型、值、时区/精度语义整体匹配，以保持 Before/After 可比。
- Event Accuracy：标题别名一对一匹配，分母为逐样例 `max(expected, predicted)` 之和。
- Evidence Coverage：可匹配的预期证据数 / Golden 证据数。Evidence Validity：预测证据中可逐字回到原文的数量 / 预测证据数；空预测不用于掩盖 Coverage 缺失。
- Ambiguity：字段或说明归一化后一对一匹配；Precision 分母为预测歧义数，Recall 分母为 Golden 歧义数。
- Duplicate：重复 Task/Subtask 数 / 预测 Task/Subtask 数。Over-fragmentation、Major Correction、Severe Error、Invalid Output 与 Transport Failure 均以样例数为分母。
- Repair Trigger：尝试 repair 的有效响应数 / 有效响应数；Repair Success：应用修复的数量 / repair 尝试数。没有 repair 尝试时必须显示 `NOT OBSERVABLE`，不能写成 100%。Repair latency 只统计 `execution.operations` 中真实 repair 操作。
- Retry：`execution.attempts` 大于记录的操作数即视为发生过传输重试；分母为全部样例。Complexity Distribution 直接统计服务端返回的 simple / medium / complex 路由，缺失元数据单列为 unknown。
- Latency、Token 与 Cost 只使用真实响应元数据；上游未返回 usage 时保持 `null` / `NOT OBSERVABLE`，不得估算为已观测值。

所有比例在分母为 0 时遵循评分器的显式空集语义：Precision/Recall 类空集默认 100%，错误率类空集默认 0%；报告必须同时展示原始计数，避免只看比例误判。
