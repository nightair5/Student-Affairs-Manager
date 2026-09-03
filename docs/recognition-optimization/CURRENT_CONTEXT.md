# RCO Current Context

本文件供上下文压缩、任务恢复和移交使用；只保留当前事实，历史细节见追加日志。

## Objective

提高文字、图片与文件到“待确认任务”的端到端正确率和用户确认效率。AI 永远只给建议，不能直接创建正式任务。

## Current Authority

- current_status: `RCO-5-007 CLOSED / TECHNICAL_PASS_ZERO_CALL_REPLAY / NO_PROMOTION / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- authorization_completed: 统一复合动作、否定状态、命令时态和说明归属；缩小模型职责；建立本机任务形成/安全决策；修复评分依赖哈希绑定；只读回放 B1。
- model/network/repair/retry/secret: `0 / 0 / 0 / 0 / NONE`
- protected: 既有 Expected、freeze、dataset、checkpoint、cache；稳定路径、RC.4、Release、Production 均未修改。
- not_authorized: 新数据创建、模型调用、真实材料、真人研究、浏览器验收、RCO-6、稳定路径接入、Preview/Production 部署。
- authority_rule: 新阶段、付费调用、真实数据、浏览器验收和部署分别需要当前用户明确授权；旧授权不自动续用。

## Workspace

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- branch: `codex/e2-multimodal-recognition-exp`
- last_implementation_commit: `a912165`，已推送；恢复时重新核对 HEAD/upstream/worktree。
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

### 完整性与工程门

- source-only 预测输入物理不含 Expected；Expected 只由后置评分器读取。
- 预测器、评分器、传递依赖、B1 输入和保护件共 23 个路径 SHA-256 绑定；不匹配即停止。
- 全量 PASS：lint；Vitest 522 passed / 1 live OCR skipped；server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build；security scan 409 files；npm audit 0 vulnerabilities。
- 未部署；保留既有 >500 kB chunk warning。

## Evidence Files

- policy/plan: `docs/recognition-optimization/RCO-5-007_PLAN.md`
- semantic policy: `docs/recognition-optimization/RCO-5-007_SEMANTIC_POLICY_V2.md`
- component freeze: `docs/recognition-optimization/RCO-5-007_COMPONENT_FREEZE.json`
- result/report: `docs/recognition-optimization/rco-5-007-replay/result.json` and `REPORT.md`
- adversarial audit: `docs/recognition-optimization/rco-5-007-replay/ADVERSARIAL_AUDIT.md`
- append-only history: `docs/recognition-optimization/OPTIMIZATION_LOG.md`

## First-Principles Interpretation

RCO-5-007 修复的是“谁负责作决定”：模型只找候选位置，本机用一致规则形成任务和把关安全。这消除了已知的随机口径漂移，但没有解决模型在新材料上完全漏掉锚点、未知动作同义词、复杂跨段回指和真实 OCR 噪声。继续在 B1 上补规则只会过拟合。

## Current Gate / Next Action

- gate: `ELIGIBLE_FOR_NEW_UNSEEN_VALIDATION_ONLY`
- next: 等待用户另行授权创建并冻结一批未参与定规则的匿名挑战集；先锁 Expected、政策、scorer、调用次数和人民币上限，再用相同 candidate 模型比较旧编排与 RCO-5-007 本机层。
- required metrics: Task Recall/Precision、requiresAction、语义字段、Complete Task Case、Major Correction、Safe Default、Forbidden，并逐例报告错误方向。
- promotion rule: 新数据仍稳定提升且 Forbidden=0，才可申请 RCO-6；之后仍需真实去标识材料、真人修改时间、Chrome/Edge/手机、隐私安全和 Commercial Preview，才能讨论上线。

## Recovery

1. 读根 `AGENTS.md`、`PRD.md`、本文件和日志最后两节。
2. 重新核对 branch、HEAD、upstream、worktree；任何差异先当用户资产。
3. 只读取当前任务必要文件；大结果用路径、哈希、计数和结论，不灌入上下文。
4. 未有新授权时停在 `WAIT_AUTHORIZATION`；不得调用模型、创建数据、启动 RCO-6 或部署。

