# E2 Facts-first Recognition 设计记录

## 结论

E2 第二轮将识别顺序明确为“事实完整性检查 → 结构规划”，但不改变 `RecognitionResult 2.0`、模型或 Domain v8。`Simple` 与 `Medium` 保持单次模型调用；`Complex` 两阶段仍是候选策略，必须在 Generalization Development Set 上证明净收益后才可在 Preview 显式开启。

## 审计依据

- 原 Golden 与 Exposed Holdout 的 Material 指标并未显示普遍材料漏检，不能把问题简单归因于材料词表。
- Exposed Holdout 的 Task、TimePoint、Event 与 Major Correction 明显恶化，且 Router 对陌生复杂表达存在 under-routing。
- 现有 Prompt 把事实提取与层级规划写在同一段，并要求动作词逐字出现，容易漏掉被动义务、截止窗口和非典型表达。

## 单次调用内部顺序

1. 逐段识别主体、义务或动作、对象、材料用途、时间及业务角色、事件、条件、渠道、约束、冲突和证据。
2. 完整性核对：每个事实进入且只进入合适的实体；纯信息保持为信息。
3. 最后规划 Project、Milestone、WorkPackage 与实体关联。

Prompt 不包含 Development、Golden、Holdout 的具体句子或答案，也不对 sampleId 或固定短语做分支。

## 受保护边界

- 模型固定为 `deepseek-v4-flash`。
- Schema 固定为 `RecognitionResult 2.0`。
- Prompt 版本更新为 `recognition-2.4.0`。
- 不修改 Workspace v8、Repository、Migration、DomainCommitPlan 或 UI。
- 事实清单只作为模型内部推理顺序，不新增输出字段。
- Complex 两阶段默认关闭；未完成同候选的 A/B 对照前不得声称更优。
