# P4 Path A PlanningNormalizer

状态：**COMPLETE_EXPOSED_DIAGNOSTIC_ONLY**。该原型未接入 Production 默认路径，不调用模型，不读取 expected 执行规范化。expected 仅在规范化完成后由同一冻结 scorer 统一评分。

## Contract

- Version：`path-a-planning-normalizer-1.0.0`
- 允许：保守合并证据绑定的重复 Task、同一谓词下的并列材料、引用去重、标题空白/标点规范化、最多一层子任务、唯一证据支持的 Material↔Task 关联。
- 禁止并由不变量保护：新增 Task/Milestone，删除 Material/TimePoint/Event/Ambiguity，修改时间值或类型，调用模型，读取 caseId/expected 决策。
- Raw paired rows：`.evaluation-cache/e2-7/p4-planning-normalizer-evaluation.json`（Git ignored），SHA-256 `126470d6e06df00c9b3eecfdf6bb99615443dd51e021005f0c4f46600b37018f`。

## Paired results (72 exposed diagnostics)

- Changed rows：0/72（0.00%）。
- Task Precision：86.42% → 86.42%（0.00%）。
- Task Recall：77.78% → 77.78%（0.00%）。
- Strict Major Correction：56.94% → 56.94%（0.00%）。
- Severe Error：0.00% → 0.00%（0.00%）。
- Evidence Coverage：97.43% → 97.43%。
- Paired strict major improved/harmed：0/0；severe improved/harmed：0/0。
- Added model calls/tokens：0 / 0；Normalizer latency mean 0.094 ms, max 1.008 ms。
- User-impact Major：**UNCHANGED_BY_IDENTITY**。Normalizer made no semantic output changes.

## P4 decision

**P4_NO_STRICT_GAIN**。P4 只保留能够由既有实体和逐字证据确定的结构操作；事实缺失、动作谓词错误、时间角色/值错误、条件或 Ambiguity 缺失、Event/Task 语义错误不由本 Normalizer 猜测修复。
