# E2.7 P1 — 双轨评测契约

## 冻结结论

E2.7 保留 `70dd976` 的 strict scorer 与全部 Golden、Exposed Holdout、Development expected，不修改历史结果。新增两条独立证据线：

1. **Semantic Equivalent**：只对逐例人工批准且通过确定性约束校验的等价结构记分。
2. **User-impact Major Correction**：只由看不到 expected、caseId、strict failure 和揭盲映射的独立审阅者判断。

三套指标并列报告。Semantic 或 user-impact 结果不得覆盖、重命名或回填历史 Strict Major Correction。

## 语义等价边界

可接受类别固定为 `evaluation-contract.json` 中九类。Task 合并/拆分只有在动作、对象、主体、modality、适用条件、截止、提交渠道、独立完成状态、Event/Task 边界及逐字证据全部保留时才成立。

以下情况一票否决：不同截止、不同主体、不同条件、不同 modality、需要独立完成却被合并、顺序步骤被合并、Event 与 Task 互换、证据不是原文逐字子串。

实现位于 `src/recognition/e2/semanticEquivalence.ts`。它不自动猜测等价关系，只验证并应用带 reviewer provenance 的逐例裁决；Task Precision 分母仍是实际 Task 数，Task Recall 分母仍是 expected Task 数，因此合并等价不会产生大于 100% 的 Precision。

## User-impact Major Correction

判 Major：用户必须修改缺失/错误的必要动作、主体、modality、适用条件、影响提醒或执行顺序的时间值/角色、假精度、必要 Event、影响信任的无证据内容，或 Severe/Safety 错误。

不判 Major：满足全部事实约束的 Task 合并/拆分、仅标题同义、无事实损失的 Milestone 粒度、无动作损失的 Project 容器差异、仍保持逐字覆盖的证据切片差异、未编造行动的纯信息 Event、纯文案差异。

独立审阅者可标 `INSUFFICIENT_INFORMATION`，不得被强制折算为 `NOT_MAJOR`。正式比率需同时报告该类数量和排除规则。

## 已知限制

- 冻结 expected 的 Task 类型没有显式 actor/modality/condition/deadline/channel 字段，因此程序不能仅凭 expected 自动证明合并等价；必须逐例审阅并显式填写 preservation checks。
- 旧 `recognition-2.4.1` 缓存没有生成时 source/input/result hash。E2.7 可补算当前 fixture source hash、缓存文件 hash 与结果 hash，但必须标注为事后绑定，不能声称是生成时 provenance。
- Strict TimePoint Value 仍受部分 `normalizedLocal=null` fixture 约束限制；该风险保留，不修改 expected。
