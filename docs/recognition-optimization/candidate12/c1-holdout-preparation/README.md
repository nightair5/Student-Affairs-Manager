# Candidate12 C1 独立人工参照与 Holdout 准备包

状态：`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。模型调用：0。权威账本写入：0。

Candidate12 已在提交 `c03368054ff8c357f055658c2d2d39b45bbcb761` 中先于任何新 Holdout 来源和 Expected 冻结。当前没有独立人工标注者或复核者提交材料，因此本目录只保存协议、空白模板、重合检查、预注册和预算草案；没有伪造 12 份来源、人工真值或 24 个请求身份。

## 使用顺序

1. 独立来源提供者按照 `HOLDOUT_ROSTER_TEMPLATE.json` 的 12 个覆盖槽位提供匿名通知。
2. 标注者 A 只读取匿名来源、协议和 Schema，填写完整结构化参照。
3. 复核者 B 独立复核；分歧进入 `ADJUDICATION_TEMPLATE.csv`，解决前不得冻结。
4. 两位人员完成 `SIGNOFF_TEMPLATE.json`；任何模型辅助都会把 truth status 降为 provisional，不能称独立人工真值。
5. 将完成的密封包交给 `node scripts/validate-candidate12-human-submission.mjs <path>`。只有验证通过后，才能另行生成 candidate03 与 Candidate12 的 12×2 请求身份。
6. 任何模型派发仍需新的用户授权、发送前 24 小时内的官方价格复核和专用 grant；本包不提供派发能力。

## 文件

- `HUMAN_ANNOTATION_PROTOCOL.md`：人工角色、盲化、标注、复核和裁决流程。
- `HOLDOUT_ROSTER_TEMPLATE.json`：12 个空白来源槽位及预定覆盖；正文和 Expected 均为空。
- `HUMAN_SUBMISSION_SCHEMA.json`：未来密封提交包的机器结构。
- `REFERENCE_TEMPLATE.json`：单来源完整参照模板，不含答案。
- `SIGNOFF_TEMPLATE.json`：独立性和无模型辅助声明。
- `ADJUDICATION_TEMPLATE.csv`：分歧与裁决记录表。
- `PREREGISTRATION.md`：未来 12×2 配对顺序、失败处理、评分与晋级门槛。
- `BUDGET_AUTHORIZATION_CARD_DRAFT.md`：未来授权草案；没有 grant、预留或价格有效性声明。
- `OVERLAP_CORPUS.json`：仅包含已见历史/教学/工程文本，用于阻断重合，不是 Holdout。
- `PREPARATION_MANIFEST.json`：Candidate12 冻结、模板、工具、账本和保护状态的哈希绑定。
- `VALIDATION.md`：本阶段检查与保留阻碍。

Manifest 将六类未来评测输入分开记录：来源集和 Expected 当前为 `NOT_AVAILABLE`、SHA 为 `null`；Schema、scorer、adapter 和 Candidate12 已分别记录冻结 SHA。不得用空模板的哈希冒充来源或 Expected 哈希。

当前缺口只有真实独立人工提交。没有该提交时，正确停止状态始终是 `WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。
