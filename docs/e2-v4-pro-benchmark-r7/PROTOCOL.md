# E2.9-R7 Planner Repair Screening Protocol 3.6.2

## 目的

只验证三个可泛化修复是否消除 R6 暴露出的规划退化：动作谓词保持、强制事件对应用户行动、已有 Task/Material/TimePoint 引用闭合。不得据此直接进入 Selection、Blind 或 Production。

## 隔离边界

- 使用独立 Preview Worker 入口 `cloudflare/e2-r7-preview-worker.mjs`。
- Production Prompt、Schema、Scorer 语义、Expected、Workspace v8、Repository、Migration 和 DomainCommitPlan 均不修改。
- 两个模型使用相同 R7 Prompt、Schema、参数、输入和后处理；唯一变量为服务端选择的模型 ID。
- Generation 请求不读取 Expected；只有 16 个配对 observation 全部完成后，Scorer 才可读取冻结 Expected。
- 每个 observation 只允许一次上游请求；失败立即停止，禁止选择性补跑或覆盖。
- 原始输出只写入 Git ignored `.evaluation-cache/e2-9-r7/protocol-3.6.2/`。

## 冻结版本

- Protocol: `e2-9-v4-pro-protocol-3.6.2`
- Benchmark: `e2-v4-pro-benchmark-2.2.0`
- Prompt: `recognition-2.4.1-r7-preview`
- Pipeline: `recognition-pipeline-2.2.2-r7-preview`
- Planner: `e2-v4-pro-benchmark-planner-1.0.0`
- Normalizer: `e2-v4-pro-benchmark-normalizer-2.2.0`
- Recognition Schema: `2.0`（未修改）
- Validator: `recognition-quality-2.1.0`（原语义未修改，另加实验契约问题列表）

## 最小修复

1. 实验 Prompt 将 Event 与 Task 分为两个维度：日程事实进入 Event，原文明示必须参加、到场、签到、集合、出席或上岗时同时保留对应 Task。
2. 实验 Normalizer 仅在原始模型 Task、原文和逐字 evidence 三者同时支持时，恢复模型声明的外层动作谓词；禁止按 caseId 或固定句子改写。
3. 实验 Normalizer 只在已经输出的实体 ID 之间补齐双向引用，不新建 Task、Material 或 TimePoint。
4. 实验 Validator 对“requiresAction=true 且有 Event 但无 Task”、条件歧义遗漏和关系不对称 fail closed。

## 阶段机

`LOCAL_TESTS → STABLE_PREVIEW_DISABLED_CHECK → VERSION_UPLOAD → VERSIONED_PREVIEW_BINDING(连续3次零模型探针) → READINESS(6) → SCREENING(8×2) → SCORE → PATH_MASKED_REVIEW → SCREENING_GATE → STOP`

任一阶段失败立即停止。协议 3.6.2 的 runner 和 scorer 不实现 Selection；Screening Gate 通过也只输出“可申请授权”，不得自动运行 Selection。

3.6.1 修复 3.6.0 首次真实 Readiness 暴露的 Cloudflare 边缘部署传播竞态：CLI 返回 Version ID 后，必须由 Preview `/contract` 连续三次回报相同 Version ID，才可发起首个模型探针。3.6.0 失败记录不得补跑或迁移。

3.6.2 进一步禁止正式探针访问会随部署切换的稳定 `workers.dev` 地址。实验代码只通过 `wrangler versions upload` 上传，不部署为稳定 Preview 默认版本；所有请求必须使用 Cloudflare 生成的版本化 Preview URL，且 URL 的 8 位版本前缀、`/contract` 回报的完整 Version ID 与 Runner 参数必须同时一致。3.6.0/3.6.1 失败记录均不得补跑或迁移。

## Screening Gate

- 8 个完整配对、四向模型 lineage 一致、每个 observation 一次请求；
- Pro Task Recall 不低于 Flash；Task Precision 下降不超过 5 个百分点；
- Pro Evidence Coverage 不低于 90%；Severe Error 不上升；
- Strict Planning Error 必须下降，人工 Planning Error 不得更差；
- Prompt Injection 两臂通过；
- Pro 至少明显改善 2 对，明显退化不超过 1 对。

通过 Gate 后仍须停止并另行申请 Selection。Blind 与 Production 始终禁止。
