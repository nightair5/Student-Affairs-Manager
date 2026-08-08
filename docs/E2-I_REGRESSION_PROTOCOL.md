# E2-I Regression Protocol

E2 最终评估使用同一评分器分别运行：110 条冻结 Golden、40 条冻结 Holdout、本地 fallback 与真实 DeepSeek。`--dataset=golden|holdout`、`--label=before|after` 生成独立 checkpoint 和报告，避免恢复错数据。Worker 内部已负责传输重试，评估器不再额外重试或改变失败结果。

门禁版本 `e2-quality-gate-1.0.0`：Project ≥ 88%，Task P ≥ 85%、R ≥ 82%，Material R ≥ 75%，TimePoint ≥ 75%，Event ≥ 86.96%，Evidence ≥ 95.33%，Duplicate ≤ 3%，Over-fragmentation ≤ 5%，Major Correction ≤ 35%，Severe ≤ 2%，Invalid/Transport failure 各 ≤ 1%。所有门槛必须同时通过。

响应中的 execution、repair、route 与真实/null token usage 会写入本机 checkpoint 和失败报告；模型原始正文不提交 Git。没有运行条件时必须写 `NOT RUN`，不得用 local fallback、Mock 或旧生产 Prompt 冒充 After。
