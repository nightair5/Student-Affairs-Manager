# RCO Current Context

本文件供上下文压缩、任务恢复和移交使用；只保留当前事实，历史细节见追加日志。

## Objective

提高文字、图片与文件到“待确认任务”的端到端正确率和用户确认效率。AI 永远只给建议，不能直接创建正式任务。

## Current Authority

- current_status: `RCO-5-007-B7 DATA/CONTRACT FROZEN / PROPOSED 12 CALLS AND 10 CNY NOT_YET_AUTHORIZED / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- current_authorization: 仅完成全新 B7 匿名数据、模型锚点选择契约、冻结 P3 理想上限和付费参数预注册；尚未获得“最多 12 次、人民币硬上限 10 元”的明确付费调用授权。
- model/network/repair/retry/secret: `0 / 0 / 0 / 0 / NONE`
- protected: 既有 Expected、freeze、dataset、checkpoint、cache；稳定路径、RC.4、Release、Production 均未修改。
- not_authorized: 修改 P2/P3、B5/B6 或冻结后的 B7 Expected/dataset/freeze、任何既有 checkpoint/cache；当前模型/Secret/实验网络；真实材料、真人研究、浏览器验收、RCO-6、稳定路径接入、Preview/Production 部署。
- authority_rule: 新阶段、付费调用、真实数据、浏览器验收和部署分别需要当前用户明确授权；旧授权不自动续用。

## Workspace

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- branch: `codex/e2-multimodal-recognition-exp`
- last_prefreeze_commit: `ee7ffc9`，B6 数据与 P3 在首次运行前已冻结并推送；B6 已运行且变为已见，禁止再次用于首次泛化声明。
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

### P2 与 B4

- P2 `task-formation-policy-2.2.0-p2` 把完整条件命题、原文动作 surface、受控 actionType/effect、显式主体证据和修订状态分层；只存在于隔离测试/runner，未接稳定路径。
- P2 定向/变形测试 8/8；已见 B3 回归所有主要指标 100%、Major=0、Forbidden=0。P2 组件 14 路径冻结于 commit `d92b621`。
- B4 在 commit `fc2aeb7` 先冻结并推送，再唯一运行一次。16/16 可评分；Task P/R/F1 100%，requiresAction 100%，semantic fields 97.52%，boundary 100%，Complete 93.75%，Major 6.25%，Safe Default 100%，Forbidden 0。
- B4-07 的“此前通知……停止执行”仍留下一个未勾选的陈旧外发任务；安全不退化，但会增加删除成本，后续必须单报 revision 与 stale-task 指标。
- 全量 `npm test` 通过（Vitest 573 passed / 1 live OCR skipped，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5），lint 通过；但 `npm run build` 在冻结的 `taskFormationB4Dataset.test.ts` 报 TS2352：`revisionRefs` 被声明为空 tuple，JSON 推断为一般数组。
- 该测试已进入 B4 首次运行前 freeze，不能事后修改再把 B4 说成有效未见通过。因此 oracle quality=`PASS`，overall=`FAIL`，付费模型继续阻塞。security scan 477 files PASS；npm audit 官方 endpoint 网络超时。

### E1 类型等价修补与 B5 首次门

- E1 只把 B4 测试中的 `revisionRefs: []` 类型声明改为契约数组类型，运行时代码仍构造空数组；修补前后 TypeScript 转译 JavaScript SHA-256 完全相同，原 B4 数据、Expected、freeze、P2 和评分器字节不变。
- 已见 B4 回归的 16 个逐例 prediction/score 和全部指标与原结果完全一致；E1 lint/test/build/security 全通过，提交 `6c025c4` 已推送。
- B5 在提交 `578d2a3` 先冻结并推送：16 个全新匿名合成 Development、23 个指令、5 个观察；原文和语义家族不复用 B0–B4，逐例 bigram Jaccard <0.55。预先加入 revision/stale-task 硬门。
- 冻结 P2 对 B5 只运行一次。16/16 可评分；Task P/R/F1、requiresAction、boundary、Safe Default 都是 100%，semantic fields 97.52%，Complete 93.75%，Major 6.25%，Forbidden 0。
- 决定性失败是 B5-08：“先前规定……该规定不再有效”没有把旧“发送宿舍分配表”标为 `past/cancelled/superseded`；修订整例 50%、旧要求完整失效表达 50%、新要求生效召回 100%、陈旧任务 1、被默认勾选的陈旧任务 0。
- 总体 `FAIL`：安全默认没有退化，但用户仍要删除陈旧建议。B5 已见，不得修改 P2 后重跑追分；付费模型继续阻塞。

### P3 本机修订关系解析与已见 B5 回归

- 新增隔离 `revision-relation-resolver-1.0.0` 与 `task-formation-policy-2.3.0-p3`，显式输出 `cancels`、`supersedes`、`amends`、旧任务 ID、替代任务 ID、证据 scope ID、指称类型和解析方式。
- 解析优先使用任务已绑定的状态 scope；否则仅接受唯一、相邻且指称类型一致的旧任务。两个候选时返回 unresolved，不猜测。
- 旧任务保留审计但投影为 `past/cancelled/superseded` 且不默认；替代任务独立按当前义务与安全策略处理。动作、对象、执行人、actionType 和 effect 不因修订分类改写。
- 定向/变形 10/10；六种失效表面表达关系不变，三类修订、歧义失败关闭、证据绑定和篡改检测均通过。
- 已见 B5 回归 16/16：Task P/R/F1、requiresAction、semantic、boundary、Complete、Safe Default、旧要求失效、新要求生效均 100%；Major 0、Forbidden 0、stale 0、selected stale 0、unresolved 0。
- P3 16 路径组件冻结；只被隔离测试和 runner 引用，未接稳定路径。这仍不是新数据泛化或模型正确率。

### B6 首次未见 P3 本机门

- B6 在 commit `ee7ffc9` 先冻结并推送：16 个全新匿名合成 Development，三类修订关系各 2 条、歧义/非任务取消 2 条；与 B0–B5 原文和语义家族不重复，逐例 bigram Jaccard <0.55。
- 冻结 P3 随后只运行一次；B6 立即标为已见。16/16 可评分；Task P/R/F1、requiresAction、semantic、boundary、Complete、Safe Default 均 100%，Major=0、Forbidden=0。
- cancels/supersedes/amends 精确率各 100%；旧要求完整失效、新要求生效、歧义保持未解析、修订整例均 100%；stale=0、selected stale=0。
- 结果是 `PASS_LOCAL_P3_ONLY`：只证明 Expected-derived 理想 scope/action/object 锚点进入 P3 后的本机上限，不是模型、OCR、图片/文件、真实材料、真人修改时间、浏览器或上线证据。
- 下一步仅具备“另行申请付费上游模型测试”的资格；当前没有付费授权，RCO-6、稳定路径和部署继续阻塞。

### B7 模型 scope/action/object 数据与契约冻结

- 新建 12 个匿名合成 Development 案例、18 个期望动作锚点；与 B0–B6 source/family 不重复，逐例 bigram Jaccard <0.55，DeepSeek 尚未见。
- 模型输出被缩到 scope ID、原文 action/object surface 和 ignored scope；严格 Schema 不含 requiresAction、semantics、effect、actionType、revisionRefs 或 selected。
- 本机 composer 采用“动作表面词优先、对象仅兜底”的受控分类，再交给冻结 P3；预冻结对抗测试发现并修复了对象“核对记录”污染“保存”分类的问题。
- P3 理想锚点上限 12/12 合同有效、12/12 Complete Task Case，3 条明确修订关系与 1 条 unresolved 均精确；因此后续真实失败可主要定位到模型锚点选择。
- 拟议但未授权的 M1：`deepseek-v4-flash-vision-exp`，每案 1 次、最多 12 次、temperature 0、thinking none、Repair/retry 0、人民币硬上限 10 元；无 verifier。

### 完整性与工程门

- B2 原冻结的 12 个组件仍逐项 SHA-256 匹配；P1 组件冻结另绑定 16 个计划、代码、测试、runner、结果和依赖路径。
- 定向 PASS：P1 策略/对抗 16/16、P1/B2 完整性 4/4、typecheck。
- 全量 PASS：lint；Vitest 551 passed / 1 live OCR skipped；server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build；security scan 435 files。
- `npm audit --audit-level=high` 连续两次在官方 advisory endpoint 网络超时，记录为 `NOT_COMPLETED_EXTERNAL_NETWORK`；不得写成 0 vulnerabilities，也没有证据表明发现漏洞。
- 未部署；保留既有 >500 kB chunk warning。
- B3 新增定向完整性检查 `13/13 PASS`；全量 lint PASS，Vitest `558 passed / 1 live OCR skipped`，server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5、build PASS、security scan 451 files PASS。B3 阶段 npm audit 两次仍在官方 endpoint 超时。
- E1 全量 lint/test/build/security PASS：Vitest `573 passed / 1 live OCR skipped`，security scan 486 files；构建仅保留既有 >500 kB chunk warning。
- B5 最终全量 lint/test/build/security PASS：Vitest `580 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；security scan 504 files。工程通过不能覆盖 B5 修订质量门失败。
- P3 全量 lint/test/build/security PASS：Vitest `590 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；security scan 518 files。保留既有 >500 kB chunk warning。

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
- P2 component freeze/result: `docs/recognition-optimization/RCO-5-007-P2_COMPONENT_FREEZE.json` and `rco-5-007-p2-b3-replay/`
- B4 data/result freeze: `docs/recognition-optimization/RCO-5-007-B4_DATA_FREEZE.json` and `RCO-5-007-B4_RESULT_FREEZE.json`
- B4 result/report/audit/status: `docs/recognition-optimization/rco-5-007-b4-oracle/`
- E1 correction/freeze/replay: `docs/recognition-optimization/RCO-5-007-P2-E1_TYPE_CORRECTION.json`, `RCO-5-007-P2-E1_COMPONENT_FREEZE.json` and `rco-5-007-p2-e1-b4-replay/`
- B5 data/result freeze: `docs/recognition-optimization/RCO-5-007-B5_DATA_FREEZE.json` and `RCO-5-007-B5_RESULT_FREEZE.json`
- B5 result/report/audit/status: `docs/recognition-optimization/rco-5-007-b5-oracle/`
- P3 plan/component freeze: `docs/recognition-optimization/RCO-5-007-P3-B6_PLAN.md` and `RCO-5-007-P3_COMPONENT_FREEZE.json`
- P3 seen-B5 result/report/audit: `docs/recognition-optimization/rco-5-007-p3-b5-replay/`
- append-only history: `docs/recognition-optimization/OPTIMIZATION_LOG.md`

## First-Principles Interpretation

P3 已把 B5 暴露的词面共现问题升级为“状态声明 → 旧任务 → 可选替代任务”的可审计关系边，并在歧义时失败关闭。已见 B5 满分只证明机制修复方向成立；是否真正跨表达泛化，必须由冻结后全新 B6 的唯一首次运行决定。

## Current Gate / Next Action

- gate: `P3 TECHNICAL_PASS_PENDING_COMMIT / B6 BLOCKED UNTIL P3 COMMIT / PAID MODEL BLOCKED / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- next: 提交并推送 P3 冻结件；之后才创建、冻结并推送全新 B6，再唯一运行一次。
- after_b6: 只有 B6 的总体质量、旧要求失效、新要求生效、陈旧任务和工程门全部通过后，才能另行批准固定模型、调用数和人民币上限的付费测试。
- promotion rule: 付费新数据仍稳定提升且 Forbidden=0，才可申请 RCO-6；之后仍需真实去标识材料、真人修改时间、Chrome/Edge/手机、隐私安全和 Commercial Preview，才能讨论上线。

## Recovery

1. 读根 `AGENTS.md`、`PRD.md`、本文件和日志最后两节。
2. 重新核对 branch、HEAD、upstream、worktree；任何差异先当用户资产。
3. 只读取当前任务必要文件；大结果用路径、哈希、计数和结论，不灌入上下文。
4. 当前只执行 P3/B6 零调用链路；不得修改 P2/B5 保护件、调用模型、启动 RCO-6 或部署。

## RCO-5-008 最新状态补充 — 2026-09-04

- B7 真实模型原始结果保持原封不动；原判定仍为 `NO_PROMOTION_PAID_REPLICATION_BLOCKED`。
- 新增隔离 composer v2：从版本化受控动作表提取最小动作头；动作候选同时命中多个受控动作时失败关闭。
- 条件事实只在完整命题唯一匹配时本机挂接；冲突候选保持 unknown。
- 新增隔离 P4：从完整命题和本机动作头计算否定、可选、条件、主体、时态与 selected，不读取模型语义权限。
- 新评分器按 scope + object 映射任务/关系，动作边界独立计分；新增 unsafe-default false-positive 硬指标。
- 已见 B7 原始输出 0 调用回放：scope/action/object、Task F1、requiresAction、Complete、三类修订、旧要求失效、新要求生效、unresolved 均 100%；unsafe/Forbidden/stale/selected stale 均 0。
- 该结果只证明已知接口故障已修，不是模型新数据泛化。下一步仅允许冻结全新 B8，付费调用仍需单独授权。
- 稳定路径未接入，RCO-6 未启动，未部署。

## RCO-5-008-B8 数据冻结补充 — 2026-09-04

- 仅在已见 B7 零调用回归通过后创建 B8；12 个全新匿名合成 Development 案例、20 个期望选择，与 B0–B7 的 source/family 不重复，逐例 bigram Jaccard `<0.55`。
- 冻结前唯一修正：B8-10 的替代提示由未被当前冻结解析器识别的“新通知要求”改为已登记的“从现在起”；发生在数据冻结和任何模型调用前，已记录，未用于追逐模型结果。
- 冻结前 P4 理想上游检查：12/12 selection valid、12/12 locally composable、12/12 contract valid、12/12 Complete Task Case；unsafe default false positive=0；三类修订与 1 条 unresolved 全部精确。
- 数据、计划、生成器、数据测试和 RCO-5-008 组件 freeze 已用 SHA-256 绑定；冻结测试 3/3、数据/对抗测试 7/7。
- B8 仍未被 DeepSeek 看见；模型/网络/Repair/retry/Secret=`0/0/0/0/NONE`，未创建付费 runner 或 checkpoint。
- 后续 12 次 candidate、10 元硬上限只是预注册参数，不构成付费授权；必须另行明确授权并先冻结新的单次 runner 和空 checkpoint。
- 最终工程门：RCO-5-008/B8 完整性 7/7，lint PASS，Vitest `624 passed / 1 live OCR skipped`，server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO base integrity 4、Functions 5，build PASS，security scan 575 files PASS；仅保留既有 >500 kB chunk warning。
- gate: `RCO-5-008 COMPLETE / B8 DATA_AND_P4_CEILING_FROZEN / PAID RUN NOT_AUTHORIZED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。

## RCO-5-008-B8-M1 付费盲测补充 — 2026-09-04

- 一次性 runner 在 commit `e6f3b60` 冻结并推送后才执行；12/12 candidate 获得明确终态且严格 Schema 有效，verifier/Repair/retry=`0/0/0`，密钥仅存在于当前子进程内存。
- 模型结果：scope P/R/F1=`90.9%/83.3%/87.0%`，动作逐字=`40.0%`，对象逐字=`90.0%`，完整锚点案例=`25.0%`。
- 冻结 P4 端到端：Task P/R/F1=`100.0%/75.0%/85.7%`，requiresAction=`83.3%`，Complete=`66.7%`，Major Correction=`33.3%`。
- 安全方向守住：unsafe-default false positive、Forbidden、stale、selected stale 均为 0；但 cancels/amends/unresolved 未通过，旧要求失效仅 33.3%。
- 主因：模型给动作加“请/禁止/可自行”等前缀；漏掉历史或修订旧侧动作；把“停止执行/取消”状态句冒充任务。P4 能纠正前缀和条件，但当前单条不可控动作会使整例失败。
- 费用：usage 12,407 input + 5,178 output；服务商人民币实扣 `NOT_OBSERVABLE`，冻结价格上界代理成本 `0.1229404 CNY`，不是账单。
- decision: `NO_PROMOTION_PAID_REPLICATION_BLOCKED / RCO-6 BLOCKED / NO_STABLE_INTEGRATION / DO_NOT_LAUNCH`。
- next: 等待另行授权 0 调用的候选枚举/分类契约轮；B8 只能作为已见回归，后续泛化必须使用全新 B9。
