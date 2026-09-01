# RCO Current Context

本文件是给新 Codex 任务、上下文压缩恢复和任务移交使用的短交接包。它不是历史日志；完成阶段后应以当前事实整体更新，并保持原则上不超过 200 行或 12 KB。

## Objective

提高文字、图片、PDF、DOCX、TXT 和 Markdown 到“待确认任务”的端到端正确率与用户确认效率，达到商业候选门槛；仍然由用户最终确认，不自动创建正式任务。

## Authority

- current_status: `RCO-1 COMPLETE / RCO-G1 PASS / NO_PROMOTION / WAIT_AUTHORIZATION / DO_NOT_LAUNCH`
- authorized_now: `NONE`；RCO-1 授权范围已执行完毕，不延伸到 RCO-2
- authorization_source: 当前用户于 2026-09-02 明确指令：`授权执行 RCO-1：仅统一 Worker、浏览器和评测器 Schema 契约，先做 0 次模型调用验证，不修改 Expected/freeze/checkpoint/cache，不部署。`
- authorization_closed: `YES`；RCO-G1 完成 0 调用验证后关闭；最终提交与推送状态须从当前 Git 现场读取
- not_authorized: RCO-2；Expected、freeze、dataset、checkpoint、缓存修改；Secret、模型调用、真实材料、真人研究、Preview、RC.4/Production 修改或部署
- protected: `v2.0.0-beta.1-rc.4`、Release、Production、稳定文字模型、既有稳定性监测
- authorization_rule: 每个 RCO 阶段开始前均需当前用户明确授权；提示词、计划和旧 E2-MM 许可不构成授权
- authority_order: 当前用户明确指令与安全约束 → AGENTS/PRD → OPTIMIZATION_LOG 动态状态 → 本文件缓存 → Plan → Prompts

## Workspace

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- expected_branch: `codex/e2-multimodal-recognition-exp`
- last_verified_head: `5d0e2488af3468b65bb3de1dccf5f232a26d5f4e`（RCO-0 完成提交；RCO-1 启动基线）
- last_verified_worktree: `RCO-1 完成文件已验证；最终提交后仍需重新运行 git status，不依据本行推测 clean`
- last_validation: `2026-09-02；RCO-1 自对抗审查 PASS；contract drift check、lint、typecheck、build PASS；325 tests PASS；security scan 245 files PASS；npm audit 0 vulnerabilities；Cloudflare 三环境 dry-run PASS`
- remote: `origin`
- preview_endpoint: `https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev/；2026-09-02 只读状态检查 HTTP 200 / secret-present-unverified；未发模型请求，不构成能力或质量证明`
- production_status: `UNCHANGED`
- default_path: `本机解析/OCR → 用户核对文字 → 只发送文字`
- multimodal_path: `独立 Preview；逐次显式授权；只生成待确认建议`

每次恢复必须重新运行 `git status --short --branch`、核对 HEAD/远程和当前 Preview；本文件不保证这些易变状态始终最新。

## Current Evidence

- 历史旧 scorer Task F1 63.74% / 71.58% / 71.29% 仅为 `LEGACY_SCORER_DIAGNOSTIC_ONLY`，不得解释为正确率。
- 当前客户端完整校验只读重放：V2 T `0/36`、I `1/36`、IT `2/35`（另 1 transport）；V3 I `0/36`；全部已运行臂均为 `INVALID_RUN`。
- V3 T/IT: `NOT_RUN`，不是 100% 请求失败。
- V2/V3 每轮只有 12 个共享有限模板的 semantic families；不等于 72 个独立真实案例。
- 旧/新客户端 Boolean 判断：143 个 truthy 历史结果 mismatch `0`；旧 scorer core summary 两轮均精确复现。
- 两轮 dataset/OCR/checkpoint/summary/freeze 共 10 个受保护输入固定 SHA，重分类前后不变；模型调用 `0`。
- 真人修改时间与真实去标识/假名化 Holdout: `NOT_RUN`
- fresh audit: `PASS / same-family / provisional`，只证明评测完整性。
- conclusion: `RCO-G0 PASS / NO_PROMOTION / DO NOT LAUNCH`
- RCO-1: 三端共用 `src/recognition/schema.ts`；Worker 生成契约源 SHA-256 `81f636bcf62a4e35221ba7e620a0410b3cc39bbf7481882e42ab1222839eab40`；缺字段、未知字段、重复 ID、悬空引用、非法日期与来源外证据均 fail-closed。
- Repair: 只完成一次、结构限定、来源证据限定、不得新增语义实体或删除 failure 的纯契约；实际调用 `NOT_RUN`。
- RCO-G1 conclusion: `PASS / ZERO MODEL CALLS / NO_PROMOTION / DO NOT LAUNCH`。

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

- current_gate: `WAIT_AUTHORIZATION_RCO-2`
- last_passed_gate: `RCO-G1`（仅三端严格 Schema 技术契约）
- implementation_gate: `RCO-1 COMPLETE / NO_PROMOTION / DO_NOT_LAUNCH`
- commercial_contract: `0.6.0-draft / DRAFT_UNAPPROVED；RCO-DOCS 通过也不等于冻结批准`
- next_action: `NONE`；等待当前用户单独授权 RCO-2，默认不修改时间语义、模型、数据或部署
- blocker: `RCO-2_NOT_AUTHORIZED`；模型/Secret/真实数据/真人/Preview/Production 也仍未授权

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
