# E2.7 P2 — User-impact Major 真盲评协议

## 样本与隔离

- 样本数：72；Golden、Exposed Holdout、Development 各 24 条。
- 选择只按 `sourceSet + rawText` 的 SHA-256 确定性排序，不读取 expected、strict score 或失败类别。
- 审阅包只包含匿名 `observationId`、原文、参考时间和 Path A 结构化输出。
- 审阅包明确移除：caseId、sourceSet、expected、strict score、failures、route、repair、Prompt/模型元数据与 reveal key。
- 原始审阅包位于 Git ignored `.evaluation-cache/e2-7/`；Git 只提交包哈希、匿名标签、揭盲时序和聚合结果。

## 冻结时序

1. `prepare-e2-7-blind-adjudication.mjs` 生成 ignored packet 与已提交 manifest；此时 labels 和 reveal key 都不存在。
2. 独立审阅者只读取 packet 与 P1 rubric，逐条写 `MAJOR`、`NOT_MAJOR` 或 `INSUFFICIENT_INFORMATION`，并记录理由。
3. 标签文件单独提交并推送。该提交及其 SHA-256 是标签冻结点。
4. 只有标签文件已经 committed + clean，`reveal-e2-7-blind-adjudication.mjs` 才能以原文精确匹配生成 key；脚本使用 `wx`，禁止覆盖。
5. key 必须在后续独立提交中写入。`verify-e2-7-blind-adjudication.mjs` 校验 packet/labels hashes、完整覆盖、标签提交、时间顺序及 key 首次提交边界。

标签冻结后不得修改；若发现审阅协议错误，整轮作废并用新 packet version 重做，不能原地改标签。

标签结构和冻结理由词表由 `p2-user-impact-labels.schema.json` 定义。`NOT_MAJOR` 无更具体原因时使用 `no_major_user_change_required`；无法判断时必须使用 `insufficient_information`，不得把未知折算为无重大修改。

## 原始缓存来源限制

三份 `recognition-2.4.1` 缓存的文件 SHA-256 已冻结，但旧格式没有生成时 `sourceSha256`、`inputSha256` 或 `resultSha256`。P2 在 packet 生成时补算逐条 source/result hash。这是**事后完整性绑定**，不是生成时 provenance；最终报告必须保留此限制。
