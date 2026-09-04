# RCO Current Context

本文件供上下文压缩、任务恢复和移交使用；只保留当前事实，历史细节见追加日志。

## Objective

提高文字、图片与文件到“待确认任务”的端到端正确率和用户确认效率。AI 永远只给建议，不能直接创建正式任务。

## Current Authority

- current_status: `RCO-5-007-P2 AUTHORIZED / STRUCTURED SEMANTICS AND B4 ZERO-CALL PATH IN_PROGRESS / PAID MODEL BLOCKED / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- current_authorization: 新建隔离 P2，结构化处理完整条件命题、动作保真、显式主体和修订状态；用已见 B3 回归，通过后创建并冻结全新 B4，再只运行一次零调用盲测。
- model/network/repair/retry/secret: `0 / 0 / 0 / 0 / NONE`
- protected: 既有 Expected、freeze、dataset、checkpoint、cache；稳定路径、RC.4、Release、Production 均未修改。
- not_authorized: 修改 P1/B3 或任何既有 Expected/freeze/dataset/checkpoint/cache；模型/Secret/网络；真实材料、真人研究、浏览器验收、RCO-6、稳定路径接入、Preview/Production 部署。
- authority_rule: 新阶段、付费调用、真实数据、浏览器验收和部署分别需要当前用户明确授权；旧授权不自动续用。

## Workspace

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- branch: `codex/e2-multimodal-recognition-exp`
- last_experiment_commit: `d1b581f`，已推送；恢复时重新核对 HEAD/upstream/worktree。
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

### B3 首次未见理想锚点门

- B3 在 commit `e52e76b` 先冻结并推送：16 个全新匿名合成 Development 案例、25 个指令和 6 个观察；source text 和 semantic family 不复用 B0/B02/B1/B2。
- 随后只运行一次冻结 P1。16/16 可评分；Task P/R/F1 `96.0%/96.0%/96.0%`，requiresAction `93.75%`，语义字段 `95.83%`，任务边界 `93.75%`，Complete Task Case `68.75%`，Major Correction `31.25%`，Safe Default Recall `100%`，Forbidden `0`。
- 预登记门槛要求 Task F1 ≥90%、requiresAction ≥95%、Complete ≥80%、Forbidden=0；因此结论为 FAIL。B3 现已见，不得修改 P1 后用本集追分。
- 结构性原因：条件事实仍被“无”字误作否定；受控 actionType 反向改写原文动作；对象里的“成员”污染主体；旧要求修订状态与命令时态/极性没有完全分层。一处群体默认标签存在单作者口径争议，但即使按最有利敏感性处理，Complete 仍只有 75%，requiresAction 仍只有 93.75%，不改变失败。
- 本轮模型/网络/Repair/retry/Secret 为 `0/0/0/0/NONE`；这不是模型正确率、真实材料、真人效率、浏览器或上线证据。

### 完整性与工程门

- B2 原冻结的 12 个组件仍逐项 SHA-256 匹配；P1 组件冻结另绑定 16 个计划、代码、测试、runner、结果和依赖路径。
- 定向 PASS：P1 策略/对抗 16/16、P1/B2 完整性 4/4、typecheck。
- 全量 PASS：lint；Vitest 551 passed / 1 live OCR skipped；server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build；security scan 435 files。
- `npm audit --audit-level=high` 连续两次在官方 advisory endpoint 网络超时，记录为 `NOT_COMPLETED_EXTERNAL_NETWORK`；不得写成 0 vulnerabilities，也没有证据表明发现漏洞。
- 未部署；保留既有 >500 kB chunk warning。
- B3 新增定向完整性检查 `13/13 PASS`；全量 lint PASS，Vitest `558 passed / 1 live OCR skipped`，server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5、build PASS、security scan 451 files PASS。B3 阶段 npm audit 两次仍在官方 endpoint 超时。

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
- B3 data/result freeze: `docs/recognition-optimization/RCO-5-007-B3_DATA_FREEZE.json` and `RCO-5-007-B3_RESULT_FREEZE.json`
- B3 result/report/audit: `docs/recognition-optimization/rco-5-007-b3-oracle/`
- append-only history: `docs/recognition-optimization/OPTIMIZATION_LOG.md`

## First-Principles Interpretation

B3 证明 P1 的安全底线仍在，但商业主线“完整且少改”没有过门。即使上游模型给出完美 scope/action/object，当前本机层仍会在条件、动作保真、主体和修订语义上制造重要修改；此时付费测模型只会把上游误差叠加到已知本机瓶颈上。

## Current Gate / Next Action

- gate: `P2 IMPLEMENTATION AND SEEN-B3 REGRESSION IN_PROGRESS / B4 BLOCKED UNTIL P2 FREEZE / PAID MODEL BLOCKED`
- next: 先完成并冻结 P2 与 B3 满分故障回归；只有该门通过，才创建全新 B4 并执行一次零调用盲测。
- after_b4: 只有 B4 通过后，才能另行批准同模型、固定调用数与人民币上限的付费配对测试。
- promotion rule: 付费新数据仍稳定提升且 Forbidden=0，才可申请 RCO-6；之后仍需真实去标识材料、真人修改时间、Chrome/Edge/手机、隐私安全和 Commercial Preview，才能讨论上线。

## Recovery

1. 读根 `AGENTS.md`、`PRD.md`、本文件和日志最后两节。
2. 重新核对 branch、HEAD、upstream、worktree；任何差异先当用户资产。
3. 只读取当前任务必要文件；大结果用路径、哈希、计数和结论，不灌入上下文。
4. B3 授权已关闭且首次门失败；未有新授权时不得修改 P1/B3、创建 B4、调用模型、启动 RCO-6 或部署。
