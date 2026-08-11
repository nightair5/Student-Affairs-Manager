# E2.7 P2 Round 1 — User-impact Major-only 盲评

状态：`INCOMPLETE_FOR_P2_GATE / PRESERVED_FOR_AUDIT`

## 结果

- 样本：72（Golden / Exposed Holdout / Development 各 24）
- 可判定：71；信息不足：1
- User-impact Major：8/71 = 11.27%
- Strict Major：40/72 = 55.56%
- 以 User-impact Major 为参照：Strict precision 20.51%，recall 100%
- 混淆矩阵：TP 8、FP 31、FN 0、TN 32
- User-impact Major 区间：按全体样本下界 11.11%，把信息不足按 Major 计的上界 12.50%

标签冻结提交为 `4fa2106392a9a11e1b443fd3ebdcf0f3b7fdf380`；标签提交后才生成并提交 reveal key。`npm run eval:recognition:e2:p2:verify` 已验证时序与 packet / labels hash 绑定。

## 为什么不能作为完整 P2

Round 1 审阅者逐例判断了 User-impact Major，并通过 reasons 记录部分错误，但标签 schema 没有把以下 P2 必填维度全部拆成独立字段：Planning Error、Fact Missing、Reasonable Equivalent、Time Role Error、Event/Task Error、Material/Task Error、Ambiguity Missing。

这些维度不能在揭盲后从自由文本理由补写，否则会破坏“标签冻结后不得修改”的协议。因此 Round 1 只证明 Strict Major 对 User-impact Major 的高假阳性，不回答完整 P2 Gate。后续必须使用新 packet version、新 observation IDs、新 labels schema 与新独立审阅者重做；本轮 labels/key 保留，不删除、不覆盖。

## 证据边界

数据集均已暴露，结果只用于评测契约校准，不是 Blind 泛化证据。审阅由隔离的独立 Codex 审阅流程完成，并非外部真人研究参与者；最终报告不得把它写成外部用户研究。旧缓存缺少生成时 source/input/result hashes，本轮只提供冻结 cache hash 与事后逐条 hash 绑定。
