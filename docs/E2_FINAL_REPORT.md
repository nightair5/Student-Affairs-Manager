# Student Affairs Product v2.0 — E2 Final Report

## 1. Executive Summary

E2 在不修改 Workspace v8、Migration、Repository、DomainCommitPlan、Project Matching、Follow 和 UI 主流程的前提下，为 RecognitionResult 2.0 建立了可审计的质量工程链路：冻结 Golden/Holdout、模块化输出合同、纯结构质量校验、最多一次的条件修复、确定性复杂度路由、DeepSeek ModelGateway、有限传输重试、可观测执行元数据和统一质量门槛。

工程实现与 E1 回归均通过；但 E2 质量验收为 **E2 BLOCKED**。原因是当前生产仍运行旧 `recognition-2.0.0`，本轮又明确禁止生产部署；本机没有 `DEEPSEEK_API_KEY`、有效 Wrangler 登录或 `CLOUDFLARE_API_TOKEN`，因此不能对优化后的 `recognition-2.1.0` 执行真实 DeepSeek Golden After 与 Holdout After。Local fallback、Mock 和旧生产 Prompt 均未被冒充为 After。

## 2. Baseline

E2-A 冻结的 110 条 Golden / DeepSeek 生产基线：

| Metric | Before |
| --- | ---: |
| Project Decision Accuracy | 84.55% |
| Milestone Precision / Recall | 52.17% / 16.44% |
| Task Precision / Recall | 81.90% / 74.80% |
| Material Recall | 30.69% |
| TimePoint Accuracy | 6.38% |
| Event Accuracy | 86.96% |
| Evidence Coverage | 95.33% |
| Duplicate / Over-fragmentation | 0.00% / 0.00% |
| Major Correction / Severe Error | 87.27% / 5.45% |
| Invalid Output / Request Failure | 0.00% / 1.82% |
| Latency mean / P50 / P95 | 6,266 / 5,698 / 12,725 ms |

## 3. Error Taxonomy

Golden Before 的主要失败为 `time_missing` 127、`material_missing` 67、`milestone_missing` 56、`project_decision` 29、`task_missing` 29、`ambiguity_missing` 26、`task_spurious` 17、`evidence_missing` 6、`event_missing` 2、`request_failure` 2、`task_hierarchy` 2。E2-B 将其扩展为 33 个稳定标签；逐样例分类、严重度和原因保存于 baseline failures JSON，不保存真实用户正文。

## 4. Prompt / Output Contract Changes

Prompt 从 `recognition-2.0.0` 升到 `recognition-2.1.0`，模型保持 `deepseek-v4-flash`，Schema 保持 `2.0`。合同拆成安全边界、输出合同、时间、材料、结构、证据/歧义、质量七个模块；浏览器 TypeScript 与 Worker MJS 使用同一语义合同。来源始终是 DATA ONLY；所有实体必须引用逐字 Evidence；Material、TimePoint、Event 是顶层独立集合；Subtask 最大一层；不得用哨兵日期或伪精确时间。

## 5. TimePoint Improvements

合同要求每个有业务意义的时间表达形成独立顶层 TimePoint，区分 exact、date_only、relative、vague。relative/vague、OCR 歧义或无法可靠归一时必须 `normalizedValue=null`、`needsConfirmation=true` 并创建 Ambiguity。Validator 检查缺失引用、非法归一值、哨兵日期和 false precision；Repair 只能用已有逐字证据补回缺失/模糊时间，不能发明日期。真实 After 未运行，因此不能宣称 Accuracy 已提升。

## 6. Material Improvements

合同明确交付物、证明、表格、文件和携带物应成为独立 Material，普通背景名词不得冒充材料；格式、命名、数量、渠道与关联任务保持独立字段。Validator 检查材料引用和材料型文本被错误当作任务；Repair 只允许从已有证据恢复缺失 Material。真实 After 未运行，因此不能宣称 Recall 已提升。

## 7. Milestone / Task Improvements

Milestone 仅用于具有真实阶段结构的项目，简单通知不强制创建；Task 必须是动作加明确对象，Material、地址、联系人和格式要求不得独立冒充 Task；Subtask 最深一层。质量校验检测孤儿 Subtask、引用缺失、疑似假动作、重复和过度拆分。正式确认仍走 E1 `DomainCommitPlan` 原子提交。

## 8. Ambiguity Improvements

合同要求主体不明、条件适用、模糊/相对时间、OCR 疑似字符、更正冲突和项目归属不确定显式进入 Ambiguity/Conflict，不得静默猜测。每项歧义也必须引用 Evidence。

## 9. Quality Validator

`recognition-quality-2.0.0` 是纯函数，只报告问题并给出受影响路径：ID 唯一性、引用完整性、Evidence 引用、Subtask 深度、TimePoint 合法性/伪精确、Material/Event/Milestone 结构、假动作、重复和过度拆分。它不创建事实、不写 Domain、不覆盖用户确认结果。单元测试和 Worker 集成测试均通过。

## 10. Repair

`recognition-repair-1.0.0` 只在缺失 Evidence、TimePoint、Material、Event、Milestone、时间歧义或 false precision 时触发；每次管线最多一个 repair operation，失败保留第一份合法结果，deterministic merge 不允许新增任务。由于真实 After 未运行，Repair trigger rate、success rate 与真实 latency impact 为 **NOT RUN / NOT OBSERVABLE**，不能用 Mock 测试结果代替。

## 11. Complexity Router

`recognition-router-1.0.0` 依据长度、时间表达、动作词、列表、更正和条件语义确定性分级。冻结数据静态分布为 Golden：simple 87 / medium 21 / complex 2；Holdout：simple 25 / medium 12 / complex 3。simple/medium 继续 single pass；complex 仅把 `fact_then_plan` 作为候选。因为没有真实 Holdout After 收益证据，两阶段调用保持关闭。

## 12. Model Gateway

`model-gateway-1.0.0` 统一 recognize、repair、extractFacts。Worker 的 `DeepSeekProvider` 是唯一接触服务端 Secret 的实现；浏览器仅使用无密钥接口，Mock 只用于确定性测试。Provider 仍为 DeepSeek，模型未更换。成功响应只返回去除模型正文的 execution 元数据。

## 13. Reliability

`recognition-retry-1.0.0` 只对 429、502、503、网络错误和 timeout 重试一次，使用指数退避与抖动；400、输入校验、JSON/Schema 和语义失败不重试。评估器不再叠加重试，Transport Failure 与 Semantic Failure 分开。旧生产 Holdout Before 仍有 2/40 请求失败，说明优化后改善尚待真实 After 验证。

## 14. Before vs After Metrics

| Dataset / Provider | Project | Task P/R | Material R | Time | Event | Evidence | Major | Severe | Transport |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Golden Before / DeepSeek 2.0 | 84.55% | 81.90% / 74.80% | 30.69% | 6.38% | 86.96% | 95.33% | 87.27% | 5.45% | 1.82% |
| Golden After / DeepSeek 2.1 | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** |
| Holdout Before / DeepSeek 2.0 | 80.00% | 68.57% / 45.28% | 32.08% | 3.33% | 66.67% | 83.61% | 90.00% | 10.00% | 5.00% |
| Holdout After / DeepSeek 2.1 | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** | **NOT RUN** |
| Golden / local fallback | 79.09% | 69.40% / 73.23% | 58.42% | 25.81% | 52.00% | 87.94% | 94.55% | 18.18% | 0.00% |
| Holdout / local fallback | 77.50% | 40.82% / 37.74% | 30.19% | 28.79% | 50.00% | 89.07% | 100.00% | 22.50% | 0.00% |

Gate 要求 Project ≥88%、Task P/R ≥85%/82%、Material ≥75%、Time ≥75%、Event ≥86.96%、Evidence ≥95.33%、Duplicate ≤3%、Over-fragmentation ≤5%、Major ≤35%、Severe ≤2%、Invalid/Transport 各 ≤1%。没有真实 After 就不能判定通过。

## 15. Regression

Workspace v8、v7→v8 Migration/Backup/Rollback、Canonical Repository、DomainCommitPlan、atomic commit、Source-before-AI、Draft 人工确认、Today、Tasks、Projects、Calendar、OCR、知识问答和导出均未改契约。UTC 与 Asia/Shanghai 下 E1/E2 全量测试都通过。没有部署生产、没有进入 Project Matching/Memory、Follow、Risk、D1/R2、Auth、Sync 或 UI 重构。

## 16. Failed Samples

Holdout Before 最典型问题：复杂通知两条真实请求失败；49 个时间遗漏、30 个材料遗漏、24 个任务遗漏、22 个歧义遗漏、13 个阶段遗漏、11 个伪任务、9 个项目判断错误、7 个证据缺口。复杂通知完成率仅 2/4，申请类 Project Decision 25%，多截止 TimePoint 为 0%。逐条记录见 `docs/baselines/e2-i/holdout-before-deepseek-production-failures.json`。

## 17. Performance

Golden Before mean/P50/P95 为 6.27/5.70/12.73 秒；Holdout Before 为 6.85/6.06/13.21 秒。优化后真实延迟、Repair 额外延迟和两阶段成本均 NOT RUN。两阶段路由保持关闭，避免在没有质量收益证据时增加延迟。

## 18. Token / Cost

旧生产响应没有完整 operation usage，Golden/ Holdout Before Token 与 Cost 均 `NOT OBSERVABLE`。新 Gateway 只在上游真实返回完整 usage 时聚合，否则保持 null；不使用字符数或公开价格估算冒充实测。

## 19. Files Changed

- `src/recognition/e2/*`、`scripts/run-recognition-e2.mjs`：冻结数据、评分、taxonomy、门槛与可重复 runner。
- `src/recognition/promptModules.ts`、`cloudflare/recognition-prompt.mjs`：七模块合同。
- `src/recognition/qualityValidator.ts`、`cloudflare/recognition-quality.mjs`：纯结构质量校验。
- `src/recognition/repair.ts`、`cloudflare/recognition-repair.mjs`：最多一次条件修复与确定性合并。
- `src/recognition/complexityRouter.ts`、`cloudflare/complexity-router.mjs`：复杂度路由。
- `src/recognition/modelGateway.ts`、`cloudflare/model-gateway.mjs`：Provider/Gateway/metadata/retry。
- `cloudflare/recognition.mjs`、`cloudflare/worker.mjs`、`src/App.tsx`：最小编排接线与版本记录，不改变 Domain v8。
- `docs/E2-*.md`、`docs/baselines/e2-*`：协议、结果与审计证据。

## 20. Tests

- `npm ci`：PASS（首次因本地 Vite 占用 esbuild 失败，关闭验收服务器后同命令 PASS；0 vulnerabilities）。
- `npm run lint`：PASS。
- `npm run typecheck`：PASS。
- `TZ=UTC npm test`：PASS，45 files / 177 Vitest tests；Golden/Holdout freeze、Server 8、Worker 19、Functions 5 全部 PASS。
- `TZ=Asia/Shanghai npm test`：同上 PASS。
- `npm run build`：PASS。
- `npm run security:scan`：PASS，241 个源码/构建文件未发现 Secret。
- `npm audit --audit-level=high`：PASS，0 vulnerabilities。
- `npm run cloudflare:check`：PASS，Worker 19 tests 与默认/preview 两次 dry-run 均通过。
- 浏览器本地验收：多截止来源先保存 Source/Draft，显示 Evidence/Material/TimePoint/Event，确认后任务进入任务中心，刷新后恢复；页面无 console error。DeepSeek 未配置时诚实显示本地规则并保留来源。A–J 的真实优化模型浏览器矩阵未运行，原因与 After 相同；不能伪造 PASS。

## 21. Remaining Risks

1. 优化后真实 DeepSeek 质量和延迟未测；所有质量改善仍是合同与防护能力，不是已证明的指标提升。
2. Holdout Before 明显低于 Golden，存在复杂通知、申请、多截止的泛化风险。
3. Repair 的真实触发率、成功率、token 与延迟未知。
4. Two-pass 的收益未知，因此保持关闭。
5. 本地 fallback 明显低于质量门槛，只是保底，不是 E2 After。
6. 公网站点仍是旧 Prompt；本轮按禁令没有部署。

最小解阻：在安全的非生产 Cloudflare 预览环境完成 Wrangler 登录或提供环境级 `CLOUDFLARE_API_TOKEN`，并通过 `wrangler secret put DEEPSEEK_API_KEY --env preview` 配置 Secret；不得把 Key 发到聊天、前端、文件或 Git。随后部署精确 E2 commit 到 preview，运行 Golden/Holdout After 与 A–J 浏览器验收；达到门槛后才可判定 E2 Complete。

## 22. E2 Definition of Done

| Item | Status |
| --- | --- |
| Golden 未为刷分修改；Holdout 与 taxonomy 已建立 | PASS |
| Time/Material/Milestone/Ambiguity 合同 | PASS |
| Validator 不编造事实 | PASS |
| Repair 最多一次、deterministic merge | PASS |
| Router；simple 不强制多调用；two-pass 有收益才启用 | PASS |
| ModelGateway；仍使用 DeepSeek；版本与 metadata | PASS |
| Transport/Semantic 分离；有限 retry；Source 保持 | PASS |
| Prompt injection / Evidence / Duplicate / Over-fragmentation / Event 回归测试 | PASS（工程测试） |
| Golden Before/After | **FAIL：After NOT RUN** |
| Holdout Before/After | **FAIL：After NOT RUN** |
| E1 regression 与工程门槛 | PASS |
| Production 未部署；E3/E4 未提前实施 | PASS |

结论：**E2 BLOCKED**。不能宣布 E2 Complete。

## 23. E3 Readiness

**NOT READY**。

架构与工程回归已具备进入最终质量验证的条件，但在 Golden After、Holdout After、Repair/Latency/Token 实测和 A–J 真实优化模型浏览器验收完成前，不得进入 E3。
