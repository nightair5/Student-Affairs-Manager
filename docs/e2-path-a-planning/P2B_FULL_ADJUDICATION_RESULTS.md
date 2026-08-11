# E2.7 P2B — 完整 User-impact 真盲评结果

状态：`COMPLETE / EXPOSED_DIAGNOSTIC_ONLY`

## 核心结果

72 条全部可判定：

- User-impact Major：14/72 = 19.44%
- Strict Major：41/72 = 56.94%
- 混淆矩阵：TP 8、FP 33、FN 6、TN 25
- Strict Major 对 User-impact Major：Precision 19.51%，Recall 57.14%
- Severe：0/72

因此 Strict Major 既显著过报，也漏报了 6 条真实用户影响错误，不能单独用作 Candidate gate 或“用户需要重大修改”的替代指标。Strict 与 User-impact 必须继续并列报告。

## P2 Gate 五问

1. **Strict Major 有多少是假阳性？** 33 条。以 Strict Major 为分母，false discovery rate 为 80.49%；在全部 User-impact NOT_MAJOR 中，Strict false-positive rate 为 56.90%。
2. **Task Recall 中多少是合理 grouping？** 18 条 strict Task Recall error 中 5 条（27.78%）被独立审阅为合理 grouping。
3. **Milestone 错误中多少只是 alias？** 29 条 strict Milestone structural error 中 12 条（41.38%）仅为标题/粒度 alias。
4. **多少是真正事实漏失？** 5/72（6.94%）。
5. **多少是事实存在但 Planning 错误？** 13/72（18.06%）；在 18 条 Planning Error 中占 72.22%。

另有 31/41（75.61%）Strict Major 被审阅为 Reasonable Equivalent，远高于 25% 停止线。因此必须先使用冻结语义等价契约校准评分，不能先改模型或 Prompt。

## 多维标签分布

| 维度 | YES | NO |
|---|---:|---:|
| Planning Error | 18 | 54 |
| Fact Missing | 5 | 67 |
| Reasonable Equivalent | 54 | 18 |
| Time Role Error | 9 | 63 |
| Event/Task Error | 6 | 66 |
| Material/Task Error | 0 | 72 |
| Ambiguity Missing | 6 | 66 |
| Task Grouping Equivalent | 19 | 53 |
| Milestone Alias Only | 14 | 58 |

## 盲评完整性

- packet：72 条，SHA-256 `0ad91dc4bb5a7d7ee6c88e749b731044e20dfc19c23e4cc69a94839a0eadda7d`
- labels：SHA-256 `a18f5befd71948d0c843939d48e1f6d8832425a3dd7c4802981daaf3b5ebb3b7`
- labels 冻结提交：`e331bc0992b93b8ed2755db00fd9e8ebadadbfaf`
- reveal key：SHA-256 `e4a6086600654a90854d88a05b223f8b1a1a966d77a1ec1e470eef1743422a3e`
- 自动校验：`P2B_BLIND_CHRONOLOGY_AND_HASHES_VALID`

审阅者在 labels 冻结前看不到 expected、caseId、sourceSet、strict scores/failures 或 key。标签冻结提交后才生成 key，且 key 单独提交。

## 证据边界

数据均已暴露，只能校准契约，不能证明 Blind 泛化。审阅者是隔离的 Codex reviewer，不是外部真人研究参与者。旧缓存没有生成时 per-observation hashes，本轮只冻结 cache 文件并在事后绑定 source/result hashes。Reasonable Equivalent、Task Grouping 与 Milestone Alias 是独立审阅判断，不修改 expected，也不会直接写回 strict scorer。
