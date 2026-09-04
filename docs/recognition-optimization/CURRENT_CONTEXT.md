# RCO Current Context

本文件供上下文压缩、任务恢复和移交使用；只保留当前事实，历史细节见追加日志。

## Objective

提高文字、图片与文件到“待确认任务”的端到端正确率和用户确认效率。AI 永远只给建议，不能直接创建正式任务。

## Current Authority

- current_status: `RCO-5-007-P1 AUTHORIZED / ZERO CALL / IN_PROGRESS / PAID MODEL BLOCKED / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- authorization_active: 仅修复 `requiresAction` 与 `selected` 解耦、对象感知复合动作边界、条件触发状态、对象保真和受控效果/风险分类；用已见 B2 做 0 次模型调用回归。
- model/network/repair/retry/secret: `0 / 0 / 0 / 0 / NONE`
- protected: 既有 Expected、freeze、dataset、checkpoint、cache；稳定路径、RC.4、Release、Production 均未修改。
- not_authorized: 修改 B2 Expected/freeze/dataset 或既有 checkpoint/cache；创建 B3；模型/Secret/网络；真实材料、真人研究、浏览器验收、RCO-6、稳定路径接入、Preview/Production 部署。
- authority_rule: 新阶段、付费调用、真实数据、浏览器验收和部署分别需要当前用户明确授权；旧授权不自动续用。

## Workspace

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- branch: `codex/e2-multimodal-recognition-exp`
- last_implementation_commit: `cacdb6c`，已推送；恢复时重新核对 HEAD/upstream/worktree。
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

### 完整性与工程门

- B2 Expected/标签不进入未来请求投影；冻结件绑定数据、计划、生成器、理想锚点 runner、评分器、策略与传递契约共 12 个路径 SHA-256，不匹配即停止。
- 定向 PASS：B2 数据/评分 13/13、冻结 3/3、理想锚点结果完整性 4/4、typecheck。
- 全量 PASS：lint；Vitest 535 passed / 1 live OCR skipped；server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build；security scan 424 files；npm audit 0 vulnerabilities。
- 未部署；保留既有 >500 kB chunk warning。

## Evidence Files

- policy/plan: `docs/recognition-optimization/RCO-5-007_PLAN.md`
- semantic policy: `docs/recognition-optimization/RCO-5-007_SEMANTIC_POLICY_V2.md`
- component freeze: `docs/recognition-optimization/RCO-5-007_COMPONENT_FREEZE.json`
- result/report: `docs/recognition-optimization/rco-5-007-replay/result.json` and `REPORT.md`
- adversarial audit: `docs/recognition-optimization/rco-5-007-replay/ADVERSARIAL_AUDIT.md`
- B2 dataset/freeze: `docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json` and `RCO-5-007-B2_FREEZE.json`
- B2 result/report/audit: `docs/recognition-optimization/rco-5-007-b2-oracle/`
- append-only history: `docs/recognition-optimization/OPTIMIZATION_LOG.md`

## First-Principles Interpretation

RCO-5-007 修复了“谁负责作决定”，但 B2 证明决定流程内部仍混淆了两个问题：“是否有事要做”和“是否可以安全默认勾选”。主线不是继续堆同义词，而是分层处理当前义务、任务边界与对象、效果风险和默认选择。先让完美输入能稳定产生正确任务，之后再花钱测模型是否能提供足够好的输入。

## Current Gate / Next Action

- gate: `P1_ZERO_CALL_IMPLEMENTATION_IN_PROGRESS / PAID MODEL BLOCKED`
- next: 新增隔离策略与测试，保持所有 B2 保护件和旧策略不变，再运行 B2 零调用回放。
- after_patch: 修补通过后必须另冻全新 B3 未见匿名集并先跑理想锚点门。B3 通过后，才能另行批准同模型、固定调用数与人民币上限的付费配对测试。
- promotion rule: 付费新数据仍稳定提升且 Forbidden=0，才可申请 RCO-6；之后仍需真实去标识材料、真人修改时间、Chrome/Edge/手机、隐私安全和 Commercial Preview，才能讨论上线。

## Recovery

1. 读根 `AGENTS.md`、`PRD.md`、本文件和日志最后两节。
2. 重新核对 branch、HEAD、upstream、worktree；任何差异先当用户资产。
3. 只读取当前任务必要文件；大结果用路径、哈希、计数和结论，不灌入上下文。
4. 当前只可完成 P1 授权内容；不得创建 B3、调用模型、启动 RCO-6 或部署。
