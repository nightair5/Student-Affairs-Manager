# Student Affairs Product v2.0 — E2 Final Report

更新时间：2026-08-09（Asia/Shanghai）

## 1. Executive Summary

E2 在不修改 Workspace v8、Migration、Repository、DomainCommitPlan、Project Matching、Follow 和 UI 主流程的前提下，完成了 RecognitionResult 2.0 的质量工程链路：冻结 Golden/Holdout、Error Taxonomy、模块化输出合同、Recognition Quality Validator、最多一次 Conditional Repair、确定性 Complexity Router、ModelGateway、有限传输重试、版本化执行元数据和真实 DeepSeek 评估。

当前结论是 **E2 BLOCKED / E3 NOT READY**：

- Golden After 110/110 完成并通过全部核心门槛。
- 首次独立 Holdout After 仅 39/40 完成，Task Precision/Recall、Event、Major Correction、Severe Error 与 Request Failure 未达门槛，构成明确泛化崩塌。
- A–J 浏览器矩阵只完成首页与服务状态检查；实际整理交互连续触发浏览器控制超时，不能宣称完整验收通过。
- 权威 E2 失败保护要求 Holdout 明显低于 Golden 时停止，不得反向修改 expected、针对已见 Holdout 调参或强行宣布成功。
- Preview 已发布候选代码；Production `https://student-affairs.site/` 未被本轮覆盖。

## 2. Baseline

E2-A 冻结的 110 条 Golden / DeepSeek 生产 Before：

| Metric | Before |
| --- | ---: |
| Project Decision Accuracy | 84.55% |
| Milestone Precision / Recall | 52.17% / 16.44% |
| Task Precision / Recall | 81.90% / 74.80% |
| Material Precision / Recall | 96.88% / 30.69% |
| TimePoint Precision / Recall / Overall | 100.00% / 6.38% / 6.38% |
| Event Accuracy | 86.96% |
| Evidence Coverage / Validity | 95.33% / 100.00% |
| Duplicate / Over-fragmentation | 0.00% / 0.00% |
| Major Correction / Severe Error | 87.27% / 5.45% |
| Invalid Output / Request Failure | 0.00% / 1.82% |
| Latency mean / p50 / p95 | 6,266 / 5,698 / 12,725 ms |
| Token / Cost | NOT OBSERVABLE |

## 3. Error Taxonomy

E2-B 冻结了 33 类错误标签，覆盖 Project、Milestone、Task、Material、TimePoint、Event、Evidence、Ambiguity、Reference、Schema、Prompt Injection、Transport、Repair 与 Severe Error。Major Correction 和 Severe Error 的定义在评估前冻结，没有为提高 After 分数修改。

Golden Before 的主要失败为 `time_missing` 127、`material_missing` 67、`milestone_missing` 56、`project_decision` 29、`task_missing` 29、`ambiguity_missing` 26、`task_spurious` 17、`evidence_missing` 6、`event_missing` 2、`request_failure` 2、`task_hierarchy` 2。

Golden/Holdout source、freeze hash 和 corrections log 保持未修改；逐例 failures JSON 只保存匿名 case ID、分类、严重度、原因与执行元数据，不保存真实用户正文。

## 4. Prompt / Output Contract Changes

运行身份：

| 项目 | 值 |
| --- | --- |
| Provider | `deepseek-production` |
| Model | `deepseek-v4-flash` |
| Schema | `RecognitionResult 2.0` |
| Prompt | `recognition-2.3.0` |
| Pipeline | `recognition-pipeline-2.1.2` |
| Validator | `recognition-quality-2.0.0` |
| Repair | `recognition-repair-1.0.0` |
| Router | `recognition-router-1.0.0` |
| Gateway | `model-gateway-1.0.0` |
| Retry | `recognition-retry-1.0.0` |

合同拆分为安全边界、输出结构、时间、材料、项目层级、证据/歧义和质量约束。来源始终是 DATA ONLY；所有实体必须引用逐字 Evidence；Material、TimePoint、Event 保持顶层独立集合；Task/Subtask 最大一层；未知时间不得使用哨兵日期或伪精确值。浏览器 TypeScript 与 Worker MJS 维持同一语义合同。

## 5. TimePoint Improvements

- 每个业务时间表达都必须形成顶层 TimePoint，即使 Task、Material 或 Event 同时引用它。
- 区分 registration/submission/task/material deadline、event start/end、result announcement、planned start 和 other。
- exact、date_only、relative、vague 分离；relative/vague 无可靠参考时保持 `normalizedValue=null`、`needsConfirmation=true`。
- 报名截止与“报名表材料截止”按上下文区分。
- 日期只有年月日时保持 date-only，不自动补 `23:59:59`。
- Validator 检查缺失顶层时间、非法归一值、哨兵日期、假精确和缺失歧义；Repair 只可用已有证据补回。

Golden TimePoint Accuracy 从 6.38% 提升到 91.67%；Holdout 为 78.69%。Holdout 的 `time_missing` 8、`time_incorrect` 4、`time_spurious` 4 仍显示模糊时间与复杂场景泛化不足。

## 6. Material Improvements

- Task 表示动作，Material 表示需准备、获取、填写、制作、提交、上传、携带或核验的对象。
- 支持 required、format、fileType、naming requirement、quantity、size limit、submission channel、related task 与 deadline 等原文明示属性。
- 参考文件、背景名词和纯格式说明不得自动冒充必交材料。
- 多项明确交付物可拆成独立 Material，仍共享可追溯 Evidence。
- Material 不再通过旧 Task 字符串投影进入 v8；正式确认继续走 E1 DomainCommitPlan。

Golden Material Recall 从 30.69% 提升到 98.02%；Holdout 为 100%。Golden Material Precision 为 93.40%，Holdout 为 98.15%。

## 7. Milestone / Task Improvements

- Milestone 只表示报名、制作、提交、答辩等真实阶段，不把下载、命名、导出、上传按钮操作机械提升为阶段。
- 简单通知允许 0–1 个阶段；复杂通知按证据建议真实阶段。
- Task 必须是“动作 + 明确对象”，可执行、可完成、可判断状态。
- 纯格式动作、纯信息、与 Event 重复的参加类动作、无原文动作依据的“查看结果/等待通知”等被确定性过滤。
- Subtask 深度保持最多一层；不得用增加伪任务暴力提高 Recall。

Golden Task P/R 为 86.61%/86.61%，达到门槛；Holdout 只有 70.69%/77.36%，未达到 85%/82%。Golden Milestone Recall 仅 21.92%，Holdout 48.28%，虽未纳入当前硬门槛，但仍是重要短板。

## 8. Ambiguity Improvements

主体不明、条件适用、相对/模糊时间、OCR 疑似字符、更正冲突、渠道不清、“另行通知/暂定/原则上”等应显式进入 Ambiguity/Conflict，并引用逐字 Evidence。正确指出不知道优先于自信猜测。

Golden Ambiguity P/R 为 34.04%/59.26%，存在 29 个 `ambiguity_spurious` 与 11 个 `ambiguity_missing`；Holdout为 88.89%/66.67%，仍有 8 个缺失。这一能力尚未达到稳定可依赖水平。

## 9. Quality Validator

`recognition-quality-2.0.0` 是纯函数，只报告问题，不创建事实、不写 Domain、不覆盖用户确认结果。覆盖：

- ID 与引用完整性。
- Evidence 是否能逐字回到 Source。
- Task/Subtask 最大深度。
- 缺失顶层 TimePoint、非法日期、false precision。
- Material/Event/Milestone 的结构和引用。
- 疑似假动作、纯信息误建任务、重复和过度拆分。

单元测试与 Worker 集成测试通过；Validator 触发只决定是否允许最多一次 Repair，不自行填充业务答案。

## 10. Repair

`recognition-repair-1.0.0` 只在 Evidence、TimePoint、Material、Event、Milestone 或时间歧义存在可修复结构缺口时触发；每次管线最多一个 repair operation。deterministic merge 保留第一份合法结果，不允许 Repair 新增无证据 Task，也不允许无限循环。

| Dataset | Trigger | Success | Repair mean | Repair p95 |
| --- | ---: | ---: | ---: | ---: |
| Golden After | 15.45% | 29.41% | 8,926 ms | 12,330 ms |
| Holdout After | 23.08% | 66.67% | 8,038 ms | 14,342 ms |

Repair 明显增加触发样例延迟，但没有扩展到所有请求。复杂两阶段调用继续关闭。

## 11. Complexity Router

`recognition-router-1.0.0` 使用输入长度、时间表达、动作词、列表、条件与更正语义进行确定性分级，不先额外调用大模型。

- Golden：simple 87 / medium 21 / complex 2。
- Holdout：simple 24 / medium 12 / complex 3 / unknown 1（一次请求失败）。
- simple/medium 继续 single pass + validator + conditional repair。
- complex 的 `fact_then_plan` 仅为候选；因 Holdout 未证明质量净收益，two-pass 仍为关闭状态。

## 12. Model Gateway

`model-gateway-1.0.0` 统一 `recognize()`、`repair()`、`extractFacts()`。业务依赖内部 Gateway 合同，而不是 DeepSeek 特定 HTTP 响应。Worker `DeepSeekProvider` 是唯一接触服务端 Secret 的实现；浏览器不持有密钥，Mock 只用于确定性测试。

每个成功 RecognitionRun 可记录 provider、model、prompt/schema/pipeline/validator/repair/router/gateway/retry 版本、attempts、duration、transport status、quality flags 和上游真实 usage。上游没有数据时保持 null，不估算。

## 13. Reliability

`recognition-retry-1.0.0` 只对 429、502、503、network error 和 timeout 做一次有限重试，使用退避与抖动；400、输入校验、非法 JSON/Schema 和语义失败不重试。评估器不再叠加业务请求重试，Transport Failure 与 Semantic Failure 分开。

- Golden After：110/110，Request Failure 0%，Retry Rate 0%。
- Holdout After：39/40，一次真实传输失败，Request Failure 2.5%，高于 ≤1% 门槛；评估器没有补跑或覆盖。
- Source-before-AI 保持：最终失败只影响 RecognitionRun/Draft，已保存 Source 不丢失，也不创建半成品正式实体。

## 14. Before vs After Metrics

| Dataset / Provider | Project | Task P/R | Material P/R | Time P/R/Overall | Event | Evidence Cov/Valid | Major | Severe | Invalid | Request |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Golden Before / DeepSeek 2.0 | 84.55% | 81.90% / 74.80% | 96.88% / 30.69% | 100.00% / 6.38% / 6.38% | 86.96% | 95.33% / 100% | 87.27% | 5.45% | 0% | 1.82% |
| Golden After / DeepSeek 2.3 | **97.27%** | **86.61% / 86.61%** | **93.40% / 98.02%** | **97.90% / 99.29% / 91.67%** | **91.30%** | **98.05% / 100%** | **30.91%** | **0%** | **0%** | **0%** |
| Holdout Before / DeepSeek 2.0 | 80.00% | 68.57% / 45.28% | 94.44% / 32.08% | 100.00% / 3.33% / 3.33% | 66.67% | 83.61% / 100% | 90.00% | 10.00% | 0% | 5.00% |
| Holdout After / DeepSeek 2.3 | **95.00%** | **70.69% / 77.36%** | **98.15% / 100%** | **89.66% / 86.67% / 78.69%** | **82.35%** | **95.63% / 100%** | **60.00%** | **2.50%** | **0%** | **2.50%** |

门槛：Project ≥88%；Task P/R ≥85%/82%；Material R ≥75%；Time ≥75%；Event ≥86.96%；Evidence ≥95.33%；Duplicate ≤3%；Over-fragmentation ≤5%；Major ≤35%；Severe ≤2%；Invalid/Request 各 ≤1%。

Golden 全门槛通过。Holdout 失败项：Task P、Task R、Event、Major、Severe、Request。Duplicate 与 Over-fragmentation 在两组 After 均为 0。

## 15. Regression

以下旧能力保持：

- Workspace v8、v7→v8 Migration/Backup/Rollback、Canonical Repository、DomainCommitPlan、atomic commit、Source-before-AI 未改契约。
- Prompt Injection 安全样例 Task P/R 为 100%，来源指令未被执行。
- Evidence Validity 100%，Coverage 未低于 95.33% 保护线。
- Duplicate 与 Over-fragmentation 均为 0。
- Golden Event 91.30% 高于 Before；Holdout Event 82.35% 仍未达到保护线。
- UTC 与 Asia/Shanghai 下 E1/E2 全量测试均通过。
- 未进入 Project Matching/Memory、Follow、Risk、D1/R2、Auth、Sync 或 UI 重构。

## 16. Failed Samples

Golden After 的主要剩余差异：`milestone_missing` 57、`ambiguity_spurious` 29、`task_missing` 17、`task_spurious` 15、`ambiguity_missing` 11、`time_incorrect` 8、`material_spurious` 7、`evidence_missing` 5、`task_hierarchy` 4。

Holdout After 的主要差异：`milestone_missing` 15、`task_missing` 12、`task_spurious` 11、`ambiguity_missing` 8、`evidence_missing` 8、`time_missing` 8、`time_incorrect` 4、`time_spurious` 4、`event_missing` 3、`project_decision` 1、`request_failure` 1。

最弱分组包括 scholarship（Task P/R 25%/50%）、material（33.33%/33.33%）、application（57.14%/80%）、vague_time（Time 20%）和 event（Event 66.67%）。这些结果只用于说明阻塞，不用于反向修改冻结 Holdout。

## 17. Performance

| Dataset | mean | p50 | p95 |
| --- | ---: | ---: | ---: |
| Golden Before | 6,266 ms | 5,698 ms | 12,725 ms |
| Golden After | 8,153 ms | 6,017 ms | 20,983 ms |
| Holdout Before | 6,852 ms | 6,058 ms | 13,213 ms |
| Holdout After | 9,262 ms | 7,013 ms | 22,876 ms |

After 延迟高于 Before，主要来自条件 Repair 与更丰富输出。Simple/Medium 没有强制双调用，Complex two-pass 未开启。虽然平均延迟未翻倍，但 p95 上升明显，仍需在后续独立优化中评估。

## 18. Token / Cost

- Golden After：input 268,472；output 158,683，来自真实 Worker execution metadata。
- Golden Cost：`NOT OBSERVABLE`，上游未返回可审计费用；未使用公开价格估算冒充实测。
- Holdout Token/Cost：`NOT OBSERVABLE`，一次请求失败导致运行级 usage 不完整；未用部分和冒充完整运行用量。

## 19. Files Changed

本轮 E2 分阶段变更的核心路径：

- `src/recognition/e2/*`、`scripts/run-recognition-e2.mjs`：冻结数据、评分、taxonomy、门槛、断点续跑和 provider 分离。
- `src/recognition/promptModules.ts`、`cloudflare/recognition-prompt.mjs`：模块化 Output Contract。
- `src/recognition/qualityValidator.ts`、`cloudflare/recognition-quality.mjs`：纯 Recognition Quality Validator。
- `src/recognition/repair.ts`、`cloudflare/recognition-repair.mjs`：最多一次 Conditional Repair 与 deterministic merge。
- `src/recognition/complexityRouter.ts`、`cloudflare/complexity-router.mjs`：确定性复杂度路由。
- `src/recognition/modelGateway.ts`、`cloudflare/model-gateway.mjs`：Provider/Gateway/metadata/retry。
- `cloudflare/recognition.mjs`、`cloudflare/worker.mjs`、`src/App.tsx`：最小编排、近 Schema 归一化、证据与伪任务防护、版本记录。
- `docs/E2-*.md`、`docs/baselines/e2-*`：协议、Before/After、错误分类与阻塞证据。

Scope 审计：Domain v8 NO；Migration NO；UI architecture NO；E3 NO；E4 NO；Production deploy NO。

## 20. Tests

2026-08-09 真实执行：

- `npm run lint`：PASS。
- `npm run typecheck`：PASS。
- `TZ=UTC npm test`：PASS，45 files / 178 Vitest tests；Dataset Freeze 4、Server 8、Worker 25、Functions 5 均 PASS。
- `TZ=Asia/Shanghai npm test`：同上 PASS。
- `npm run build`：PASS。
- `npm run server:check`：PASS。
- `npm run security:scan`：PASS，251 个源码/构建文件未发现 Secret。
- `npm audit --audit-level=high`：PASS，0 vulnerabilities。
- `npm run cloudflare:check`：PASS，Worker 25 tests、Production/Preview dry-run 均通过。
- Golden After：PASS（110/110，全部门槛通过）。
- Holdout After：FAIL（39/40，多项质量门槛未通过）。

浏览器实际确认：Preview 首页成功加载、无白屏、显示 `DeepSeek V4 Flash 已连接`、首页最多三项任务、截止/风险/下一步/“标记完成”可见、待确认入口显示持久化说明。A–J 逐例 UI 提交与 Draft → Confirm → atomic commit → reload 因浏览器控制连续超时为 **PARTIAL / TOOL BLOCKED**，不是 PASS。

## 21. Remaining Risks

1. Holdout Task P/R 相比 Golden 明显崩塌，存在过拟合风险。
2. Milestone Recall 很低；阶段结构仍需大量人工补正。
3. Scholarship、material、application、vague_time、event 分组泛化不足。
4. Ambiguity 在 Golden 上假阳性较多，在 Holdout 上仍有缺失。
5. Holdout Event 低于基线保护线；不能为提高 Task Recall 继续牺牲 Event。
6. Holdout Severe Error 2.5%、Request Failure 2.5%，均超过门槛。
7. Repair 增加延迟，p95 已明显高于 Before；two-pass 没有启用依据。
8. A–J 浏览器矩阵与完整 Draft/Confirm/reload 尚无可靠证据。
9. 当前 Preview 是候选版本，不等于可上线版本；Production 保持旧稳定代码。

## 22. E2 Definition of Done

| Item | Status |
| --- | --- |
| Golden 未为刷分修改；corrections log 冻结 | PASS |
| 独立 Holdout 与 Error Taxonomy | PASS |
| TimePoint / Material / Milestone / Ambiguity 合同 | PASS |
| Validator 不编造事实 | PASS |
| Repair 最多一次、deterministic merge | PASS |
| Router；simple 不强制多调用；two-pass 有收益才启用 | PASS |
| ModelGateway；仍使用 DeepSeek；版本与 metadata | PASS |
| Transport/Semantic 分离；有限 retry；Source 保持 | PASS |
| Prompt Injection / Evidence / Duplicate / Over-fragmentation | PASS |
| Golden Before/After | PASS |
| Holdout After 全门槛 | **FAIL** |
| Event 不明显退步 | **FAIL（Holdout 82.35%）** |
| Severe / Transport 门槛 | **FAIL（各 2.5%）** |
| A–J 浏览器回归 | **PARTIAL / TOOL BLOCKED** |
| E1 regression 与工程门槛 | PASS |
| Production 未部署；E3/E4 未提前实施 | PASS |

失败保护已触发：Holdout 明显低于 Golden、Task 泛化 Precision 不足、Event 下降、Severe Error 上升。按权威实施提示必须输出 `E2 BLOCKED` 并停止，不能用修改标准答案、重复挑选一次好结果或针对已见 Holdout 打补丁来强行通过。

## 23. E3 Readiness

**NOT READY**。

本轮不执行 Production deploy，不进入 E3/E4。Production `https://student-affairs.site/` 当前仍返回 HTTP 200 并保持原稳定版本；候选代码只在 `https://student-affairs-manager-preview.nightsdell.workers.dev/`。

后续若经人工批准开启新的 E2 迭代，应建立新的开发数据处理通用任务别名/层级、奖学金/申请、事件与模糊时间，不得查看或修改旧 Holdout expected；最终必须使用全新、未见盲测和稳定浏览器环境重新验收。达到全部门槛后才可判定 READY。
