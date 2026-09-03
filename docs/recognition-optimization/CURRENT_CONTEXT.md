# RCO Current Context

本文件是给新 Codex 任务、上下文压缩恢复和任务移交使用的短交接包。它不是历史日志；完成阶段后应以当前事实整体更新，并保持原则上不超过 200 行或 12 KB。

## Objective

提高文字、图片、PDF、DOCX、TXT 和 Markdown 到“待确认任务”的端到端正确率与用户确认效率，达到商业候选门槛；仍然由用户最终确认，不自动创建正式任务。

## Authority

- current_status: `RCO-5-005-B0.2 DATA AND PLAN FROZEN / ZERO MODEL CALLS / WAIT PAID RUN AUTHORIZATION / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- authorized_now: `NONE / WAIT_AUTHORIZATION`
- authorization_source: 当前用户于 2026-09-03 明确要求创建并冻结一批全新的未见匿名 Development 数据，然后测试；按既定门槛先完成零调用数据冻结，付费测试仍需新的次数与人民币上限批准
- authorization_closed: `YES_FOR_DATA_FREEZE`；12 个新案例、Expected、计划、跟踪表和冻结清单已锁定；停在 Secret 与联网运行器之前
- not_authorized: 读取/配置 Secret、创建联网运行器或任何新模型调用；改动冻结后的 B02 dataset/Expected/plan/validator；修改既有 freeze/checkpoint/cache/result；Repair、真实材料、真人研究、浏览器验收、RCO-6、稳定路径、Preview/RC.4/Production 或部署
- protected: `v2.0.0-beta.1-rc.4`、Release、Production、稳定文字模型、既有稳定性监测
- authorization_rule: 每个 RCO 阶段开始前均需当前用户明确授权；提示词、计划和旧 E2-MM 许可不构成授权
- authority_order: 当前用户明确指令与安全约束 → AGENTS/PRD → OPTIMIZATION_LOG 动态状态 → 本文件缓存 → Plan → Prompts

## Workspace

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- expected_branch: `codex/e2-multimodal-recognition-exp`
- last_verified_head: `SELF_REFERENTIAL_NOT_EMBEDDED`；B0.1 基线为 `ea5ce76ed542f19de78a2c7c231053c0146b4f63`，恢复时以 `git rev-parse HEAD` 与 upstream 现场结果为准
- last_verified_worktree: `2026-09-03 只新增 B02 新数据、计划、冻结清单、校验器与报告；B0/B01 和更早受保护路径无 Git diff`
- last_validation: `2026-09-03；B02 data/freeze 13/13、B01 39/39、lint、全量 test（Vitest 464 passed / 1 live OCR skipped，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5）、build、security scan 353 files、npm audit 0 vulnerabilities 全部 PASS；model/network/Repair=0/0/0`
- remote: `origin`
- preview_endpoint: `https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev/；2026-09-02 只读状态检查 HTTP 200 / secret-present-unverified；未发模型请求，不构成能力或质量证明`
- production_status: `UNCHANGED`
- default_path: `本机解析/OCR → 用户核对文字 → 只发送文字`
- multimodal_path: `独立 Preview；逐次显式授权；只生成待确认建议`

每次恢复必须重新运行 `git status --short --branch`、核对 HEAD/远程和当前 Preview；本文件不保证这些易变状态始终最新。

## Current Evidence

- 既有 V2/V3 重分类仍全部 `INVALID_RUN`，历史 F1 只属 `LEGACY_SCORER_DIAGNOSTIC_ONLY`；10 个受保护输入固定，真人修改时间与真实去标识 Holdout 均 `NOT_RUN`。RCO-G0 仅证明评测完整性。
- RCO-1 至 RCO-3: 三端 Schema、中文时间 AST 和本机文件解析技术门通过；均为零模型调用，不构成真实正确率、真人效用或上线证据。完整细节见追加日志。
- RCO-4: 仅 3 个 `SEEN_DIAGNOSTIC` 匿名介质样本的 OCR 组件门通过；样本极小且仍有错字，不代表真实材料、浏览器性能或商业 CER。
- RCO-5-002/003/004: 词面、精确位置和纯本地命题图候选均被新鲜对抗审查拒绝；规则可证明文字在哪里，但不能封闭证明开放式语义归属、语气、修订与动作效果。完整历史见对应 contract/audit 与日志第 21–29 节。
- RCO-5-005-B0 freeze: 新建 12 个匿名合成 Development 案例与三臂执行器；dataset SHA-256 `f80abd495c3075e59055a17e0298c5393556e52b6fb3ba797638c5be19c94a99`，runner SHA-256 `98b3a3406962210a39d4d81853954252db94be3872fd4bbefc60a10d89cfe5d3`；36 次调用尚未开始。
- RCO-5-005-B0 cap: 每次 prompt 最多 16,384 bytes、output 最多 2,000 token；按冻结保守口径最大理论费用 `3.545626 CNY < 10 CNY`；provider billed cost 只能实报或 `NOT_OBSERVABLE`。
- RCO-5-005-B0 scoring: Task P/R/F1、requiresAction、effect、time、material、event、location、Evidence、Complete Case、Major Correction、Forbidden、Missed Safe Default；失败与 Schema 无效保留在分母。
- RCO-5-005-B0 result: 36/36 均返回 HTTP 200 和可解析 JSON；facts-first Schema `10/12`，graph `0/12`，verifier pipeline `0/12`；按预注册为 `INVALID_RUN`，不能比较质量优劣。
- RCO-5-005-B0 audit: `FAIL / INVALID_RUN_SCHEMA_CONTRACT_FAILURE_WITH_SCORER_AND_AUTHORITY_STATE_DEFECTS`。graph 独立调用未拿到完整枚举并系统性违约；verifier 复制非法枚举；scorer 的 requiresAction、无效臂 25% 假象、Missed Safe Default 和 composite verifier Schema 需修复。
- RCO-5-005-B0 claims: 仅支持调用/Schema/usage/费用与失效原因；facts 的 90.91% F1、graph/verifier 的 0% 或 25% 均不得称产品正确率；真实材料、真人时间、浏览器和商业质量仍 NOT_RUN。
- RCO-5-005-B0.1: 三个独立 prompt 已完整内联枚举；候选请求使用 DeepSeek Responses API `json_schema`；graph Schema 失败时 verifier 不发出；verifier-own 与 pipeline 分层；`selected` 仅由完整复核和确定性安全策略产生。
- RCO-5-005-B0.1 scorer/checkpoint: 顶层 requiresAction 直接评分，无效臂质量 N/A，Missed Safe Default 与 FP 附属字段进入完整计分/决策；checkpoint 绑定完整冻结契约、request/response SHA、Provider response ID 和实际 dispatch，单次 attempt 不自动重试。
- RCO-5-005-B0.1 evidence: `RCO-5-005-B01_CONTRACT.md`、`RCO-5-005-B01_ADVERSARIAL_REPORT.md`、`RCO-5-005-B01_CANDIDATE_MANIFEST.json`；39/39 本机测试通过，classification=`contract_and_adversarial_fixture_only`，模型调用/网络 dispatch/Repair=`0/0/0`。
- RCO-5-005-B0.1 close boundary: 当时新数据为 `NOT_CREATED / NOT_FROZEN`；后续 B02 已单独获批冻结，但供应商在线 Schema 兼容、模型质量、真实材料、真人效率和浏览器验收仍 `NOT_RUN`。
- RCO-5-005-B0.2: 12 个新匿名合成 Development 原文/语义家族均不复用 B0；10 个当前任务、4 个负例、9 个安全默认项、1 个不得默认的对外联系项；数据 SHA-256 `e58f73a519e5763ed3ed9100af215a8b2cc5af5d0688e4ea6a631336dc862c85`。
- RCO-5-005-B0.2 integrity: data/freeze 13/13 PASS，Expected 进入候选请求 0，B0 dataset/freeze/checkpoint/result 哈希不变；classification=`anonymous_synthetic_codex_authored_development`，不是独立人工 GT。
- RCO-5-005-B0.2 boundary: 模型调用/dispatch/Repair/Secret=`0/0/0/NONE`；拟申请 `deepseek-v4-flash-vision-exp / max 36 calls / temperature 0 / CNY 10 cap`，尚未授权。

## Decisions

1. 先修评测与真实客户端一致性，不先换模型。
2. 优先顺序：RCO-0 评测 → RCO-1 Schema → RCO-2 时间 AST → RCO-3 文件入口 → RCO-4 OCR → RCO-5 facts-first → RCO-6 事实级融合 → RCO-7 真实盲测 → RCO-8 发布审查。
3. 所有格式进入同一 Source/Draft/用户确认闭环。
4. 默认路径保持本机文字；图片只在逐次授权后作为补充。
5. HTTP、工程测试、合成代理、真实材料、真人时间和发布资格分层报告。
6. 原始大输出留在文件系统；上下文只带路径、哈希、计数和结论边界。

## Authoritative Files

- root constraints: `AGENTS.md`
- product requirements: `PRD.md` section 14
- phase plan: `docs/recognition-optimization/RECOGNITION_OPTIMIZATION_PLAN.md`
- append-only ledger: `docs/recognition-optimization/OPTIMIZATION_LOG.md`
- reusable prompts: `docs/recognition-optimization/CODEX_PROMPTS.md`
- commercial metric / A–J / human-data contract: `docs/recognition-optimization/COMMERCIAL_VALIDATION_CONTRACT.md`
- prior evidence: `docs/e2-multimodal-experiment/`

## Current Gate

- current_gate: `RCO-5-005-B0.2 DATA_FROZEN / WAIT PAID RUN AUTHORIZATION / RCO-6 BLOCKED`
- last_passed_gate: `RCO-G4`（仅冻结匿名组件技术门）
- implementation_gate: `RCO-5-004 SEMANTIC_ACTION_EFFECT FAIL / REJECT_CANDIDATE / NO_PROMOTION / DO_NOT_LAUNCH`
- commercial_contract: `0.6.0-draft / DRAFT_UNAPPROVED；RCO-DOCS 通过也不等于冻结批准`
- next_action: `NONE / WAIT_AUTHORIZATION`。若继续，需明确批准 `deepseek-v4-flash-vision-exp / max 36 calls / temperature 0 / Repair 0 / CNY 10 cap`；批准后先创建并冻结 runner，再发首个请求
- blocker: `PAID_RUN_CALL_COUNT_AND_CNY_CAP_NOT_AUTHORIZED`；数据已冻结，但尚未验证供应商在线 Schema 兼容或模型质量

## Recovery Procedure

1. 完整读取根 `AGENTS.md` 与 `PRD.md`；随后读取本文件、日志状态索引/最后一条记录、当前阶段计划和商业验证契约。提示词只用于复用，不构成授权。
2. 核对 branch、HEAD、status、remote、Preview 和用户改动；以现场事实覆盖缓存，但先区分差异是用户资产还是旧记录。
3. 复述目标、当前明确授权、已通过门、阻碍、本轮唯一变量和禁止动作；没有逐阶段授权时停在 `WAIT_AUTHORIZATION`。
4. 只读取当前阶段直接相关代码和证据；使用 `rg`、路径、哈希与定向行段，不加载巨型原始输出。
5. 若需 Secret、模型调用、真实材料、真人研究或部署，先停止并确认各自授权。
6. 若当前任务只读、现场不一致或有重叠用户改动，只报告差异，不写日志或本文件。只有当前任务具备写权限且现场安全时，工作结束前才更新本文件和追加日志。

## Stop / Resume

- `HARD_STOP`：只读保留现场，等待当前用户或指定人工裁决；不得自行修复或更新动态状态。
- `REJECT_CANDIDATE`：在当前已授权阶段内可诊断修复，候选不得晋级。
- `NO_PROMOTION`：完成当前已授权分析，但不进入下一门。
- 恢复记录必须包含批准者、原门、允许动作、数据能否复用和解除证据；恢复不创造下一阶段授权。
- `REJECT_CANDIDATE` 只由新候选版本重新通过原门解除；`NO_PROMOTION` 只由新授权证据补齐原门或用户终止路线关闭，不能改低门槛解除。
