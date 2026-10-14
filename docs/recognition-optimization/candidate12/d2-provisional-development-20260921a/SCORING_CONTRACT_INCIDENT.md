# D2 冻结评分接口事件

事件代码：`FROZEN_SCORER_REFERENCE_CONTRACT_MISMATCH`。

D1 Manifest 同时冻结了 `candidate11-scoring-2.0.0` 和 12 份 provisional `scorerReference`。执行后首次调用冻结评分器时，含任务的 10 份参照均触发 `C11_REFERENCE_IDENTITY_INVALID`：评分器要求每个任务提供 `actions[]`、`objects[]` 和可执行的 `fields`；参照实际提供单值 `action`、`object`、`status`、`actionable`，checks 也是自然语言字符串。

本轮没有修改 Expected、旧 scorer、请求、raw、结果或预注册门槛。正式结论按失败关闭为 `REJECT_CANDIDATE12_ENGINEERING_SCREEN`。`ANALYSIS.json` 中的 `diagnosticOnly` 使用公开的事后任务结构规则，只用于定位差异，并明确排除完成标准正式计分；它不是冻结 scorer 的替代结果。

后续修复必须在新数据和新请求结果可见前完成：定义唯一的 machine-readable reference schema；为 action/object 别名、条件、状态、材料、时间、完成标准、依赖和修订关系提供可执行规则；用正反例证明 scorer 能消费全部参照；冻结 compiler/scorer/version/hash；再使用全新 Development 或独立人工 Holdout。当前 12 份来源和 24 个输出永久视为已见材料。
