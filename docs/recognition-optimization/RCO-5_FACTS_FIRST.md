# RCO-5 Facts-first 技术消融报告

**日期**：2026-09-02

**分支**：`codex/e2-multimodal-recognition-exp`

**阶段授权**：RCO-5；不含 Secret、模型调用、真实材料、真人研究或部署

**结论**：`TECHNICAL_IMPLEMENTATION_COMPLETE / RCO-G5 NOT_RUN_QUALITY / NO_PROMOTION / DO_NOT_LAUNCH`

## 1. 本轮唯一变量

本轮只把候选模型责任从完整 `RecognitionResult 2.0` 收敛为 `facts-1.0` 事实账本。当前稳定 Prompt、模型、Worker 路由、默认文字路径和已发布环境均未修改。

候选账本只允许模型表达：

- `requiresAction` 与来源摘要；
- action + object；
- raw time、material、event、constraint；
- 当前文字/OCR evidence 与数组关联；视觉 observation 可在 ledger 表达，但 RCO-6 provenance 契约未开始前禁止 compose。

稳定 ID、时间归一化、`selected`、任务/材料/时间互引、`RecognitionResult 2.0` 外形和后续 Workspace v8 兼容结构由确定性代码创建或验证。

## 2. 实现

- `src/recognition/facts.ts`
  - `facts-1.0` 严格类型与运行时 validator；
  - 未知字段、缺字段、超限、悬空索引、来源外文字证据、`requiresAction` 矛盾与已注册的敏感对象/注入模式 fail-closed；
  - `explicit` action 必须至少有一条 text/OCR 逐字证据，视觉独有观察不能伪装为明示动作；
  - task composer 确定性创建 ID、引用、时间 AST、默认勾选与完整 `RecognitionResult 2.0`；
  - 新候选 Prompt 版本为 `recognition-facts-first-1.0.0`，仅作为未调用候选，未替换稳定 Prompt。
- `src/recognition/facts.test.ts`
  - 匿名 action/material/time 正例；
  - 纯信息、否定句、更正取消、联系人、地址、政策、格式要求和 prompt injection 八类负例；
  - requiresAction 矛盾、视觉独有 explicit、提示注入动作、来源外 evidence、悬空索引和未知字段对抗测试。

## 3. 0 调用单变量消融

| 项目 | 当前完整 Schema | facts-first 候选 | 本轮能否形成质量结论 |
|---|---|---|---|
| 模型输出责任 | 事实、ID、层级、引用、时间派生、默认值与完整领域结构 | 事实、原始时间、约束、证据与局部数组关联 | 只证明责任边界不同 |
| ID / 引用图 | 模型输出后严格校验 | composer 确定性创建并由共享 Schema 复验 | 技术验证通过 |
| 时间归一化 | 共享 AST 覆盖模型派生值 | composer 直接调用同一共享 AST | 技术验证通过 |
| 负例禁建任务 | 主要依赖 Prompt 与最终 Schema | fact validator 在构造任务前 fail-closed | 8/8 匿名负例的伪任务注入被拒绝，清空后未建任务 |
| 客户端结构有效 | 历史结果需逐例评分 | 1 个固定正例的 composer 输出通过共享 `RecognitionResult 2.0` | 仅组件样本，不能外推 |
| Recall / Precision / Complete Case / Major Correction / Evidence | 需要同输入模型配对 | 需要 B1/B4 模型调用 | `NOT_RUN` |

本轮 14 个 RCO-5 定向 Vitest 均通过。隔离入口执行 unknown input → fact validator → composer → 共享 `RecognitionResult 2.0` 二次校验；task/material/time 的最终 distinct 关联数和完成条件均在 compose 前按共享上限检查。安全反例包含多种允许动词携带敏感对象、无关文字为视觉动作洗白和视觉独有 explicit event。八类负例只证明 `requiresAction=false` 与伪 action 的内部矛盾被拒绝，不证明模型能正确判断 requiresAction；该质量必须由 B1/B4 配对验证。视觉 observation 在 RCO-5 明确 fail-closed，不能声称已端到端支持。这些是合成 Mock/契约测试，不是模型识别正确率；手工构造的事实账本不能作为 ground truth 反过来证明 facts-first 提升 Recall。

完整工程门结果：`recognition:contract:check`、lint、typecheck、build 均 PASS；Vitest 303 passed / 1 个 live OCR 按策略 skipped，加 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5，共 365 个常规测试通过。最终安全扫描 267 files PASS，npm audit 0 vulnerabilities，Cloudflare default/preview/multimodal_preview 三环境 dry-run PASS；没有部署。

## 4. 第一性原理审查

这一改造消除了“模型既读通知、又设计完整数据库结构”的确定性竞争，并把容易机械化的工作交给代码。但商业价值取决于模型在同一输入上是否真的提取出更多正确关键事实，而不是输出字段变少。因此：

- 结构测试通过不等于 RCO-G5 通过；
- 未调用完整 Schema 与 facts-first 两个候选，Recall/Precision 差值不可观测；
- 未运行 B1/B4，不得冻结 facts-first 为 RCO-6 候选；
- RCO-6 虽已由用户列入本次阶段请求，但固定依赖 RCO-G5，通过线未满足时不得越门启动。

## 5. 结论与解除条件

- `RCO-5 TECHNICAL IMPLEMENTATION: PASS`
- `RCO-G5 QUALITY GATE: NOT_RUN`
- `RCO-6: BLOCKED_BY_RCO_G5`
- `cloud model / Repair / Secret / real data / human / deploy: 0 / 0 / NOT_ACCESSED / NOT_USED / NOT_RUN / NOT_RUN`
- `RC.4 / Release / Production / stable model: UNCHANGED`

要解除 `NO_PROMOTION`，需要当前用户另行批准具体模型、匿名 Development 数据、B1/B4 调用次数与金额上限；然后在冻结同输入上比较完整 Schema 与 facts-first，证明 Recall 上升且 Precision、Forbidden、Major Correction、Complete Case、Evidence 和客户端有效率不退化。只有 RCO-G5 通过后才能启动 RCO-6。

## 6. 新鲜对抗审查

独立同模型家族审查在最终候选上复现 14/14 定向测试、目标 lint/typecheck 与关键文件哈希。审查期间发现并修复了资源/关联上限、末端共享 Schema 复验、敏感对象检测、视觉边界和负例解释等问题。

最终结论为 `Overall WARN / CONTRACT_EVIDENCE_REPRODUCED_WITH_AUTHORITY_CHAIN_WARNINGS / provisional`：技术契约证据可复现、范围与失败分类成立、R6 阶段顺序被正确阻断；但候选仍是隔离实现、尚无模型质量配对且审查发生在提交前，因此不能升级为产品集成、质量或发布 PASS。详见 `RCO-5_EXPERIMENT_AUDIT.md` 与对应 JSON/trace 记录。
