# RCO-5-008-B8 全新未见模型锚点盲测计划

**目的**：检验 `deepseek-v4-flash-vision-exp` 在全新表达上能否选择完整 scope、动作候选和对象，再由冻结的 RCO-5-008 composer/P4/评分器形成安全待确认任务。

## 数据边界

- 12 个全新匿名合成 Development 案例。
- source text 与 semantic family 不复用 B0–B7；逐例字符 bigram Jaccard `<0.55`。
- 标签由 Codex 单作者构造，不是独立人工真值、真实材料或 Holdout。
- 数据冻结后不得修改 Expected；合法订正只能追加 corrections log，并使首次盲测资格失效后重新建批次。

## 模型职责

- 只输出既有严格契约中的 source binding、directive scope IDs、action/object 原文候选和 ignored scope IDs。
- 不输出 `requiresAction`、语义、风险、actionType、修订关系或 `selected`。
- 本机负责最小动作头、条件事实归属、完整命题语义、修订、安全默认和评分。

## 拟议付费参数

本文件不构成付费授权。后续若用户授权，建议保持与 B7 可比：

- model：`deepseek-v4-flash-vision-exp`
- 12 cases × candidate 1 次；最多 12 次 dispatch
- temperature `0`；thinking `none`
- verifier / Repair / retry：`0 / 0 / 0`
- CNY hard cap：`10`

运行前仍需新增并冻结联网 runner、空 checkpoint、费用包络与失败停止条件，并由用户另行明确授权。

## 固定质量门

- 12/12 明确终态和严格 Schema。
- scope F1、action exact、object exact、Complete Anchor、Task F1、requiresAction、Complete Task Case 均 `100%`。
- unsafe default false positive、Forbidden、stale、selected stale 均 `0`。
- cancels/supersedes/amends、旧要求失效、新要求生效、unresolved 均 `100%`。

全部通过也只允许进入下一批独立复验；不接稳定路径、不启动 RCO-6、不部署。
