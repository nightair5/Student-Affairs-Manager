# E2.9-R6 Screening Experiment Audit

**审计时间**：2026-08-20T17:53:13.531Z

**审计者**：fresh Codex same-family reviewer（只读、provisional）

**总体结论**：**WARN**

核心实验完整性通过：generation、scoring、path masking 和 Gate 均可由本地原始证据独立复算；报告中的严格指标、Token、延迟、盲评计数、两个失败 Gate 和 `EXPERIMENT BLOCKED` 结论一致。唯一警告是 Preview Feature Flag 与 Secret 的“当前实时状态”没有独立保存的 CLI transcript，本审计遵守离线边界、未联网，只能确认报告记录，不能独立证明审计时的 Cloudflare 外部状态。

## 分项结论

| 分项 | 结论 | 说明 |
|---|---|---|
| generationIntegrity | PASS | Readiness 6/6、Screening 16/16；8 个 case 每个恰有 Flash/Pro 各一次；无失败、无 fallback、每个 Screening execution 只有一次 upstream attempt。|
| scoringIntegrity | PASS | frozen source manifest 不含 expected/answer/score 类字段；Scorer 在完整 checkpoint 后才加载 expected；全部严格指标、Token 和延迟独立复算一致。|
| pathMaskIntegrity | PASS | 正式 `f` packet 的 canonical hash、8 个匿名 pair、8 个唯一 label、揭盲 hash 与时间顺序一致；packet 未检出模型身份、caseId、expected、aggregate 或运行元数据关联器。|
| gateIntegrity | PASS | 11 项 Gate 独立复算；仅 `strictPlanningErrorLower` 和 `proClearlyDegradesAtMostOnePair` 为 false。|
| qualityConclusion | PASS | 证据支持“不得进入 Selection”，不支持扩大为模型总体优劣结论。|
| finalStatus | PASS | `V4_PRO_SCREENING_R6_FAIL` 与 `EXPERIMENT BLOCKED` 正确；Selection 0、Blind 未创建、Production 未部署（实验记录层）。|
| previewCleanup | WARN | 报告记录 bearer 已删除、实验 flag 已禁用及 cleanup version；缺少独立 CLI transcript，未做实时网络复核。|

## A. Ground Truth Provenance：PASS

- generation runner 只读取 source-only manifest，并先执行字段防火墙、source/input hash 和 semanticRole 校验；没有加载 expected fixture（`scripts/run-e2-9-r1.mjs:181-193`）。递归键扫描确认 manifest 中不存在 `expected`、`answer`、`gold`、`target`、`label` 或 `score` 类字段。
- checkpoint 在 16 个 observation 全部完成后于 `2026-08-20T17:34:58.709Z` 冻结（`.evaluation-cache/e2-9-r6/protocol-3.5.0/screening/e29r6-screening-20260821-e.json:13-16`）。Scorer 先验证 checkpoint 完整性与 source/case/lineage 绑定，再于 scorer 进程中加载 Golden/Holdout/Development expected fixture（`scripts/score-e2-9-r1.mjs:73-96`、`scripts/score-e2-9-r1.mjs:106-128`）。评分时间为 `2026-08-20T17:35:19.935Z`（`.evaluation-cache/e2-9-r6/protocol-3.5.0/screening/e29r6-screening-20260821-e.strict.json:7-10`）。
- 这是已暴露诊断集上的 `real_gt` 评分，不是 Blind，也没有把模型输出派生为 ground truth。
- 可证边界限于仓库代码和已保存 artifact chronology；没有 OS 级文件访问 attestation，因此不能证明主机上任意进程绝无外部读取，但本实验链中未见破坏该边界的证据。

## B. Score Normalization：PASS

- 指标由固定的 TP/predicted/expected 计数求比率，未用模型自身 max/mean 作归一化（`src/recognition/e2/scoring.ts:398-423`）。Planning Error 由冻结 failure taxonomy 的类别前缀判定（`scripts/score-e2-9-r1.mjs:31-33`）。
- 从 16 条 rawScores 独立汇总，Flash/Pro 的所有严格指标与 aggregate 完全一致。主要复算结果：Task Precision `0.8125 / 0.9285714286`，Task Recall `0.8125 / 0.8125`，Evidence Coverage `1 / 0.9782608696`，Planning Error `0.875 / 0.875`（`.evaluation-cache/e2-9-r6/protocol-3.5.0/screening/e29r6-screening-20260821-e.aggregate.json:17-32`、`:57-72`）。
- Token 和延迟亦一致：Flash `34263` tokens、mean `9672.25ms`；Pro `33498` tokens、mean `15386ms`（同文件 `:38-45`、`:78-85`）。

## C. Generation 与结果存在性：PASS

- Readiness label `e29r6-readiness-20260821-b` 绑定 deployment `df16653f-01f6-48a6-8c66-ea36439ca6a0`，6 个 `alias+sequence` 与 6 个 requestId 均唯一，requested/returned model 一致，6/6 为 PASS（`.evaluation-cache/e2-9-r6/protocol-3.5.0/readiness/e29r6-readiness-20260821-b.json:4-13`、`:24-46`、`:123-157`、`:197-234`）。所有 raw body/header hash 复算通过。
- Screening checkpoint 的 observation index 为完整 `1..16`；`caseId+modelAlias` 16 个唯一组合；8 个 frozen screening case 每个恰有两臂。每条均满足：manifest/observation/payload/execution 的 semanticRole 一致；manifest content/sourceSha256/execution sourceSha256 一致；manifest/observation 的 canonical inputSha256 一致；requestedModel、returnedModel、executionModel、result.modelName 四向一致；raw body、raw output 和 result hash 全部复算通过。
- `information_only` case 的两臂均为 `requiresAction=false`、业务实体数 0、evidence 数 1，符合合法纯信息契约（生成校验见 `scripts/run-e2-9-r1.mjs:95-115`）。
- qualification bundle、deployment projection 与 qualification result canonical hash 独立重算分别为 `e204369f...c6565`、`fb1a3dda...a8b1`、`9cb94199...6d16`，与冻结文件一致（`docs/e2-v4-pro-benchmark-r6/qualification-result.json:8-9`、`:53-54`）。

## D. Path-masked Review：PASS

- 正式 `f` packet canonical SHA-256 为 `96bab52e...ac15`，与 state/Gate 一致。packet 只包含匿名 id、source、X/Y 业务结果和 rubric；独立内容扫描未检出模型名、Flash/Pro、caseId、expected、aggregate、hash、latency、token 等可确定关联字段。正式 packet 审计记录 `canIdentifyEitherPath=false`、无 correlator/identity disclosure、verdict PASS（`.evaluation-cache/e2-9-r6/reviews/e29r6-screening-20260821-f/packet-audit.json:2-10`）。
- 时间顺序严格递增：generation complete `17:34:58.709Z` → scoring `17:35:19.935Z` → packet `17:40:00.326Z` → independent audit `17:41:23.643Z` → labels freeze `17:42:21.373Z` → reveal `17:42:21.386Z` → Gate `17:42:21.400Z`（review state `:7-12`；reveal result `:7-8`；packet audit `:8`；Gate `evaluatedAt`）。
- 8 个 label id 唯一，labels canonical SHA-256 `65fc8475...b19` 与 envelope/Gate 一致。独立按 reveal mapping 复算：Pro preferred 3、Flash preferred 3、TIE 2、insufficient 0；Pro/Flash Major `3/2`；Planning Error `5/5`（`.evaluation-cache/e2-9-r6/reviews/e29r6-screening-20260821-f/reveal-result.json:61-68`）。
- 失败的 `e` review 目录只有 packet、state、audit 和不合 schema 的 draft；不存在 labels-envelope、reveal-result 或 screening-gate，因此 fail-closed。其 draft 未纳入正式 `f` 计数。

## E. Gate 与停止边界：PASS

- 11 项 Gate 独立复算与保存结果完全一致。失败项只有：
  - `strictPlanningErrorLower=false`：两臂均为 `0.875`；
  - `proClearlyDegradesAtMostOnePair=false`：Flash preferred 为 3，超过上限 1。
- Gate 状态为 `V4_PRO_SCREENING_R6_FAIL`，并明确 `selection=NOT_RUN`、`blind=NOT_CREATED`、`production=NOT_DEPLOYED`（`.evaluation-cache/e2-9-r6/reviews/e29r6-screening-20260821-f/screening-gate.json:28-38`）。当前 R6 cache 中不存在 `e29r6-selection-20260821*` 或 `e29r6-blind-20260821*` artifact。
- 报告中的全部数值、失败项和 `EXPERIMENT BLOCKED` 与原始 artifact 一致（`docs/e2-v4-pro-benchmark-r6/runs/e29r6-screening-20260821-e/screening-report.json:105-109`、`:133`）。没有发现需修复的报告数字错误。

## F. Scope 与声明：PASS（带限定）

- 实际范围是同 deployment、同 frozen case set 的 8 个配对 case、16 次 Screening 生成，外加 6 次 Readiness；不构成模型全面优劣结论。
- 报告只据预设 Gate 得出“不推进 Selection”，没有声称 Pro 总体劣于 Flash，因此声明没有超出证据。
- Preview cleanup 的实时外部状态只在报告中记录（`screening-report.json:123-130`）；本只读审计未联网、未读取 Secret 值，也没有独立 CLI transcript 可复核，故该单项保持 WARN。

## 哈希复算摘要

| Artifact | raw byte SHA-256 | canonical SHA-256 |
|---|---|---|
| source-only manifest | `115b43f9...a12f` | `8cfe76b1...3a01` |
| readiness checkpoint | `c9b919ad...54ab` | `5a9f906b...eeff` |
| screening checkpoint | `79379e15...7de4` | `ba14b976...c1a6` |
| strict result | `bcc84e73...8c64` | `2405c74b...53f3` |
| aggregate | `60f97511...ee2` | `547fb220...bd4` |
| formal reviewer packet | `a78dc708...dd9` | `96bab52e...ac15` |
| formal labels draft | `33cf7ca8...2de4` | `65fc8475...b19` |
| formal gate | `d6435e50...3f6` | `41390267...edcb` |

## Git 只读快照

- 分支：`codex/e2-9-r6-harness-qualification`
- HEAD：`70685ac fix(app): repair r6 screening protocol integrity`
- 审计开始时 tracked 工作树无修改；`docs/e2-v4-pro-benchmark-r6/runs/` 为主执行者新建的未跟踪报告目录，raw cache 为 ignored。本审计只新增本文件与 `experiment-audit.json`，未提交、未推送。

## 最终判断

**Overall: WARN**。核心实验完整性为 PASS，质量结论和停止动作得到支持；警告仅针对无法离线独立验证的实时 Preview/Secret cleanup 状态。最终状态应保持 **EXPERIMENT BLOCKED**，不得执行 Selection、Blind 或 Production。
