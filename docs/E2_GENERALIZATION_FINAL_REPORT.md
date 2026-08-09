# E2 GENERALIZATION FINAL REPORT

报告日期：2026-08-09

分支：`codex/e2-generalization-v2`

基线：`b7f6be8a12c0d8cf24cca32005250d43468367cb`
最终结论：**E2 BLOCKED / E3 NOT READY / PRODUCTION NOT READY**

## 1. Executive Summary

本轮完成 G0–G8 的审计、开发集、泛化架构改造和真实 Preview 回归，并完成 G11 工程回归。候选 `recognition-2.4.1` 在 108 条 Development Set 上的 Task Precision/Recall 为 **82.17%/75.71%**，Major Correction 为 **67.59%**；没有达到 85%/85% 与 Major Correction ≤30% 的开发门槛。候选因此没有冻结，新的 Blind Dataset 没有创建或打开，Browser A–J 也没有运行。工程门槛全绿不改变识别质量结论。生产域名 `student-affairs.site` 未部署、未修改。

## 2. Starting Baseline

冻结起点为 `b7f6be8`，模型 `deepseek-v4-flash`，Prompt `recognition-2.3.0`，Pipeline `recognition-pipeline-2.1.2`。第一轮 Golden 110 条：Task P/R **86.61%/86.61%**、TimePoint **91.67%**、Event **91.30%**、Evidence **98.05%**、Major **30.91%**、Severe **0%**。第一轮已暴露 Holdout 40 条：Task P/R **70.69%/77.36%**、TimePoint **78.69%**、Event **82.35%**、Evidence **95.63%**、Major **60%**、Severe **2.5%**、Transport Failure **2.5%**。

## 3. Generalization Failure Audit

质量下降集中在 Task、TimePoint、Event 和最终可用性，而不是所有实体同步下降。旧 Holdout 的 Material P/R 为 98.15%/100%，说明材料事实通常已被看到，但材料与动作、时间、事件的规划边界不稳定。风险代理显示旧 Holdout 24/40（60%）存在 under-routing，实际 Simple 路由的 Task P/R 仅 57.14%/64.00%，Event Accuracy 57.14%。完整证据见 `docs/E2_GENERALIZATION_AUDIT.md`。

## 4. Root Causes

1. Router 过度依赖文本长度和固定词表，低估陌生结构。
2. 事实发现与层级规划在同一生成任务中竞争，造成“看见对象但组织错动作”。
3. Task 规则依赖显式动作词，被动义务、窗口关闭、条件谓词容易漏识别。
4. 日期发现、业务角色、归一化和歧义处理耦合，陌生时间表达易遗漏或错型。
5. Validator 与 Repair 原先缺少可观测 before/after 质量闭环。
6. Event 与 Task 边界在 Simple 路由不稳定。

**AUDIT ASSUMPTION INVALIDATED：**“Material Recall 是主要泛化缺口”不符合真实数据；主要缺口是任务边界与实体关系规划。Complex 两阶段是否优于单次仍为 **NOT RUN / NOT OBSERVABLE**，没有证据支持启用。

## 5. New Development Dataset

建立并冻结 `e2-generalization-development-1.0.0`：108 条、27 个语义家族、每家族 4 个结构变体（direct/reordered/formal/conversational）。类别包括 course 16、application 12、event 12、material 12、multi_deadline 12、competition 8、information_only 8、vague_time 8、complex_notice 4、meeting 4、scholarship 4、ocr_noise 4、security 4。覆盖短/长通知、群聊、公文、表格、OCR 噪声、语序变化、材料先行、时间先行、无典型动作词、多个事件/截止、模糊/相对/冲突时间、条件/可选事项、纯信息和 Prompt Injection。Golden/Holdout/Development expected 均未为提分而修改，corrections log 为空。

## 6. Architecture Changes

在不改变 RecognitionResult 2.0 和 Domain v8 的前提下，将单次调用内部顺序明确为“事实角色发现 → 完整性检查 → 最小结构规划”；增强 Semantic Validator；将 Repair 限制为 issue-scoped patch、最多一次；Router 综合时间、动作、材料、事件、列表/表格、附件、条件、歧义和跨段线索。ModelGateway、checkpoint、per-sample transport catch、分路由 Token/Latency 和 Repair before/after 评分均已接入。Simple/Medium 仍为单次识别，Complex 两阶段默认关闭。

## 7. Prompt Changes

Prompt 从 `recognition-2.3.0` 演进到 `2.4.0`，再依据 Development 的语义型失败收敛为 `2.4.1`。变化使用语义原则而非 sampleId、固定句子或 exact-match patch：一个动作可关联多个材料；材料清单不自动生成多个准备任务；条件句选择实际支配谓词；未知业务角色时间保持 ambiguity；更正通知保留旧/新时间证据；日期作用域可跨列表继承；只有真实阶段才建立 Milestone。

## 8. TimePoint

候选 `2.4.1`：Development TimePoint P/R **92.11%/94.59%**，Type Accuracy **78.85%**、Value Accuracy **74.36%**、综合 Accuracy **75.00%**；Golden **91.67%**；Exposed Holdout **76.67%**。Development 未达 80% 门槛，主要错误为 `time_incorrect=23`。说明发现率较高，但业务角色与规范值仍不稳定。

## 9. Material

Development Material P/R **97.87%/93.24%**，Golden **95.24%/99.01%**，Exposed Holdout **98.08%/96.23%**，均满足召回底线且 Precision 未被牺牲。当前风险不是材料是否出现，而是材料与单一/多个动作、用途和截止点的关联。

## 10. Task

Development Before（旧 2.3.0）P/R **70.63%/80.71%**；初版 2.4.0 为 **61.24%/77.86%**；语义边界修复后的 2.4.1 为 **82.17%/75.71%**。2.4.1 消除了强拆多材料导致的过度碎片，但召回下降且仍远低于 85%/85% Gate。主要错误为 `task_missing=34`、`task_spurious=22`。这也是候选不能冻结的首要原因。

## 11. Milestone

Development Milestone P/R **32.94%/58.33%**，Golden **33.87%/28.77%**，Exposed Holdout **55.17%/55.17%**。`milestone_missing` 分别为 Development 20、Golden 52、Holdout 13。规则避免了简单通知机械建阶段，但 Recall 与一致性仍不足；不能以 Holdout 单组较高值掩盖 Golden 回归。

## 12. Event

Development Event Accuracy **93.94%**，Golden **91.30%**，Exposed Holdout **82.35%**。Development 达到 88% 门槛，但陌生 Holdout 没有超过原 82.35%，仍显示活动本身与准备任务、纯信息时段的边界不稳定。

## 13. Ambiguity

Development Ambiguity P/R **60.78%/51.67%**；Golden **60.00%/88.89%**；Exposed Holdout **69.57%/66.67%**。错误同时包含漏报和误报，说明“无法可靠确定时不猜测”的原则已保留，但不同表述下的触发一致性仍需新的开发周期验证。

## 14. Validator

旧工件的粗粒度代理 Issue Precision/Recall：Golden **5.00%/1.64%**，Exposed Holdout **0%/0%**；该代理不是独立 Validator 金标准。新 Validator 具有 7 项纯函数测试并按 evidence/structure/facts 检测，不自行发明业务事实，但本轮没有独立 issue-labelled 数据集，因此正式 warning precision/recall 为 **NOT OBSERVABLE**。不能用“触发 Repair”冒充 Validator 正确。

## 15. Repair

2.4.1 Development：Trigger **9.26%**、Applied **100%**、Semantic Success **10.00%**、Harm **0%**、Repair latency mean/P95 **2813/3504ms**。Golden：Trigger **6.42%**、Applied **71.43%**、Success **14.29%**、Harm **0%**。Exposed Holdout：Trigger **30.00%**、Applied **75.00%**、Success **0%**、Harm **0%**、Repair latency mean/P95 **2224/2894ms**。Patch 未造成已观测伤害，但成功率太低，不能靠提高触发率解决识别缺陷。

## 16. Router

Development 路由分布：Simple 69、Medium 37、Complex 2；各自 latency mean/P95 为 6847/8885ms、8693/13058ms、17173/17291ms。Exposed Holdout：Simple 18、Medium 18、Complex 4；latency mean/P95 为 6094/7971ms、7983/12654ms、14463/15705ms。结构特征使 Complex 不再只由长度决定，但没有人工 Router 标签，正式 Router Accuracy 仍 **NOT OBSERVABLE**。Complex 两阶段未启用，因为没有同候选 A/B 净收益证据。

## 17. Golden Regression

| 指标 | 第一轮 | 2.4.1 | 判定 |
| --- | ---: | ---: | --- |
| Task Precision | 86.61% | 89.08% | +2.47 pp |
| Task Recall | 86.61% | 83.46% | **-3.15 pp** |
| TimePoint | 91.67% | 91.67% | 持平 |
| Event | 91.30% | 91.30% | 持平 |
| Evidence | 98.05% | 98.44% | +0.39 pp |
| Major | 30.91% | 27.27% | 改善 |
| Severe | 0% | **1.82%** | 回归 |
| Request Failure | 0% | **0.91%** | 回归 |

110 条中完成 109 条。Precision 提升，但 Recall、Severe 和 Transport 回归，不能判定为“全部稳定”。

## 18. Exposed Holdout Regression

| 指标 | 第一轮 | 2.4.1 | 判定 |
| --- | ---: | ---: | --- |
| Task Precision | 70.69% | 77.27% | +6.58 pp |
| Task Recall | 77.36% | 64.15% | **-13.21 pp** |
| TimePoint | 78.69% | 76.67% | -2.02 pp |
| Event | 82.35% | 82.35% | 持平 |
| Evidence | 95.63% | 96.72% | +1.09 pp |
| Major | 60.00% | **67.50%** | 回归 |
| Severe | 2.50% | 0% | 改善 |
| Request Failure | 2.50% | 0% | 改善 |

Precision、Severe 和传输可靠性改善，但 Recall 与 Major 显著恶化，不满足“明显整体改善”。

## 19. New Blind Evaluation

**NOT RUN。** G8 Development Gate 已失败，G9 Candidate Freeze 不成立。根据冻结协议，此时创建或读取 Blind expected 会污染唯一的最终验证机会，因此 G10/G11 的正式 Blind 被硬性阻断，而不是漏做。

## 20. Per-category Blind Results

**NOT RUN / NOT AVAILABLE。** 没有候选冻结，也没有合法 Blind run，不能伪造类别指标。

## 21. Remaining Failure Cases

Development 主要 taxonomy：`task_missing=34`、`ambiguity_missing=29`、`time_incorrect=23`、`task_spurious=22`、`milestone_missing=20`。Golden：`milestone_missing=52`、`task_missing=21`、`ambiguity_spurious=15`、`task_spurious=12`。Exposed Holdout：`task_missing=19`、`milestone_missing=13`、`task_spurious=10`、`time_missing=9`、`ambiguity_missing=8`。逐例证据已保存在相应 `*-failures.json`，但不得再把这些集合称为 Blind。

## 22. Severe Errors

Development 0/108；Exposed Holdout 0/40；Golden 2/110（1.82%）且伴随 1 次 request failure。严重错误逐例详情在 Golden failures 工件中；本轮不根据已暴露失败继续调候选。Blind Severe Error 为 **NOT RUN**。

## 23. Latency

Development 2.4.1：mean/P50/P95 **7671/7351/11788ms**。Golden：**6455/5767/11633ms**。Exposed Holdout：**7781/7321/14225ms**。Complex 路由明显慢于 Simple；Repair 增加约 2.2–2.8 秒均值。没有启用双调用 Complex，因此这些是 single-pass + conditional repair 的真实 Preview 延迟。

## 24. Tokens

Development：input/output **291,508/157,438**（recognize 255,843/152,861；repair 35,665/4,577）。Exposed Holdout：**137,202/58,426**（recognize 94,318/54,753；repair 42,884/3,673）。Golden 因 1 个失败样例总量不完整，已观测 recognize **256,469/128,834**、repair **23,213/2,120**，总量标为 **NOT OBSERVABLE**。没有采用可靠官方价格快照，Cost 为 **NOT OBSERVABLE**，未进行估算。

## 25. Transport Reliability

Harness 已支持 per-sample catch、`TRANSPORT_FAILURE` 记录、逐例 checkpoint 和 `--resume=true`，单个 Node fetch throw 不再终止整轮。Development 与 Exposed Holdout request failure 均 0%；Golden 1/110（0.91%）。评测代理逻辑仅存在于 harness，未混入产品 Runtime。

## 26. Browser A–J

**NOT RUN。** A–J 浏览器链路的前置条件是 Blind 达标；本轮候选未冻结，因此没有用浏览器验收为失败候选制造“可上线”印象。Preview 仅用于真实模型评测和状态检查，生产未触碰。

## 27. Full Test Results

- `npm ci`：PASS，242 packages audited，0 vulnerabilities。
- `npm run lint`：PASS。
- `npm run typecheck`：PASS。
- `TZ=UTC npm run test`：PASS，Vitest 46 files / 188 tests；dataset freeze 6；server 8；Worker 25；Functions 5。
- `TZ=Asia/Shanghai npm run test`：PASS，同一数量全部通过。
- `npm run build`：PASS，Vite production build 1679 modules。
- Server/Worker/Functions 已由两次 `npm run test` 完整执行。

## 28. Security Regression

`npm run security:scan` PASS（275 个源码/构建文件，无 Secret）；`npm audit --audit-level=high` PASS（0 vulnerabilities）；`npm run cloudflare:check` PASS。Prompt Injection、Origin、method/content type/body schema、SSRF 私网与重定向复验、server-selected model、超时与无效模型响应均由 Worker tests 覆盖。Wrangler production/preview 均只执行 dry-run，没有发布。

## 29. E1 Regression

没有修改 `src/domain/v2/`、Workspace v8、Repository、Migration、DomainCommitPlan、Atomic Commit 或 Source-before-AI。两时区全量测试覆盖 runtime migration、repository、serialization round-trip、domain commit、capture 和 validators，均通过。`src/App.tsx` 唯一改动是从硬编码版本串改为引用 Validator/Repair/Router 版本常量，不改变业务编排。

## 30. Git State

分支 `codex/e2-generalization-v2`，远程 `origin/codex/e2-generalization-v2`。G0–G8 已拆分为 Conventional Commits 并逐阶段推送；回归证据提交为 `93c97b7`。用户未跟踪目录 `output/` 全程保留且未暂存。没有 force push、reset、clean 或生产部署。

## 31. Files Changed

- `src/recognition/*`：facts-first Prompt、Router、Validator、Repair、ModelGateway 与测试。
- `cloudflare/*`：与 TypeScript 同步的生产服务端模块、Worker 归一化和安全测试。
- `scripts/run-recognition-e2.mjs`、`src/recognition/e2/*`：checkpoint、transport、Token/Latency、Repair harm、Development dataset 与 Gate。
- `docs/E2_*.md`：审计、数据集、设计、可观测性和最终报告。
- `docs/baselines/e2-generalization/*`：Development、Golden、Exposed Holdout 的真实 Preview 结果和逐例失败。
- `src/App.tsx`：仅接入真实组件版本常量。

未修改 Domain v8、Repository、Migration、UI 视觉或导航。

## 32. Remaining Risks

1. Task Recall 与 Major Correction 仍是主阻碍。
2. TimePoint 业务角色/规范值低于开发门槛。
3. Milestone 在 Golden 上召回明显不足。
4. Validator 缺少独立 issue-labelled precision/recall 基准。
5. Repair Harm 为 0，但 Success 太低。
6. Router 没有人工 complexity labels，Accuracy 不可观测。
7. Golden 有一次 transport failure 和两例 severe error。
8. 没有合法 Blind 结论，无法证明陌生分布泛化。

下一轮若继续，必须把本轮所有集合视为已暴露开发/回归集，先提出新的原理性方案并重新过 Development/Golden/Exposed Gate；只有候选稳定后才可建立一个全新的 Blind。不得把未运行的 Blind 补写为通过。

## 33. E2 Definition of Done

| 条件 | 结果 |
| --- | --- |
| Development Gate | FAIL |
| Golden 稳定 | FAIL（Recall/Severe/Transport 回归） |
| Exposed Holdout 合理改善 | FAIL（Recall/Major 回归） |
| Candidate Freeze | NOT PERFORMED |
| New Blind Gate | NOT RUN |
| Browser A–J | NOT RUN |
| 工程/安全/双时区 | PASS |

最终状态：**E2 BLOCKED**。

## 34. E3 Readiness

**E3 NOT READY。** 没有通过 Development、Golden、Exposed Holdout 三重稳定门槛，也没有合法 Blind 与浏览器 A–J 证据。不得进入 Project Matching、Project Memory 或其他 E3 范围。

## 35. Production Readiness

**PRODUCTION NOT READY。** Preview 候选只用于评测，未发布到 `student-affairs.site`。本轮即使工程全绿，也不具备 `PRODUCTION CANDIDATE READY` 条件；必须在未来新候选通过全新 Blind、浏览器链路与单独人工上线批准后才可考虑生产发布。

---

本报告完成后严格 **STOP**：不进入 E3/E4，不继续根据已暴露失败调 Prompt，不创建或读取本轮未获资格的 Blind，不部署 Production。
