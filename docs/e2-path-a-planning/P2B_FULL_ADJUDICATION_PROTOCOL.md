# E2.7 P2B — 完整多维真盲评重跑

Round 1 只冻结了 User-impact Major 和原因，不能回答完整 P2 Gate。由于揭盲后禁止修改标签，本轮使用新 packet schema、selection salt、匿名 ID、标签文件和 reveal key，保留 Round 1 全部历史证据，不覆盖。

P2B 仍抽取 72 条已暴露诊断样本（Golden / Exposed Holdout / Development 各 24），审阅者必须分别标记：

- User-impact Major
- Planning Error
- Fact Missing
- Reasonable Equivalent
- Time Role Error
- Event/Task Error
- Material/Task Error
- Ambiguity Missing
- Task Grouping Equivalent（用于 P2 Gate）
- Milestone Alias Only（用于 P2 Gate）

审阅者只可读取 ignored P2B packet、P1 rubric 与 `p2b-full-labels.schema.json`，不得读取 expected、caseId、sourceSet、strict score/failures、历史报告、Round 1 labels/key 或 Git 历史。

时序与 Round 1 相同：先提交 packet manifest；再由新的隔离审阅者完成 labels；labels 单独提交并推送；最后才生成并单独提交 `p2b-reveal-key.json`。`verify-e2-7-blind-adjudication-v2.mjs` 必须最终返回 `P2B_BLIND_CHRONOLOGY_AND_HASHES_VALID`。
