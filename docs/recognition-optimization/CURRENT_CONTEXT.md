# RCO Current Context

本文件是给新 Codex 任务、上下文压缩恢复和任务移交使用的短交接包。它不是历史日志；完成阶段后应以当前事实整体更新，并保持原则上不超过 200 行或 12 KB。

## Objective

提高文字、图片、PDF、DOCX、TXT 和 Markdown 到“待确认任务”的端到端正确率与用户确认效率，达到商业候选门槛；仍然由用户最终确认，不自动创建正式任务。

## Authority

- current_status: `RCO-5-006-B1 DATA_AND_PLAN_FROZEN / PAID_PARAMETERS_REQUIRED / MODEL_CALLS=0 / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- authorized_now: 与 B02 不重复的新匿名 Development 数据创建和冻结已完成；用户已提出随后付费验证，但新运行尚缺明确模型、最大调用次数和人民币硬上限
- authorization_source: 当前用户于 2026-09-03 要求冻结与 B02 不重复的新匿名数据并随后付费验证 scope 选择与语义标签；本次只完成可独立封闭的零调用数据冻结
- authorization_closed: `RCO-5-006 CLOSED / TECHNICAL_PASS_ZERO_CALLS`；`RCO-5-005-B02-M2 CLOSED / INVALID_RUN`；两者冻结件均不得修改或复用旧运行额度
- not_authorized: 在当前用户明确给出本次模型、最大调用次数和人民币硬上限前读取 Secret、创建/冻结联网 runner 或发送模型请求；以及 Repair/retry、真实材料、真人研究、浏览器验收、RCO-6、稳定路径接入、Preview/RC.4/Production 或部署
- protected: `v2.0.0-beta.1-rc.4`、Release、Production、稳定文字模型、既有稳定性监测
- authorization_rule: 每个 RCO 阶段开始前均需当前用户明确授权；提示词、计划和旧 E2-MM 许可不构成授权
- authority_order: 当前用户明确指令与安全约束 → AGENTS/PRD → OPTIMIZATION_LOG 动态状态 → 本文件缓存 → Plan → Prompts

## Workspace

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- expected_branch: `codex/e2-multimodal-recognition-exp`
- last_verified_head: `7b19bb000383ac8d9acdec35d11db79b0cf72e24`（B1 数据冻结提交）与 upstream 同步；最终状态日志提交在其后，恢复时以现场 `git rev-parse HEAD` 为准
- last_verified_worktree: `2026-09-03 B1 数据冻结提交并推送后 clean；B02 与稳定路径无 Git diff`
- last_validation: `2026-09-03 B1；scope index 3/3、dataset 7/7、freeze 6/6；lint、typecheck、全量 test（Vitest 510 passed / 1 live OCR skipped，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5）、build、security scan 377 files、npm audit 0 vulnerabilities 全部 PASS；模型/网络/Secret/部署均 0/NONE/NOT_RUN`
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
- RCO-5-005-B0/B01: 首轮三臂因 Schema/计分/编排缺陷失效；B01 用 0 调用修正严格 JSON Schema、无效臂计分、checkpoint 与 graph 失败零调用复核，39/39 契约/对抗测试通过。历史完整记录见追加日志第 30–32 节。
- RCO-5-005-B02 data: 12 个新匿名合成 Codex-authored Development、12 个新语义家族、10 个当前任务、4 个负例、9 个安全默认项、1 个不得默认的 external interaction；dataset SHA-256 `e58f73a519e5763ed3ed9100af215a8b2cc5af5d0688e4ea6a631336dc862c85`，不是独立人工 GT。
- RCO-5-005-B02 run: `deepseek-v4-flash-vision-exp` / temperature 0；36 个逻辑单元均有终态，实际 dispatch `25`、确认回执 `25`、未知回执 `0`、graph 不合格后 verifier 零调用跳过 `11`，Repair/retry `0/0`。
- RCO-5-005-B02 usage: `59,061 input / 13,017 output / 72,078 total tokens`；Provider billed cost `NOT_OBSERVABLE`，冻结峰值口径折算 `0.4316928 CNY < 10 CNY`。
- RCO-5-005-B02 quality: facts Schema `12/12`，Task P/R/F1 `40%/40%/40%`，requiresAction `100%`，Complete Case `33.3%`（仅 4 个负例），Major Correction `66.7%`，Forbidden Default `5`，Safe Default Recall `44.4%`；graph Schema `1/12`，唯一 verifier 自身因自由改写 evidence 失效。
- RCO-5-005-B02 diagnosis: 11 个 graph 共 56 个契约错误，其中 scope/text/start/end 43、关系端点类型 8、关系证据端点覆盖 5；模型能粗略识别动作，但不能稳定承担精确位置、字段分工、关系和逐字证据生成。
- RCO-5-005-B02 decision: `CLOSED / INVALID_RUN / NO_PROMOTION / RCO-G5 NOT PASSED / RCO-6 BLOCKED / DO_NOT_LAUNCH`；证据只属匿名合成 Development，不支持真实材料、真人修改时间、浏览器或商业结论。
- RCO-5-006: 新候选只允许模型引用本机生成的 source/version-bound scope ID 与受控语义；offset、逐字 evidence、关系记录和 selected 全由本机 composer 生成。核心 13/13、属性变形 9/9、新鲜同作者对抗 14/14，共 36/36；审查中修复了“复核身份可自证”、遗漏 task-location 关系和纯事件被丢弃三项主线问题。
- RCO-5-006 boundary: 技术门只证明已登记匿名夹具能失败关闭；真实可信 verifier 尚未接入，模型选 scope 和语义标签的质量、真实材料、真人时间与浏览器均 `NOT_RUN`，不能把 36/36 当识别正确率。
- RCO-5-006-B1 data: 已冻结 12 个新匿名合成 Development、12 个与 B02 不重复的 family、22 个指令命题和 12 个观察；4 个 requiresAction=false、10 个安全默认、12 个不得默认；dataset SHA `e9379259ffe23879f25fecc70318dc8049c3c9e7b054d5a25f47aeb593b32170`。
- B1 pre-freeze finding: 旧 index 会切断 `19:30`；失败结果未冻结，新增隔离 `scope-index-1.1`，数字间冒号不切、标题冒号仍切，并绑定 index version。当前付费调用仍为 0。

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

- current_gate: `RCO-5-006-B1 DATA_AND_PLAN_FROZEN / WAIT_EXPLICIT_PAID_PARAMETERS / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED`
- last_passed_gate: `RCO-G4`（仅冻结匿名组件技术门）
- implementation_gate: `PASS：source/version-bound scope、严格 Schema、本机 offset/evidence/relation/selected 与失败关闭对抗 36/36；不等于模型质量 PASS`
- commercial_contract: `0.6.0-draft / DRAFT_UNAPPROVED；RCO-DOCS 通过也不等于冻结批准`
- next_action: 等待用户明确批准本次模型、最大 24 次调用和人民币硬上限；批准后才能新增并冻结 runner/checkpoint，再读取 Secret 和运行 12 candidate + 最多 12 verifier
- blocker: 付费运行参数未完整授权；`RCO-G5 QUALITY NOT_RUN`，尚未证明模型 scope 选择和语义标签质量；RCO-6 继续阻断

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
