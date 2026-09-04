# RCO Current Context

本文件供上下文压缩、任务恢复和移交使用；只保留当前事实，历史细节见追加日志。

## Objective

提高文字、图片与文件到“待确认任务”的端到端正确率和用户确认效率。AI 永远只给建议，不能直接创建正式任务。

## Current Authority

- current_status: `RCO-5-007-P1 CLOSED / TECHNICAL_PASS_SEEN_B2 / NEW_B3 ZERO-CALL GATE REQUIRED / PAID MODEL BLOCKED / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- authorization_completed: 隔离修复 `requiresAction` 与 `selected` 解耦、对象感知复合动作边界、条件触发状态、对象保真和受控效果/风险分类；完成已见 B2 零调用回归、对抗审计与组件冻结。
- model/network/repair/retry/secret: `0 / 0 / 0 / 0 / NONE`
- protected: 既有 Expected、freeze、dataset、checkpoint、cache；稳定路径、RC.4、Release、Production 均未修改。
- not_authorized: 修改 B2 Expected/freeze/dataset 或既有 checkpoint/cache；继续修改 P1；创建 B3；模型/Secret；真实材料、真人研究、浏览器验收、RCO-6、稳定路径接入、Preview/Production 部署。
- authority_rule: 新阶段、付费调用、真实数据、浏览器验收和部署分别需要当前用户明确授权；旧授权不自动续用。

## Workspace

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- branch: `codex/e2-multimodal-recognition-exp`
- last_implementation_commit: `501eb46`，已推送；恢复时重新核对 HEAD/upstream/worktree。
- production/default path: 不变；仍为本机解析/OCR → 用户核对文字 → 只发送文字。
- multimodal: 仍是独立实验 Preview；RCO-6 未启动。

## Current Evidence

### B1 原始付费实验（RCO-5-006-B1-M1）

- 模型 `deepseek-v4-flash-vision-exp`，temperature 0；实际确认 22 次调用（12 candidate + 10 verifier），2 个 verifier 因 candidate 不合格跳过，Repair/retry 0。
- candidate 严格契约 10/12，verifier 9/10；Scope F1 63.4%，requiresAction 83.3%，semantic bundle 8.8%，Complete Case 0%，Safe Default Recall 70%，Forbidden 0。
- 结论 `INVALID_RUN / NO_PROMOTION / DO_NOT_LAUNCH`。B1 为匿名合成、单一 Codex 作者 Development，不是独立人工 GT 或真实材料。

### RCO-5-007 本机职责拆分

- 模型输入缩减层仅保留 scope、动作/对象表面词和候选引用；主动丢弃模型 requiresAction、semantics、inferenceLevel、effect、revisionRefs、selected。
- 本机确定复合动作边界、否定/条件/修订状态、命令时态、说明归属、requiresAction 和 selected。
- 默认白名单仅含核对/检查、填写/重写、整理/准备、携带、保存、打印；签名、参加、外发、联系、报名、付款、否定、条件、历史和不确定项不默认。
- 定向契约/变形/对抗测试 12/12，运行完整性测试 4/4。
- B1 只读回放：12/12 新契约有效；任务 P/R/F1 100%/100%/100%，动作+对象 100%，requiresAction 100%，任务边界整例 100%，语义字段 98.1%，Complete Task Case 83.3%，Safe Default Recall 100%，Forbidden Default 0。
- 三个语义组合差异被保留：B1-01 的“暂勿”从旧 pending 统一为 cancelled；B1-04 两个否定命令从旧 present 统一为 future。Expected 未改。
- 上述 100% 是针对已见 B1 故障的诊断回放，不是泛化正确率；不能与旧 fail-closed 图指标直接相减宣称提升。

### B2 新挑战集与理想锚点上限测试

- 新冻结 16 个匿名合成 Development 挑战案例：27 个指令命题、9 个观察命题、2 个 `requiresAction=false`、13 个安全默认、14 个不得默认指令；与 B0/B02/B1 的来源和语义家族不重复，逐例字符 bigram Jaccard <0.55。
- Expected 被故意转换成“模型已经完美找到动作与 scope”的锚点，只运行本机任务形成/安全层；这不是模型正确率。运行后 B2 对当前及后续修补已是已见 Development。
- 16/16 可评分；Task P/R/F1 `96.2%/92.6%/94.3%`，`requiresAction` `56.3%`，语义字段 `94.3%`，任务边界 `87.5%`，Complete Task Case `37.5%`，Major Correction `62.5%`，Safe Default Recall `76.9%`，Forbidden Default `0`。
- 决定性失败：`requiresAction` 被错误地从 `selected` 反推。外发、上传、联系等任务因为安全原因不默认勾选，却被错误说成“无需行动”。另有不同对象复合动作误合并、已触发条件未激活、对象表面词被过度清洗、否定/可选/例外组不足和安全动作分类依赖有限动词表。
- gate: `PAID_MODEL_TEST_BLOCKED_LOCAL_POLICY_CEILING`。即使模型锚点完美，本机层也过不了门，所以当前不得付费测模型。

### RCO-5-007-P1 已见故障修补

- 新增隔离 `task-formation-policy-2.1.0-p1`，未修改或接入冻结的 v2 策略和稳定路径。
- 四层职责为：当前义务 → 对象感知任务边界 → 效果/风险 → 默认选择；`requiresAction` 不再读取 `selected`。
- 首轮对抗测试发现“同时篡改语义与 requiresAction 可互相证明”，已改为从原文 scope 重新计算；首轮 B2 回放 15/16，发现“联系电话”被关键词误判为外部联系，已改为有边界的动作/对象末尾分类。
- 最终定向/对抗 16/16；B2 16/16 合同有效。旧策略指标原样复现；P1 Task P/R/F1、requiresAction、语义、任务边界、Complete Task Case、Safe Default 均 100%，Major Correction 0，Forbidden 0。
- 这是 `SEEN_B2_DEVELOPMENT_DIAGNOSTIC_REPLAY`，不是模型正确率或未见泛化。P1 实验 runner 无模型调用、网络请求、Repair/retry 或 Secret；常规 Git 推送不计入实验调用。

### 完整性与工程门

- B2 原冻结的 12 个组件仍逐项 SHA-256 匹配；P1 组件冻结另绑定 16 个计划、代码、测试、runner、结果和依赖路径。
- 定向 PASS：P1 策略/对抗 16/16、P1/B2 完整性 4/4、typecheck。
- 全量 PASS：lint；Vitest 551 passed / 1 live OCR skipped；server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build；security scan 435 files。
- `npm audit --audit-level=high` 连续两次在官方 advisory endpoint 网络超时，记录为 `NOT_COMPLETED_EXTERNAL_NETWORK`；不得写成 0 vulnerabilities，也没有证据表明发现漏洞。
- 未部署；保留既有 >500 kB chunk warning。

## Evidence Files

- policy/plan: `docs/recognition-optimization/RCO-5-007_PLAN.md`
- semantic policy: `docs/recognition-optimization/RCO-5-007_SEMANTIC_POLICY_V2.md`
- component freeze: `docs/recognition-optimization/RCO-5-007_COMPONENT_FREEZE.json`
- result/report: `docs/recognition-optimization/rco-5-007-replay/result.json` and `REPORT.md`
- adversarial audit: `docs/recognition-optimization/rco-5-007-replay/ADVERSARIAL_AUDIT.md`
- B2 dataset/freeze: `docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json` and `RCO-5-007-B2_FREEZE.json`
- B2 result/report/audit: `docs/recognition-optimization/rco-5-007-b2-oracle/`
- P1 plan/freeze: `docs/recognition-optimization/RCO-5-007-P1_PLAN.md` and `RCO-5-007-P1_COMPONENT_FREEZE.json`
- P1 result/report/audit: `docs/recognition-optimization/rco-5-007-p1-b2-replay/`
- append-only history: `docs/recognition-optimization/OPTIMIZATION_LOG.md`

## First-Principles Interpretation

P1 已让完美输入在已见 B2 上稳定形成正确任务，同时保持外部动作不默认。下一问题不再是继续追 B2，而是检验四层机制能否应对未用于设计它的新表达。必须先用全新 B3 做零调用理想锚点门，避免把已见 100% 当成泛化。

## Current Gate / Next Action

- gate: `ELIGIBLE_FOR_NEW_B3_DATA_AND_ZERO_CALL_ORACLE_GATE_ONLY / PAID MODEL BLOCKED`
- next: 等待用户另行授权创建并冻结全新 B3 匿名挑战集，再用冻结 P1 跑 0 次模型调用理想锚点门；不得用 B2 证明泛化。
- after_b3: B3 通过后，才能另行批准同模型、固定调用数与人民币上限的付费配对测试。
- promotion rule: 付费新数据仍稳定提升且 Forbidden=0，才可申请 RCO-6；之后仍需真实去标识材料、真人修改时间、Chrome/Edge/手机、隐私安全和 Commercial Preview，才能讨论上线。

## Recovery

1. 读根 `AGENTS.md`、`PRD.md`、本文件和日志最后两节。
2. 重新核对 branch、HEAD、upstream、worktree；任何差异先当用户资产。
3. 只读取当前任务必要文件；大结果用路径、哈希、计数和结论，不灌入上下文。
4. P1 授权已关闭；未有新授权时不得创建 B3、修改 P1、调用模型、启动 RCO-6 或部署。
