# Student Affairs Product v2.0 — E2 Final Report

更新时间：2026-08-09（Asia/Shanghai）

## 1. 结论

E2 的工程链路已经完成并通过回归，但独立 Holdout 质量门槛未通过，因此当前结论仍为 **E2 BLOCKED / E3 NOT READY**。

- 冻结 Golden 110 条使用真实 `deepseek-v4-flash`、Prompt `recognition-2.3.0`、Pipeline `recognition-pipeline-2.1.2` 全量运行，全部核心质量门槛通过。
- 冻结 Holdout 40 条只运行一次，没有根据结果修改 expected、Prompt 或规则；任务、事件、需大改、严重错误和请求失败门槛未通过。
- Preview 已发布精确待验代码；Production `https://student-affairs.site/` 未被本轮覆盖，避免把未通过泛化门槛的版本上线。
- A–J 浏览器矩阵只完成首页与服务状态检查；实际整理交互连续触发浏览器控制超时，不能宣称完整浏览器验收通过。

## 2. 运行身份

| 项目 | 值 |
| --- | --- |
| Provider | `deepseek-production` |
| Model | `deepseek-v4-flash` |
| Schema | `RecognitionResult 2.0` |
| Prompt | `recognition-2.3.0` |
| Pipeline | `recognition-pipeline-2.1.2` |
| Gateway | `model-gateway-1.0.0` |
| Retry | `recognition-retry-1.0.0` |
| Transport | `python-session`（持久 HTTPS 会话，评估器无隐藏重试） |
| Preview | `https://student-affairs-manager-preview.nightsdell.workers.dev/` |

Preview 状态接口已确认 `configured: true`。Secret 只存在于 Cloudflare 服务端 Secret，不进入前端、报告、缓存或 Git。

## 3. Before / After

| Dataset | Project | Task P / R | Material R | Time | Event | Evidence | Major | Severe | Invalid | Request |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Golden Before / DeepSeek 2.0 | 84.55% | 81.90% / 74.80% | 30.69% | 6.38% | 86.96% | 95.33% | 87.27% | 5.45% | 0.00% | 1.82% |
| Golden After / DeepSeek 2.3 | **97.27%** | **86.61% / 86.61%** | **98.02%** | **91.67%** | **91.30%** | **98.05%** | **30.91%** | **0.00%** | **0.00%** | **0.00%** |
| Holdout Before / DeepSeek 2.0 | 80.00% | 68.57% / 45.28% | 32.08% | 3.33% | 66.67% | 83.61% | 90.00% | 10.00% | 0.00% | 5.00% |
| Holdout After / DeepSeek 2.3 | **95.00%** | **70.69% / 77.36%** | **100.00%** | **78.69%** | **82.35%** | **95.63%** | **60.00%** | **2.50%** | **0.00%** | **2.50%** |

门槛：Project ≥88%；Task P/R ≥85%/82%；Material R ≥75%；Time ≥75%；Event ≥86.96%；Evidence ≥95.33%；Duplicate ≤3%；Over-fragmentation ≤5%；Major ≤35%；Severe ≤2%；Invalid/Request 各 ≤1%。

Golden 全部通过。Holdout 失败项为 Task P、Task R、Event、Major、Severe 和 Request；其余列出的门槛通过。Duplicate 与 Over-fragmentation 在两组 After 均为 0。

## 4. 可观测性

### Golden After

- 样例：110/110 完成；请求失败 0。
- 延迟 mean / p50 / p95：8,153 / 6,017 / 20,983 ms。
- Token：input 268,472；output 158,683。
- Cost：`NOT OBSERVABLE`，上游没有返回可审计费用，未作价格估算。
- Repair：触发 15.45%，成功 29.41%；repair p95 12,330 ms。

### Holdout After

- 样例：39/40 完成；1 次真实传输失败，未由评估器补跑或覆盖。
- 延迟 mean / p50 / p95：9,262 / 7,013 / 22,876 ms。
- Token / Cost：`NOT OBSERVABLE`，一次失败导致运行级 usage 不完整。
- Repair：触发 23.08%，成功 66.67%；repair p95 14,342 ms。

## 5. 错误分类

Golden After 的主要差异为 `milestone_missing` 57、`ambiguity_spurious` 29、`task_missing` 17、`task_spurious` 15、`ambiguity_missing` 11、`time_incorrect` 8。Golden 的 Milestone Recall 仍只有 21.92%，它未纳入当前硬门槛，但属于显著剩余风险。

Holdout After 的主要差异为 `milestone_missing` 15、`task_missing` 12、`task_spurious` 11、`ambiguity_missing` 8、`evidence_missing` 8、`time_missing` 8、`time_incorrect` 4、`time_spurious` 4、`event_missing` 3、`request_failure` 1。逐样例匿名分类与原因保存在对应 failures JSON；模型原始正文只在 Git 忽略的本地 checkpoint 中，不提交。

## 6. 质量工程实现

- 输出合同保持 Source、Project、Milestone、Task/Subtask、Material、TimePoint、Event、Evidence、Conflict、Ambiguity 的丰富结构。
- Worker 对近似 Schema 输出做有界归一化，不把用户确认前建议直接写入 Domain。
- 只接受带逐字来源证据的建议；来源中的提示注入视为数据，不得变成执行指令。
- 材料型约束、纯格式动作、纯信息、与 Event 重复的参加类动作、无原文动作依据的“查看结果/等待通知”等被确定性过滤。
- 报名截止与“报名表材料截止”分开判定；未知时间不使用 `1970-01-01` 等哨兵值。
- Repair 最多一次，不得新增无证据事实；复杂两阶段调用继续关闭，因为 Holdout 未证明净收益。
- Workspace v8、Migration、Repository、DomainCommitPlan、Source-before-AI 与原子提交未改契约。

## 7. 浏览器验收

已在 Preview 实际确认：

- 首页成功加载，无白屏。
- 页面显示 `DeepSeek V4 Flash 已连接`。
- 首页最多突出三项任务；截止日期、具体时间、风险、下一步和“标记完成”均可见。
- 待确认入口显示持久化说明。

未完成：A–J 的逐例 UI 提交、Draft → Confirm → atomic commit → reload 全链路。浏览器控制在填写/提交匿名课程样例时连续超时并重置会话，因此状态为 **PARTIAL / TOOL BLOCKED**，不是 PASS。

## 8. 工程与安全回归

在 2026-08-09 真实执行：

- `npm run lint`：PASS。
- `npm run typecheck`：PASS。
- `TZ=UTC npm test`：PASS，45 files / 178 Vitest tests；Dataset Freeze 4、Server 8、Worker 25、Functions 5 均 PASS。
- `TZ=Asia/Shanghai npm test`：同上 PASS。
- `npm run build`：PASS。
- `npm run server:check`：PASS。
- `npm run security:scan`：PASS，251 个源码/构建文件未发现 Secret。
- `npm audit --audit-level=high`：PASS，0 vulnerabilities。
- `npm run cloudflare:check`：PASS，Worker 25 tests、Production/Preview dry-run 均通过。

## 9. 证据文件

- `docs/baselines/e2-i/golden-after-2-3-golden-pass-deepseek-production-baseline.md`
- `docs/baselines/e2-i/golden-after-2-3-golden-pass-deepseek-production-summary.json`
- `docs/baselines/e2-i/golden-after-2-3-golden-pass-deepseek-production-failures.json`
- `docs/baselines/e2-i/holdout-after-2-3-holdout-deepseek-production-baseline.md`
- `docs/baselines/e2-i/holdout-after-2-3-holdout-deepseek-production-summary.json`
- `docs/baselines/e2-i/holdout-after-2-3-holdout-deepseek-production-failures.json`

其他本轮探索性或传输失败运行不作为最终门槛证据，也不应提交。

## 10. 发布决定与下一步

本轮 **不执行 Production deploy**。原因不是构建或 Cloudflare 配置失败，而是独立 Holdout 暴露出明显泛化退化，并且 A–J 浏览器验收不完整。生产站点继续保留先前稳定版本。

后续必须创建新的开发集处理任务别名/层级、复杂申请与奖学金场景、事件遗漏和模糊时间；不得反向修改已见 Holdout 的 expected，也不得用重复运行挑选一次“好看”结果。完成新训练迭代后，应使用新的、未见过的独立盲测集和稳定浏览器环境重新验收。达到全部门槛后才能部署 Production，并在部署后检查状态接口、真实提取、静态资源、SPA 路由和控制台。

## 11. Definition of Done

| 项目 | 状态 |
| --- | --- |
| Golden/Holdout 冻结与 corrections log | PASS |
| Prompt/Schema/Model/Pipeline 身份可审计 | PASS |
| Validator、Repair、Router、Gateway、有限 Retry | PASS |
| Source-before-AI 与 Workspace v8 不回退 | PASS |
| Golden After 全门槛 | PASS |
| Holdout After 全门槛 | **FAIL** |
| A–J 浏览器回归 | **PARTIAL / TOOL BLOCKED** |
| 工程、安全与双时区回归 | PASS |
| Production deploy | **NOT RUN（质量保护）** |

最终结论：**E2 BLOCKED；E3 NOT READY；Production 保持不变。**
