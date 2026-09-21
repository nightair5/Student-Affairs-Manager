# Candidate12 Holdout 预注册

状态：`PLANNED_NOT_AUTHORIZED / INPUTS_NOT_AVAILABLE / MODEL_CALLS=0`。

## 主张与比较

主张只有一项：Candidate12 的任务守恒修正能在全新、独立人工双审来源上降低额外任务和修订端点错误，同时不牺牲合法任务召回。比较仅包括 candidate03 Prompt 基线和冻结 Candidate12；两臂都固定使用 `deepseek-flash`、temperature 0、reasoning none、8192 输出上限、同一 Schema、输入、referenceTime、timezone、适配器和评分器。

candidate03 臂使用原 candidate03 Prompt 身份，但在未来请求构造器中显式固定为同一 `deepseek-flash` 路由；不得把历史 candidate03 回答搬来充当同期对照。

## 数据与顺序

12 份来源必须在 Candidate12 提交 `c03368054ff8c357f055658c2d2d39b45bbcb761` 冻结后由独立人员提交并完成双审。当前没有来源或 Expected。

未来配对顺序预定如下，A=candidate03，B=Candidate12：

| 来源槽 | 顺序 | 来源槽 | 顺序 |
|---|---|---|---|
| H01 | A→B | H07 | A→B |
| H02 | B→A | H08 | B→A |
| H03 | A→B | H09 | A→B |
| H04 | B→A | H10 | B→A |
| H05 | A→B | H11 | A→B |
| H06 | B→A | H12 | B→A |

这只是顺序模板，不是请求身份。只有密封人工包验证通过后，才能从具体 source/reference hash 生成 24 个唯一 `unitId` 和 requestSha。

## 失败与停止

- 请求前任一来源、参照、候选、Schema、scorer、adapter、价格、账本、保护文件或授权漂移：`HARD_STOP`。
- transport、timeout、raw 保存、结算或上游是否接收不确定：整批停止，写 uncertain/halt，禁止重试。
- 明确响应中的 JSON、Schema、引用或语义失败：保留 raw、进入分母、不修复、不补发；账本状态明确时可按固定顺序继续。
- 未完成 24 个确定结局、存在未裁决人工分歧或盲化失败：`INVALID_RUN`，不得选择候选。

## 冻结评分与晋级门槛

沿用一对一结构匹配，报告逐来源配对、Schema/引用有效性、任务 TP/FP/FN、micro P/R/F1、完整来源、Major、Severe、Forbidden、时间、材料、条件、完成标准、依赖、修订、失败类别和教学泄漏。Expected 冻结后不得按模型输出扩充别名。

Candidate12 只有同时满足以下条件才可提出工程晋级：

1. 24 个单元全部有确定结局，两臂均 12/12 Schema 和引用有效。
2. Candidate12 Severe=0、Forbidden=0、教学例泄漏=0。
3. 相对 candidate03 不增加任务 FN，且时间、材料、条件、完成标准、依赖或修订的 Major 均不增加。
4. Candidate12 完整来源数至少比 candidate03 多 2。

任一条件不满足即 `REJECT_CANDIDATE12`，不得用较高 F1 降低门槛。即使通过，本批仍只是离线模型质量，不是用户接受并保存的转化率，也不授权 Preview、Production 或默认候选变更。
