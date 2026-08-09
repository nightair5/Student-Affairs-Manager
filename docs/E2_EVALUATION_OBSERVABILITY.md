# E2 Evaluation Harness 可观测性

## 网络与恢复

真实模型评测按样例捕获网络异常，记录 `request_failure / TRANSPORT_FAILURE` 后继续；每个样例完成后写入 Git 忽略的本地 checkpoint，`--resume=true` 只补跑未完成项。代理/transport 选择只存在于评测脚本，不进入产品 Worker。

## Repair 语义指标

Preview 在 Repair 尝试时回传 Repair 前的结构化结果。Harness 用同一冻结 expected rubric 分别评分 Before 与 After：

- Applied：Patch 是否实际改变允许字段；
- Success：可观察样例中，匹配实体增加或 Major/Severe/Duplicate/Over-fragmentation 改善；
- Harm：出现新的 Severe/Major/Duplicate/Over-fragmentation，或匹配实体总数下降。

没有 Repair Before 结果时写 `NOT OBSERVABLE`，不得用“Patch 已应用”替代语义成功。

## 分层延迟与 Token

报告按 Simple、Medium、Complex、Unknown 分别统计样例数、平均/P50/P95 延迟和完整 Token；同时按 recognize、repair、extractFacts 分开聚合 operation usage。缺少任一必要 usage 时对应项为 `NOT OBSERVABLE`，不估算成本。
