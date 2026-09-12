# Recognition Optimization Log

本文件是 RCO 的追加式事实账本。旧记录不得覆盖；指标订正追加到 Corrections，阶段状态只在有新证据时更新。完整原始输出留在受保护或 Git 忽略位置，日志只记录路径、哈希、计数、指标和安全错误类型。

## 1. 状态索引

| Entry | 阶段 | 唯一变量/目的 | 数据 | 调用 | 结果 | 决策 | 下一门 |
|---|---|---|---|---:|---|---|---|
| RCO-5-005-B0 | RCO-5 paid diagnostic | facts-first、完整命题图与独立语义复核三臂 | 新冻结匿名合成 Development 12 例 | 36/36 | INVALID_RUN / AUDIT FAIL | CLOSED / DO_NOT_LAUNCH | 等待 B0.1 零调用修补授权 |
| RCO-5-004 | RCO-5 proposition graph | 完整命题范围、语义状态、独立验证绑定和确定性选择 | Mock / 匿名属性变形夹具 | 0 云端模型 | FAIL (SEMANTIC EFFECT) | REJECT_CANDIDATE / DO_NOT_LAUNCH | 等待新授权；B1 不运行 |
| RCO-5-003 | RCO-5 provenance | 本机验证精确 span、类型化关系与模糊关系不自动勾选 | Mock / 匿名契约夹具 | 0 云端模型 | FAIL (PROPOSITION SCOPE) | REJECT_CANDIDATE / DO_NOT_LAUNCH | 等待新架构授权；B1 不运行 |
| RCO-5-002 | RCO-5 repair | 字段/关系证据、状态、sourceId 与动作归一化修补 | Mock / 匿名契约夹具 | 0 云端模型 | FAIL (CONTRACT) | REJECT_CANDIDATE / DO_NOT_LAUNCH | 新 span/relation Schema 需另授权；B1 不运行 |
| RCO-5-001 | RCO-5 | 紧凑事实账本、确定性任务构造与跨字段验证 | Mock / 匿名契约夹具 | 0 云端模型 | TECHNICAL PASS / QUALITY NOT_RUN | NO_PROMOTION / DO_NOT_LAUNCH | RCO-6 被 RCO-G5 阻断 |
| RCO-4-001 | RCO-4 | 分介质预处理、质量路由与可见提示 | 匿名组件验证集 / SEEN_DIAGNOSTIC | 0 云端模型 | PASS (COMPONENT) | NO_PROMOTION / DO_NOT_LAUNCH | RCO-5 未授权 |
| RCO-3-001 | RCO-3 | 本机多格式提取完整性、结构和失败回退 | Mock / 匿名组件夹具 | 0 | PASS (TECHNICAL) | NO_PROMOTION / DO_NOT_LAUNCH | RCO-4 已授权待独立启动 |
| RCO-2-001 | RCO-2 | 统一中文时间 AST 与确定性归一化 | Mock / 匿名夹具 / 历史输出只读 | 0 | PASS (TECHNICAL) | NO_PROMOTION / DO_NOT_LAUNCH | RCO-3 未授权 |
| RCO-1-001 | RCO-1 | 统一 Worker、浏览器和评测器严格 Schema 契约 | Mock / 匿名夹具 | 0 | PASS (TECHNICAL) | NO_PROMOTION / DO_NOT_LAUNCH | RCO-2 未授权 |
| RCO-0-001 | RCO-0 | 评测有效性与客户端严格校验一致，并重分类历史证据 | V2/V3 受保护 checkpoint 只读重放 | 0 | PASS (INTEGRITY) | NO_PROMOTION / DO_NOT_LAUNCH | RCO-1 未授权 |
| RCO-DOC-001 | Docs | 冻结商业级识别主线、门槛、日志、上下文、提示词与验证契约 | 现有代码/报告 | 0 | PASS (DOCS) | WAIT_AUTHORIZATION | RCO-0 未授权 |
| MM-V2-001 | 历史诊断 | T/I/IT 正式配对 | Synthetic-Unseen-V2 | 108 计划，107 完成 | IT 因 1 次失败失效 | DO_NOT_LAUNCH | 保留为诊断 |
| MM-V3-I-001 | 历史复验 | 直接图片复现 | Synthetic-Unseen-V3 | 36 | I Task F1 71.29%，完整正确率 0 | DO_NOT_LAUNCH | 保留为诊断 |

## 2. 当前权威状态

- program: `Recognition Commercialization Optimization`
- status: `RCO-5-005-B0 CLOSED / INVALID_RUN / 36 OF 36 MODEL CALLS / AUDIT FAIL / RCO-6 BLOCKED / DO_NOT_LAUNCH`
- branch: `codex/e2-multimodal-recognition-exp`
- protected_release: `v2.0.0-beta.1-rc.4`
- production_status: `UNCHANGED`
- stable_default_path: `本机解析/OCR → 用户核对文字 → 只发送文字`
- image_path: `逐次显式授权；Preview-only；仅待确认建议`
- human_timing: `NOT_RUN`
- real_deidentified_holdout: `NOT_RUN`
- next_authorized_action: `NONE / WAIT_AUTHORIZATION`
- next_implementation_gate: `若继续，先另行授权 B0.1 零调用修复 prompt/schema/scorer/checkpoint 契约并做新鲜对抗审查；不得自动重跑模型或启动 RCO-6`
- authorization_rule: `每个 RCO 阶段开始前均需当前用户明确授权；文档/提示词/旧 E2-MM 许可不构成授权`
- docs_authorization_source: `2026-09-01 当前用户明确要求制作优化 AGENTS/PRD/日志/提示词/目标与流程；RCO-DOCS 交付范围随本次文档提交推送关闭，不延伸到 RCO-0`

## 3. 历史基线快照

| 指标 | V2 T | V2 I | V2 IT | V3 I | 证据边界 |
|---|---:|---:|---:|---:|---|
| Completed | 36/36 | 36/36 | 35/36 | 36/36 | IT 正式质量结论失效 |
| Task Precision | 93.55% | 97.14% | INVALID_RUN | 87.80% | 合成代理 |
| Task Recall | 48.33% | 56.67% | INVALID_RUN | 60.00% | 合成代理 |
| Task F1 | 63.74% | 71.58% | INVALID_RUN | 71.29% | 服务端归一化后任务匹配 |
| TimePoint F1 | 0% | 0% | INVALID_RUN | 0% | 硬阻断 |
| Complete Case | 0% | 0% | INVALID_RUN | 0% | 无免修改案例 |
| Major Correction | 100% | 100% | INVALID_RUN | 100% | 自动操作代理 |
| requiresAction | 8.33% | 8.33% | INVALID_RUN | 8.33% | 关键字段默认问题 |

补充端到端复核：V3 36/36 的顶层 `timePoints` 为空，28/36 含 37 个悬空时间引用；V2 的 T、I、IT 也存在大量相同结构问题。因此历史 Task F1 不得表述为客户端可用率。V2/V3 共享有限情境模板，不得当作 72 个独立语义案例。

历史证据：

- `docs/e2-multimodal-experiment/2026-08-31_DIRECT_IMAGE_REPLICATION_RESULT.md`
- `docs/e2-multimodal-experiment/DIRECT_IMAGE_REPLICATION_RESULT.json`
- `.evaluation-cache/multimodal-unseen-v2/runs/synthetic-unseen-v2-formal-20260831a.summary.json`
- `.evaluation-cache/multimodal-unseen-v3/runs/synthetic-unseen-v3-image-only-replication-20260831a.checkpoint.json`

## 4. 决策记录

| ID | 决策 | 理由 | 状态 |
|---|---|---|---|
| D-001 | 不先换模型 | 当前最弱层是 Schema、时间与入口损失 | ACTIVE |
| D-002 | 先让评测复用客户端完整校验 | 浏览器拒绝结果不能算质量成功 | ACTIVE |
| D-003 | 使用唯一时间 AST | 多套时间规则导致值、精度和关联漂移 | ACTIVE |
| D-004 | 文件按格式和 PDF 页级路由 | 整份二选一会漏混合扫描页 | ACTIVE |
| D-005 | 模型输出收敛为事实账本 | 大 Schema 造成事实与规划竞争 | REJECTED_PENDING_SPAN_RELATION_SCHEMA；词面证据不足以证明语义归属 |
| D-006 | 只做事实级融合 | 整份结果二选一会隐藏冲突与来源 | PROPOSED；待 RCO-6 验证 |
| D-007 | 默认仍为本机文字路径 | 现有多模态未证明稳定净收益 | ACTIVE |
| D-008 | 商业证据必须包含真人修改时间 | 自动纠错次数不能代表用户效率 | ACTIVE |
| D-009 | CURRENT_CONTEXT 保持短小 | 降低 Codex 压缩后凭记忆误操作风险 | ACTIVE |
| D-010 | 全部计划 `source × arm` 逻辑单元进入完成率分母，API 子请求另记 | 防止只对成功返回样本报高分或让 Repair 扩大质量分母 | ACTIVE |
| D-011 | RCO-n 为阶段，RCO-Gn 为门，组件验证集不叫 Holdout | 避免与产品 P0/P1/P2 及商业 Holdout 混淆 | ACTIVE |
| D-012 | 商业指标/A–J/人类与数据协议单一契约 | 让放行结论可唯一复算 | PROPOSED；待用户批准冻结 |

## 5. 阶段追踪

| Gate | 目标 | 状态 | 关键产物 | 晋级结论 |
|---|---|---|---|---|
| RCO-DOCS | 约束、PRD、计划、日志、上下文、提示词、验证契约 | PASS | 根 AGENTS/PRD 与本目录 | RCO-0 未授权；等待用户 |
| RCO-G0 | 评测与产品链路一致 | PASS | shared validation/reclassification/audit | 仅评测完整性通过；NO_PROMOTION |
| RCO-G1 | 严格 Schema | PASS | schema/validator/repair contract | 仅技术契约；NO_PROMOTION |
| RCO-G2 | 唯一时间 AST | PASS | AST/tests/migration note | 仅技术契约；NO_PROMOTION |
| RCO-G3 | 多格式本机提取 | PASS | DOCX/PDF/text/OCR fixtures | 仅技术契约；NO_PROMOTION |
| RCO-G4 | 分介质 OCR | PASS (COMPONENT) | OCR ablation / quality routing | SEEN_DIAGNOSTIC；仅组件；NO_PROMOTION |
| RCO-G5 | facts-first | REJECT_CANDIDATE / QUALITY NOT_RUN | fact schema / task composer / four fresh audits | 词面契约审查失败；B1 不运行；NO_PROMOTION |
| RCO-G6 | 事实级融合 | BLOCKED | frozen T/I/IT result | 已列入阶段请求，但被 RCO-G5 阻断，未启动 |
| RCO-G7 | 真实效用与浏览器 | NOT_RUN | real holdout / human timing / RCO-A…RCO-J | 需另行授权 |
| RCO-G8 | 发布 | BLOCKED | release decision | Production 不变 |

## 6. 单次实验追加模板

复制本节并追加，不覆盖旧条目。

### `[experiment_id] — [title]`

#### Context Snapshot

- recorded_at:
- owner:
- branch / HEAD:
- working_tree:
- preview_endpoint:
- current_gate / last_passed_gate:
- authorization_source / authorized_scope:
- next_authorized_action:
- forbidden_actions:
- related_files:

#### Experiment Contract

- hypothesis:
- single_variable:
- baseline / candidate:
- model:
- prompt_version / pipeline_version / scorer_version / client_schema_version:
- dataset_split / dataset_id / dataset_sha256 / seen_status:
- freeze_commit:
- metric_contract_version / approval_record:
- planned_api_calls:
- evaluator_retries: `0`
- repair_limit:
- expected_if_component_matters:
- preregistered_stop_condition:

#### Input Boundary

- formats:
- local_processing:
- cloud_payload:
- explicit_consent_required:
- data_never_sent:
- ground_truth_sent_to_model: `false`

#### Run Manifest

| Atomic block | Arm | Planned logical | Completed logical | Initial requests | Repair invoked/completed | Transport fail | Final Schema fail | Semantic fail | Returned model |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| | | | | | | | | | |

- token_usage: `OBSERVED / NOT_OBSERVABLE`
- cost: `OBSERVED / NOT_OBSERVABLE`
- hidden_retry: `false`
- logical_completion_denominator: `all planned source × arm logical units`
- api_request_accounting: `initial + repair separately; API requests are not extra quality samples`
- atomic_block_status: `INVALID_RUN unless every arm completed logical = planned logical; otherwise evaluate gates`

#### Results

| Metric | Baseline | Candidate | Delta | Gate | Status |
|---|---:|---:|---:|---:|---|
| Client-valid result | | | | 100% | |
| Formal completion | | | | 100% | |
| Critical Span/Page Coverage | | | | 100% | |
| Encoding Fidelity | | | | 100% where applicable | |
| OCR CER | | | | per-format contract cap | |
| Partial/Truncation Disclosure | | | | 100% | |
| Task Precision | | | | | |
| Task Recall | | | | | |
| Task micro-F1 | | | | ≥ 90% commercial candidate | |
| TimePoint F1 | | | | ≥ 95% commercial candidate | |
| requiresAction | | | | ≥ 95% commercial candidate | |
| Evidence Validity | | | | ≥ 98% commercial candidate | |
| Evidence Coverage | | | | ≥ 98% commercial candidate | |
| Material F1 | | | | ≥ 95% commercial candidate | |
| Critical Date Exact | | | | ≥ 99% commercial candidate | |
| Complete Case | | | | ≥ 80% commercial candidate | |
| Major Correction | | | | ≤ 10% commercial candidate | |
| Severe/Forbidden | | | | 0 observed | |
| Repair Invocation / Harm | | | | ≤5% / 0 observed | |
| C − S Task F1 / Major Correction | | | | +3pp / −5pp with adjusted bounds | |
| Human median edit time | | | | median C/S ≤0.85 and U95 <1.00 | |
| Human p95 edit time | | | | U95(p95 C/S) ≤1.10 | |
| IT − T Task F1 / Major Correction | | | | +3pp / −5pp | |
| IT − I Task F1 / Major Correction | | | | +3pp / −5pp | |
| Mean / p95 latency | | | | frozen budget | |
| Peak memory / cost per completed source | | | | frozen budget / observable | |

- batch_1_result:
- batch_2_result:
- per_format_results:
- cluster_interval_method / result:

#### Error Review

- highest_frequency_error:
- highest_severity_error:
- transport/schema/time/extraction errors:
- missing_tasks / forbidden_tasks:
- scorer_or_label_issue:
- representative_case_ids:
- human_adjudication_required:

#### Decision

- decision: `WAIT_AUTHORIZATION / BLOCKED / REJECT_CANDIDATE / NO_PROMOTION / REPEAT_INFRA_ONLY / PROMOTE_TO_NEXT_GATE`
- stop_level: `NONE / HARD_STOP / REJECT_CANDIDATE / NO_PROMOTION`
- recovery_approver:
- allowed_recovery_actions:
- reusable_data:
- release_condition:
- evidence_bounded_conclusion:
- claims_not_supported:
- dataset_contamination_update:
- corrections_log:
- rc4_status: `UNCHANGED`
- production_status: `UNCHANGED`
- next_step:

## 7. Corrections

| Correction ID | Date | Target | Original | Corrected | Reason | Effect on prior claim |
|---|---|---|---|---|---|---|
| C-001 | 2026-08-31 | 历史 V2/V3 解释 | Task F1 容易被理解为端到端成功率 | 明确限定为服务端归一化后的任务匹配；客户端有效性待 RCO-0 重算 | 存在悬空引用与关键字段默认 | 收紧结论，不改变 DO NOT LAUNCH |
| C-002 | 2026-09-02 | 历史 V2/V3 成功与质量解释 | 模型返回或旧 scorer 数字容易被当作客户端成功率，未测试臂被表现为失败，Forbidden 搜索包含 description | V2 T/I/IT 客户端有效分别为 0/36、1/36、2/35（另 1 transport）；V3 I 为 0/36，V3 T/IT 为 NOT_RUN；历史质量数值仅为 LEGACY_SCORER_DIAGNOSTIC_ONLY，Forbidden 旧指标不可解释 | 使用真实客户端完整校验器只读重放，并先精确复现旧 scorer | 撤销“约 71% 正确率”、图片优越或可上线解释；阶段结论 NO_PROMOTION |
| C-003 | 2026-09-02 | RCO-5-001 审计轨迹路径 | `.aris/traces/experiment-audit/2026-09-02_run01/` | `.aris/traces/experiment-audit/2026-09-02_run02/` | run01 属于 RCO-0；RCO-5 新鲜审查实际保存在 run02 | 不改变 RCO-5 `WARN / QUALITY_NOT_RUN / NO_PROMOTION` 结论，只修复证据寻址 |

## 8. RCO-DOC-001 记录

- hypothesis: 将权威约束、产品目标、执行流程、日志与上下文交接分层，可降低后续 Codex 偏航和上下文压缩风险。
- single_variable: 文档治理；不修改产品代码、数据、模型、Secret 或部署。
- files_planned:
  - `AGENTS.md`
  - `PRD.md`
  - `docs/recognition-optimization/RECOGNITION_OPTIMIZATION_PLAN.md`
  - `docs/recognition-optimization/OPTIMIZATION_LOG.md`
  - `docs/recognition-optimization/CURRENT_CONTEXT.md`
  - `docs/recognition-optimization/CODEX_PROMPTS.md`
  - `docs/recognition-optimization/COMMERCIAL_VALIDATION_CONTRACT.md`
- model_calls: 0
- real_data: NOT_USED
- production_effect: NONE
- validation: PASS；详见下方最终验证记录
- decision: `PASS_DOCS / WAIT_AUTHORIZATION`
- next_step: `NONE；等待用户明确授权 RCO-0（默认 0 次模型调用）`

### RCO-DOC-001 最终验证 — 2026-09-01T18:45:36+08:00

- adversarial_review: 多轮独立只读读者先后发现并推动修正未见配对、候选路由事后选择、统计复算、样本/API 分母、真人算术、数据保留、Preview 循环、移动端矩阵和 G6 语义冲突；最终读者结果 `PASS`。
- contract_snapshot: `0.6.0-draft / 643DF93152CEFDEA7A397821B6E9BEDE4F924CDAB64BBD4DC4B0BCD68D5C7E16`；格式整理后的当前字节快照再次经终审 PASS，仍为 `DRAFT_UNAPPROVED / NOT FROZEN / NOT AUTHORIZED TO RUN`。
- document_structure: PASS；7 个目标 Markdown 均为有效 UTF-8、无 NUL、代码围栏成对；`CURRENT_CONTEXT.md` 5,775 bytes，低于 12 KB。首次检查包装命令因 PowerShell 变量插值语法报错，修正命令后通过；不属于产品或文档失败。
- git_diff_check: PASS；仅有 Git 的 LF→CRLF 工作区提示，无内容错误。
- `npm run lint`: PASS。
- `npm run test`: PASS；Vitest 260、server 8、Cloudflare Worker 24、multimodal evaluation library 9、Firebase Functions 5，共 306 tests。
- `npm run build`: PASS；Vite 构建成功；保留已有大 chunk warning，未把 warning 表述为性能验收通过。
- `npm run security:scan`: PASS；扫描 235 个 source/build files。
- paid_model_calls / real_materials / human_study / preview_deploy / production_change: `0 / NOT_USED / NOT_RUN / NOT_RUN / NONE`。
- conclusion: RCO-DOCS 只证明文档内部一致、可恢复、可执行；不批准商业验证契约，不授权 RCO-0、Secret、模型、真实数据、真人研究、Preview 或 Production。

## 9. RCO-0-001 启动记录 — 2026-09-02T01:01:03+08:00

### Context Snapshot

- owner / authorization_source: 当前用户于 2026-09-02 明确授权 RCO-0。
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `c0771e927772a0986b0961108af68366b8127f41` / 同一 commit。
- working_tree_before_start: `clean`；无重叠用户改动。
- preview_endpoint: `https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev/`；只读检查 HTTP 200，状态 `secret-present-unverified`；未发模型请求。
- current_gate / last_passed_gate: `RCO-G0 IN_PROGRESS` / `RCO-DOCS PASS`。
- hypothesis: 只有先用真实客户端的完整校验器判定结果，再评分并按计划单元归约，才能消除“模型返回即评测成功”的虚假成功。
- single_variable: 评测有效性判定及历史结果解释；不改变 Prompt、模型、Worker 输出、产品识别行为或数据。
- allowed_actions: 修改 RCO-0 评测/校验诊断代码与匿名测试；只读重放既有 V2/V3 checkpoint；新增重分类报告；更新本日志、短上下文和实验 tracker；验证、单独提交并推送。
- forbidden_actions: 修改 Expected、freeze、dataset、checkpoint、`.evaluation-cache`；调用模型、读取/写入 Secret、处理真实材料、真人研究、部署 Preview、修改 RC.4/Release/Production、进入 RCO-1。
- model_calls / real_data / human_study / deploy: `0 / NOT_USED / NOT_RUN / NOT_RUN`。
- protected checkpoint SHA-256:
  - V2: `A451D7CE9A206BA78D4B13DAB5B408C17C62E636641FCB6E4664360ECF44BC39`
  - V3: `D24E3FA8893F00A74221B1DC2B333F5289405BB243C9FD526B194180EE80DDD5`
- protected summary SHA-256:
  - V2: `2C77964EA13CEA47ADE40AA1D63F788898BBD187F211FC0CAC39075961779EC2`
  - V3: `154FF19A0149A9A3036826C70992019C7C826FCC8F1ED0DF854B945413EB60C2`
- baseline client replay: V2 T `0/36`、I `1/36`、IT `2/35`（另 1 transport）；V3 I `0/36`。
- stop_conditions: 需要修改受保护证据；原始 hash 改变；无法复用客户端 validator；旧 scorer 无法复算；范围扩张到模型、Worker、Prompt、时间 AST、RCO-1+ 或部署。
- decision_before_change: `AUTHORIZED_RCO_0 / DO_NOT_LAUNCH / NO_PROMOTION`。

## 10. RCO-0-001 完成记录 — 2026-09-02T01:44:00+08:00

### 实现与证据

- client_validator: 评测器在内存中加载浏览器实际使用的 `src/recognition/schema.ts`；Boolean 行为对 143 个历史 truthy 结果保持 0 mismatch，并新增 Schema/reference 诊断，不改变产品接收布尔结论。
- fail_closed_scoring: truthy 结果默认不是 `completed`；只有完整客户端校验通过并显式标记后才进入质量分数；续跑结果同样重校验。
- failure_taxonomy: 分开 transport、authentication、billing、rate_limit、model、json、schema、reference、semantic、scoring；非 JSON HTTP 错误体仍按 HTTP 状态分类。
- aggregation: 未运行臂为 `NOT_RUN`；已运行但不完整或客户端无效为 `INVALID_RUN`；技术可评分只叫 `VALID_RUN` / `SCOREABLE`，不冒充质量门 PASS。
- scorer: 空分母为 `null`；Forbidden 只看任务身份字段；`selected:false` 的 task/material/time/event 不评分；Evidence Validity 与 Coverage 分开。
- historical_reclassification:
  - V2 T: `0/36 client-valid`，`INVALID_RUN`。
  - V2 I: `1/36 client-valid`，`INVALID_RUN`。
  - V2 IT: `2/35 client-valid + 1 transport`，`INVALID_RUN`。
  - V3 I: `0/36 client-valid`，`INVALID_RUN`。
  - V3 T/IT: `NOT_RUN`。
- legacy_reproduction: 两轮旧 scorer core summary 先精确复现；当前/基线客户端 Boolean 判断共 143 个 truthy 结果 mismatch 为 0。
- protected_inputs: 两轮 dataset、OCR、checkpoint、summary、freeze 共 10 个路径均固定 SHA，并在运行前后复核不变；Expected 随 dataset hash 受保护。
- artifacts:
  - `docs/recognition-optimization/RCO-0_RECLASSIFICATION.json`
  - `docs/recognition-optimization/RCO-0_RECLASSIFICATION.md`
  - `docs/recognition-optimization/RCO-0_EXPERIMENT_AUDIT.json`
  - `docs/recognition-optimization/RCO-0_EXPERIMENT_AUDIT.md`

### 验证

- `npm run lint`: PASS。
- `npm run typecheck`: PASS。
- `npm run test`: PASS；Vitest 262、server 8、Cloudflare Worker 24、multimodal evaluation 21、Firebase Functions 5，共 320 tests。
- `npm run build`: PASS；保留既有大 chunk warning，不视为性能验收。
- `npm run security:scan`: PASS；扫描 242 个 source/build files。
- `npm audit --audit-level=high`: PASS；0 vulnerabilities。
- `npm run eval:multimodal:reclassify -- --write`: PASS；0 次模型调用；受保护输入不变；verdict `NO_PROMOTION`。
- `cloudflare:check`: `NOT_APPLICABLE`；本阶段未修改 Worker 或部署配置，且未授权部署。

### 对抗性审查

- fresh_reviewer: `GPT-5.6-Sol ultra`，只读，新任务；`review_independence=same-family`，`acceptance_status=provisional`。
- final_verdict: `PASS`；只证明 RCO-0 评测完整性。
- reviewer_driven_fixes: 非 JSON HTTP 分类、truthy 默认完成、续跑重校验、untested observation、10 路径哈希保护、summary 版本、真实 generatedAt、`VALID_RUN/SCOREABLE` 命名。
- limits: 不证明模型质量、真实材料泛化、真人修改时间、浏览器验收、Preview 或 Production；若未来需要跨家族独立接受结论，必须另行取得相应审查能力与授权。

### 决策

- decision: `RCO-G0 PASS / NO_PROMOTION / DO_NOT_LAUNCH`。
- stop_level: `NO_PROMOTION`。
- model_calls / secret_access / real_data / human_study / deploy: `0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- rc4 / release / production / stable_model: `UNCHANGED`。
- evidence_bounded_conclusion: RCO-0 已让评测成功定义与客户端接受一致，并诚实重分类历史结果；旧约 71% Task F1 不再能被解释为图片直接识别正确率。
- claims_not_supported: 多模态优于文字、商业正确率、真实材料泛化、用户提效、浏览器通过、Preview/Production 可上线。
- next_step: `NONE；RCO-1 尚未授权，停在 RCO-G0 等待当前用户明确指令`。

## 11. RCO-1-001 启动记录 — 2026-09-02T02:00:26+08:00

### Context Snapshot

- owner / authorization_source: 当前用户于 2026-09-02 明确指令：`授权执行 RCO-1：仅统一 Worker、浏览器和评测器 Schema 契约，先做 0 次模型调用验证，不修改 Expected/freeze/checkpoint/cache，不部署。`
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `5d0e2488af3468b65bb3de1dccf5f232a26d5f4e` / 同一 commit。
- working_tree_before_start: `clean`；无重叠用户改动。
- preview_endpoint: `https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev/`；只读检查 HTTP 200，状态 `secret-present-unverified`；未发模型请求。
- current_gate / last_passed_gate: `RCO-G1 IN_PROGRESS` / `RCO-G0 PASS`。
- hypothesis: 只有 Worker、浏览器和评测器执行同一份严格结构与引用契约，并把缺字段、非法值、重复 ID 和悬空引用显式报错，客户端有效率才不会被服务端静默默认或评测器口径差异虚高。
- single_variable: 三端 RecognitionResult 2.0 Schema 契约、错误映射及一次 Repair 的纯验证边界；不改变 Prompt、模型、Expected、数据、时间语义、识别策略或部署。
- allowed_actions: 新增共享或可生成的 Schema/validator/repair contract；修改 Worker、浏览器和评测器适配层；新增 Mock/匿名回归与对抗性测试；更新本日志与短上下文；验证、单独提交并推送。
- forbidden_actions: 修改 Expected、freeze、dataset、checkpoint、`.evaluation-cache`；调用模型或 Secret；处理真实材料/真人研究；部署 Preview/Production；修改 RC.4/Release/稳定模型；进入 RCO-2。
- model_calls / secret_access / real_data / human_study / deploy: `0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- protected_inputs_sha256: V2 dataset `464d4cd14f46f79fc908ef480a39def8b9e92463455b5131a9376855e6e9347c`，OCR `365df840c775c1914bc5439457dbbaa605f26d41d6e1342acbcd65887ee94399`，checkpoint `a451d7ce9a206ba78d4b13dab5b408c17c62e636641fcb6e4664360ecf44bc39`，summary `2c77964ea13cea47ade40aa1d63f788898bbd187f211fc0cac39075961779ec2`，freeze `a4790b96d4a8a68ba39dc6d8cd38cfa424545efdd092c947dcef416bc7b3361f`；V3 dataset `2f0e3455d7eedfb2554119ee8aa88b54da799e7d2a1f5c1434997ff4be76e5de`，OCR `814150a98507f984d30e46ace8b6a41f503812bb358257de26f65d7814fbcb63`，checkpoint `d24e3fa8893f00a74221b1dc2b333f5289405bb243c9fd526b194180ee80ddd5`，summary `154ff19a0149a9a3036826c70992019c7c826fcc8f1ed0df854b945413eb60c2`，freeze `5b60e3dcc35b9417b40473876cc54f82734a69be7882f7e13248b0f6887a4e19`。
- stop_conditions: 需要放宽 Schema、隐藏/删除失败、自动补造关键事实或引用、修改受保护输入、实际发起 Repair/模型调用、接触 Secret、改变时间解释、扩张到 RCO-2 或部署。
- decision_before_change: `AUTHORIZED_RCO_1 / DO_NOT_LAUNCH / 0_MODEL_CALLS`。

## 12. RCO-1-001 完成记录 — 2026-09-02T02:13:48+08:00

### 实现与证据

- single_source: `src/recognition/schema.ts` 是浏览器权威运行时契约；评测器仍在内存中转译同一文件；Worker 使用由该文件生成的 `cloudflare/recognition-contract.generated.mjs`。
- drift_gate: `scripts/generate-recognition-contract.mjs --check` 对源与生成物逐字比较；已接入 `npm test` 与 `npm run cloudflare:check`，生成物源 SHA-256 为 `81f636bcf62a4e35221ba7e620a0410b3cc39bbf7481882e42ab1222839eab40`。
- strict_failures: 缺失关键字段 `REQUIRED_FIELD_MISSING`、未知字段 `UNKNOWN_FIELD`、重复实体/evidence ID、全部跨引用悬空、日历上不可能的日期 `TIME_POINT_NORMALIZED_VALUE_INVALID`、文字来源外 quote `EVIDENCE_QUOTE_NOT_IN_SOURCE` 均显式失败。
- worker_sequence: 只覆盖服务端执行信封字段后先校验，既有归一化后再校验；两次任一失败均返回安全类别、代码和路径，不把正文、图片、quote 或 referenceId 回传。
- evaluator: 新请求和 checkpoint resume 都用同一校验器；T/IT 使用实际 OCR 文字做 evidence 逐字核验，I 保留离线冻结真值核验边界；Worker 报告的 schema/reference/semantic 类别不再被 HTTP 502 统一压成 transport。
- repair_contract: 最多一次；Repair 后必须严格有效且 evidence 来自本次文字来源；不得新增语义实体、删除 conflict/ambiguity 或进行第二次 Repair。本阶段 Worker 明确报告 `attempted:false / NOT_AUTHORIZED_IN_RCO_1_ZERO_CALL_VALIDATION`。
- artifact: `docs/recognition-optimization/RCO-1_SCHEMA_CONTRACT.md`。

### 0 调用与对抗性验证

- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- tri_party_parity: 有效结果、缺字段、重复 ID、悬空引用和非法日期在浏览器、Worker 生成契约、评测器间完整报告一致。
- worker_adversarial_mock: 缺字段、未知字段、重复 ID、悬空引用、非法日期、证据不在来源中全部 HTTP 502 fail-closed；响应未泄露测试正文或 evidence quote。
- repair_adversarial_mock: 一次纯结构修复可通过；新增任务事实、删除 failure、第二次 Repair 均被拒绝并标记 harm。
- normalization_review: 候选必须在归一化前已严格有效；归一化若删改造成坏引用或非法结果，会被第二次校验拒绝，不能静默成功。

### 工程门

- `npm run recognition:contract:check`: PASS。
- `npm run lint`: PASS。
- `npm run typecheck`: PASS。
- `npm run test`: PASS；Vitest 265、server 8、Cloudflare Worker 25、multimodal evaluation 22、Firebase Functions 5，共 325 tests。
- `npm run build`: PASS；保留既有 >500 kB chunk warning，不冒充性能验收。
- `npm run security:scan`: PASS；扫描 245 个 source/build files。
- `npm audit --audit-level=high`: PASS；0 vulnerabilities。
- `npm run cloudflare:check`: PASS；Worker tests 与 default/preview/multimodal_preview 三套 Wrangler dry-run 通过；没有执行部署。
- protected_inputs: RCO-0 固定的 V2/V3 dataset、OCR、checkpoint、summary、freeze 共 10 个 SHA-256 逐路径复核全部不变；Expected 随 dataset 受保护；`.evaluation-cache` 未修改。

### 决策

- decision: `RCO-G1 PASS / NO_PROMOTION / DO_NOT_LAUNCH`。
- pass_scope: 只证明三端严格契约、错误可观测性和 Repair 纯护栏在 Mock/匿名测试中成立。
- claims_not_supported: 模型正确率提升、时间识别改善、多模态胜出、真实材料泛化、真人修改时间、浏览器 A–J、Preview/Production 可上线。
- rc4 / release / production / stable_model: `UNCHANGED`。
- next_step: `NONE；RCO-2 尚未授权，停在 RCO-G1 等待当前用户明确指令`。

## 13. RCO-2-001 启动记录 — 2026-09-02T10:33:00+08:00

### Context Snapshot

- owner / authorization_source: 当前用户于 2026-09-02 明确指令：`RCO-2：仅统一中文时间 AST，先做 0 次模型调用验证，不修改 Expected/freeze/checkpoint/cache`。
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `7f9d8abd0b786d16f26d46878f03e7cadd7d55b2` / 同一 commit。
- working_tree_before_start: `clean`；无重叠用户改动。
- preview_endpoint: `https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev/`；只读检查根路径 HTTP 200，状态 `secret-present-unverified`；未发模型请求，未修改部署。
- current_gate / last_passed_gate: `RCO-G2 IN_PROGRESS` / `RCO-G1 PASS`。
- hypothesis: 由一个时区感知、保留精度且 fail-closed 的中文时间 AST 独占 rawText 到 normalizedValue/precision/isAllDay/needsConfirmation 的解释，可消除 parser、pipeline、Worker 与评测器之间的时间漂移，并阻止“缺日期补七天后、缺时刻补 18:00”等虚构。
- single_variable: 中文时间 AST、确定性解析/归一化、三端字段映射和对应匿名测试；不改变 Prompt、模型、Expected、数据、任务事实策略、Schema 外形或部署。
- allowed_actions: 新增唯一时间 AST 及 Worker 生成物；修改 parser、timeSemantics、pipeline 和 Worker 的时间适配层；新增中文数字、半、时段、相对日期、跨午夜、范围、更正、跨年、闰年、OCR 噪声、跨时区与旧草稿兼容测试；更新日志/短上下文；验证、单独提交并推送。
- forbidden_actions: 修改 Expected、freeze、dataset、checkpoint、`.evaluation-cache`；调用模型或 Repair、接触 Secret；处理真实材料/真人研究；部署 Preview/Production；修改 RC.4/Release/稳定模型；进入 RCO-3。
- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- protected_inputs_sha256: V2 dataset `464d4cd14f46f79fc908ef480a39def8b9e92463455b5131a9376855e6e9347c`，OCR `365df840c775c1914bc5439457dbbaa605f26d41d6e1342acbcd65887ee94399`，checkpoint `a451d7ce9a206ba78d4b13dab5b408c17c62e636641fcb6e4664360ecf44bc39`，summary `2c77964ea13cea47ade40aa1d63f788898bbd187f211fc0cac39075961779ec2`，freeze `a4790b96d4a8a68ba39dc6d8cd38cfa424545efdd092c947dcef416bc7b3361f`；V3 dataset `2f0e3455d7eedfb2554119ee8aa88b54da799e7d2a1f5c1434997ff4be76e5de`，OCR `814150a98507f984d30e46ace8b6a41f503812bb358257de26f65d7814fbcb63`，checkpoint `d24e3fa8893f00a74221b1dc2b333f5289405bb243c9fd526b194180ee80ddd5`，summary `154ff19a0149a9a3036826c70992019c7c826fcc8f1ed0df854b945413eb60c2`，freeze `5b60e3dcc35b9417b40473876cc54f82734a69be7882f7e13248b0f6887a4e19`；启动时逐路径复核一致。
- stop_conditions: 需要破坏性迁移或重写旧确认数据；必须模糊时间具体化；必须修改受保护输入；实际发起模型/Repair 调用、接触 Secret、处理真实数据、扩张到 RCO-3 或部署。
- decision_before_change: `AUTHORIZED_RCO_2 / RCO-G2_IN_PROGRESS / DO_NOT_LAUNCH / 0_MODEL_CALLS`。

## 14. RCO-2-001 完成记录 — 2026-09-02T10:49:18+08:00

### 实现与证据

- single_source: `src/lib/timeSemantics.ts` 是浏览器、本地 Pipeline 和评测器的权威时间语义；Worker 使用 `scripts/generate-time-ast.mjs` 生成的 `cloudflare/chinese-time-ast.generated.mjs`。
- drift_gate: `scripts/generate-time-ast.mjs --check` 已接入 `npm run recognition:contract:check`、`npm test` 与 `npm run cloudflare:check`；时间源 SHA-256 为 `d72109638ce4c653602478d2cd09049ab5a896a17c041422e8f5b583b8afde7d`。
- deterministic_fields: 模型/旧结果只提供或保留 `rawText/type/evidenceIds` 的事实责任；Worker 在严格 Schema 校验前覆盖 `normalizedValue/timezone/isAllDay/precision/needsConfirmation/selected`，校验后再用同一 AST 复算。
- parser_pipeline: 删除 parser 内独立数字、时段、相对日期和默认日期换算；Pipeline 直接映射 AST，事件范围生成独立 `event_end`；没有明确时间的准备建议保持未选中待确认。
- evaluator: 带 offset 与无 offset 时间均按声明 timezone 比较，不再由评测主机本地时区解释。
- artifact: `docs/recognition-optimization/RCO-2_TIME_AST.md`，包含字段映射、fail-closed 规则与旧草稿兼容说明。

### 0 调用与对抗性验证

- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- covered_time_cases: 阿拉伯/中文数字、`半`、清晨/早上/上午/中午/下午/傍晚/晚上/夜间/夜里/凌晨、相对日期、date-only、跨午夜、范围、更正、跨年、闰年、每月合法日/溢出日、OCR 空格/全角冒号、冲突和错误类型。
- fail_closed: 只有日期保留 `YYYY-MM-DD + all-day`；无日期、裸 `3点`、非法日期、冲突时间、无效 timezone、错误范围和“预计公布”被标为 deadline 均为 `null + needsConfirmation=true + selected=false`；不再补七天后或 18:00。
- host_parity: 生成 Worker AST 在 `UTC`、`America/New_York`、`Asia/Shanghai` 三种宿主时区逐字一致。
- strict_contract_regression: 模型省略派生时间字段可由 AST 安全补齐；缺少其他关键字段、未知字段、重复 ID、悬空引用和来源外 evidence 仍由 RCO-1 共享契约显式失败。
- legacy_compatibility: `ParsedSuggestion.timePoint` 为可选字段；旧草稿无需破坏性迁移，进入新 Pipeline 时从 evidence 重算；不重写既有已确认 Workspace/Task/TimePoint。

### 工程门与完整性

- `npm run recognition:contract:check`: PASS；Schema 源 SHA-256 仍为 `81f636bcf62a4e35221ba7e620a0410b3cc39bbf7481882e42ab1222839eab40`，时间源为上述新 SHA。
- `npm run lint`、`npm run typecheck`、`npm run build`: PASS；保留既有 >500 kB chunk warning，不冒充性能验收。
- `npm test`: PASS；Vitest 277、server 8、Cloudflare Worker 25、跨主机 time AST 1、multimodal evaluator 23、Firebase Functions 5，共 339 tests。
- `npm run security:scan`: PASS；扫描 249 个 source/build files。
- `npm audit --audit-level=high`: PASS；0 vulnerabilities。
- `npm run cloudflare:check`: PASS；Worker tests 与 default/preview/multimodal_preview 三套 Wrangler dry-run 通过；没有执行部署。
- protected_inputs: RCO-0 固定的 V2/V3 dataset、OCR、checkpoint、summary、freeze 共 10 个 SHA-256 在启动与完成时逐路径一致；Expected 随 dataset 受保护；`.evaluation-cache` 无 diff、未修改。

### 决策

- decision: `RCO-G2 PASS / NO_PROMOTION / DO_NOT_LAUNCH`。
- pass_scope: 只证明唯一中文时间 AST、四端映射、跨主机确定性、旧草稿兼容和匿名/Mock 对抗回归成立。
- claims_not_supported: 模型正确率提升、TimePoint F1 提升、真实材料泛化、多模态胜出、真人修改时间、浏览器 RCO-A…J、Preview/Production 可上线。
- rc4 / release / production / stable_model: `UNCHANGED`。
- next_step: `NONE；RCO-3 尚未授权，停在 RCO-G2 等待当前用户明确指令`。

## 15. RCO-3-001 启动记录 — 2026-09-02

### Context Snapshot

- owner / authorization_source: 当前用户于 2026-09-02 明确指令：`执行R3与R4`；解释为依赖顺序下分别授权 RCO-3 与 RCO-4，不授权混合提交或跳门。
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `ab9070ac2c9c3616287c969a1c7cd461fbae51ce` / 同一 commit。
- working_tree_before_start: `clean`；无重叠用户改动。
- preview_endpoint: `https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev/`；仅根路径只读 HEAD 检查 HTTP 200；未访问 Secret、未发模型请求、未修改部署。
- current_gate / last_passed_gate: `RCO-G3 IN_PROGRESS` / `RCO-G2 PASS`。
- hypothesis: 如果在浏览器内按格式保留编码、结构、页序、页状态和全量 span/chunk 覆盖，并把不完整与失败显式化，下游收到的事实来源将不再因乱码、混合 PDF 漏页或静默头部截断而确定性丢失。
- single_variable: 本机 TXT/Markdown/DOCX/PDF 提取契约、页/span/chunk 结构、错误与质量旗标及匿名组件测试；图片 OCR 的介质预处理与候选选择留给 RCO-4。
- allowed_actions: 实现 UTF-8/BOM/GB18030 检测；保留 Markdown 结构；安全解析 DOCX OOXML 段落/标题/编号/表格；PDF 逐页 parser/ocr/empty/error 路由；长内容有序切块、哈希、有限重叠与去重；更新 UI 支持格式与质量提示；新增匿名夹具/测试/阶段报告；验证、单独提交并推送。
- forbidden_actions: 修改 Expected、freeze、dataset、checkpoint、`.evaluation-cache`；调用模型或 Repair、接触 Secret；真实材料/真人研究；部署 Preview/Production；修改 RC.4/Release/稳定模型；进入 RCO-5。
- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- protected_inputs_sha256: V2 dataset `464d4cd14f46f79fc908ef480a39def8b9e92463455b5131a9376855e6e9347c`，OCR `365df840c775c1914bc5439457dbbaa605f26d41d6e1342acbcd65887ee94399`，checkpoint `a451d7ce9a206ba78d4b13dab5b408c17c62e636641fcb6e4664360ecf44bc39`，summary `2c77964ea13cea47ade40aa1d63f788898bbd187f211fc0cac39075961779ec2`，freeze `a4790b96d4a8a68ba39dc6d8cd38cfa424545efdd092c947dcef416bc7b3361f`；V3 dataset `2f0e3455d7eedfb2554119ee8aa88b54da799e7d2a1f5c1434997ff4be76e5de`，OCR `814150a98507f984d30e46ace8b6a41f503812bb358257de26f65d7814fbcb63`，checkpoint `d24e3fa8893f00a74221b1dc2b333f5289405bb243c9fd526b194180ee80ddd5`，summary `154ff19a0149a9a3036826c70992019c7c826fcc8f1ed0df854b945413eb60c2`，freeze `5b60e3dcc35b9417b40473876cc54f82734a69be7882f7e13248b0f6887a4e19`；启动时逐路径复核一致。
- stop_conditions: 宏/外链/远程资源可能执行；页序不稳定；重复合并；必须静默丢弃尾部或解除资源上限；必须上传文件本体；触碰受保护输入或任何未授权外部动作。
- decision_before_change: `AUTHORIZED_RCO_3 / RCO-G3_IN_PROGRESS / DO_NOT_LAUNCH / 0_MODEL_CALLS`；RCO-4 仅排队，不在本阶段实现。

## 16. RCO-3-001 完成记录 — 2026-09-02

### 实现与证据

- text: 从原始字节区分 UTF-8、UTF-8 BOM、GB18030；不可可靠解码或乱码特征 fail-closed；Markdown 标题、列表、表格、引用、代码围栏逐字保留。
- docx: 新增 MIT 许可轻量依赖 `fflate@0.8.3`，只在浏览器内解压 OOXML；保留标题、编号、段落与表格顺序；中央目录在解压前限制 500 条目/8 MiB，并拒绝加密、Zip64、宏、嵌入对象、外部关系与缺失主文档。
- pdf: 每页独立 `parser/ocr/empty/error`；无文本层页才 OCR；混合 PDF 同时保留页码、路由和 partial/quality flags；超过 80 页或 6 个 OCR 页的未处理范围明确可见。
- long_content: 完整正文形成 span、4,000 字 chunk、200 字有限重叠、字符范围与 SHA-256；500,000 字以上整体 fail-closed，禁止静默只保留头部；`createIntakeResult` 不再二次截断用户已核对正文。
- ui: 支持选择 DOCX；混合 PDF 显示“文本层 + 本机 OCR”，仍遵守逐次授权与最多选 1–4 页的图片边界。
- artifact: `docs/recognition-optimization/RCO-3_LOCAL_FILE_EXTRACTION.md`。

### 0 调用与工程门

- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- anonymous_component_fixtures: 真实 `File` 字节级 UTF-8 BOM、GB18030、坏编码、结构化 Markdown、ZIP/OOXML DOCX、外部关系 DOCX、长文本、文本/混合/扫描 PDF 和陈旧异步任务；无真实学生材料。
- `npm run recognition:contract:check`、`npm run lint`、`npm run typecheck`、`npm run build`: PASS；保留既有 >500 kB chunk warning。
- `npm test`: PASS；Vitest 283、server 8、Cloudflare Worker 25、time parity 1、multimodal evaluator 23、Firebase Functions 5，共 345 tests。
- `npm run security:scan`: PASS；250 files；`npm audit --audit-level=high`: 0 vulnerabilities。
- `npm run cloudflare:check`: PASS；default/preview/multimodal_preview 三环境 dry-run；没有部署。
- protected_inputs: V2/V3 dataset、OCR、checkpoint、summary、freeze 共 10 个启动 SHA 在完成时逐路径一致；Expected 随 dataset 受保护；`.evaluation-cache` 无 Git 变更。

### 决策

- decision: `RCO-G3 PASS / ZERO MODEL CALLS / NO_PROMOTION / DO_NOT_LAUNCH`。
- pass_scope: 只证明匿名字节级组件夹具覆盖的多格式本机提取、顺序、页路由、资源上限与显式失败契约成立。
- claims_not_supported: OCR CER/日期数字/下游 Task-TimePoint 改善、模型正确率、真实材料泛化、真人修改时间、浏览器 RCO-A…J、Preview/Production 上线。
- rc4 / release / production / stable_model: `UNCHANGED`。
- next_step: `独立提交并推送 RCO-3 后，按同一用户指令另记并启动 RCO-4；不得混合提交`。

## 17. RCO-4-001 启动记录 — 2026-09-02

### Context Snapshot

- owner / authorization_source: 当前用户于 2026-09-02 明确指令：`执行R3与R4`；RCO-3 已以 commit `1feb43184ae41d6a1e997ca8316d3f8835a028c7` 独立验证、提交、推送后关闭，现单独启动 RCO-4。
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `1feb43184ae41d6a1e997ca8316d3f8835a028c7` / 同一 commit。
- working_tree_before_start: `clean`；无重叠用户改动。
- current_gate / last_passed_gate: `RCO-G4 IN_PROGRESS` / `RCO-G3 PASS`。
- hypothesis: 按截图、照片和扫描页区分方向、裁边、透视/几何风险、对比度、噪声和放大策略，并把低质量结果路由到重拍/选页/人工校对，可同时降低字符错误、关键日期数字错误和下游任务/时间损失；只提高 OCR 自报 confidence 不足以通过。
- single_variable: 浏览器本机媒体预处理、可观测质量特征、介质路由、用户提示及匿名组件验证；不改 Prompt、云端模型、Schema、时间 AST、任务事实策略或部署。
- data: 新增匿名组件验证夹具；首次用于候选选择即永久标记 `SEEN_DIAGNOSTIC / NOT_RCO_G7_HOLDOUT`，不得称未见商业材料。
- allowed_actions: 本机 Canvas 方向/裁边/灰度对比度/降噪/2–3 倍缩放与保守几何提示；按介质选择 PSM/预处理；CER、日期数字 exact、确定性下游 Task/TimePoint、延迟和内存代理测量；失败/低质提示；匿名夹具/脚本/报告；验证、单独提交并推送。
- forbidden_actions: 修改 Expected、freeze、dataset、checkpoint、`.evaluation-cache`；云端模型/Repair 调用、Secret；真实材料/真人研究；Preview/Production 部署；RC.4/Release/稳定模型修改；RCO-5+。
- cloud_model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`；本机 Tesseract 组件运行不属于云端模型调用，但必须单独记录样本、耗时与失败。
- protected_inputs_sha256: 沿用 RCO-3 完成复核的 V2/V3 十个固定 SHA；开始前 `.evaluation-cache` 无 Git 变更。
- performance_budget: 单图 p95 `≤15s`；选定 1–4 页 p95 `≤45s`；只评本机组件，不外发图片。
- stop_conditions: 只改善 confidence；CER/日期/下游未同时净改善；严重错误增加；预处理抹掉关键字符；性能超预算；必须上传图片或放宽安全上限；触碰任何未授权动作。
- decision_before_change: `AUTHORIZED_RCO_4 / RCO-G4_IN_PROGRESS / DO_NOT_LAUNCH / 0_CLOUD_MODEL_CALLS`。

## 18. RCO-4-001 完成记录 — 2026-09-02

### 实现、消融与路由

- implementation: 新增 `ocrPreprocessing.ts` 的像素质量分析、EXIF 方向归一化、保守裁边、灰度/对比度、2–3 倍受限放大、介质 Profile、16M 输出像素上限和 `accept/review/retake`；`fileExtraction.ts` 在图片与 PDF OCR 前调用，低质原因进入可见 quality flags。
- media_route: 截图使用最近邻保守增强；照片使用平滑增强且不自动裁边；可读扫描件保持原图与 AUTO PSM。透视风险只提示重拍/校对，不自动拉伸。
- rejected_candidates: 自动中值降噪首轮使 CER 从 `0%` 恶化至 `19.05%`；扫描件强制 single-block 破坏晚间时间；全介质统一增强增加照片/扫描错字；均已从最终路由剔除。
- confidence_rule: 自报 OCR confidence 只能增加 review 信号，不能覆盖像素质量；高 confidence + 低分辨率/低对比度的对抗测试必须进入 retake。
- dev_dependency: `@napi-rs/canvas@1.0.8`（MIT）仅生成可复现匿名图片；生产仍为原生 Canvas。

### 冻结组件验证

- freeze: `docs/recognition-optimization/RCO-4_COMPONENT_FREEZE.json`；fixture、live test、preprocessor、evaluator 四个 SHA 在最终运行前全部匹配。
- data_status: `SEEN_DIAGNOSTIC / NOT_RCO_G7_HOLDOUT`；截图/照片/扫描件各 1 个匿名固定样本，无真实材料。
- live_command: PowerShell 设置 `RUN_LIVE_OCR_COMPONENT=1` 后运行 `npx vitest run src/lib/ocrLiveComponent.test.ts --reporter=verbose`；PASS。
- baseline_to_candidate: CER `15.48% → 5.95%`；关键日期数字 exact `66.67% → 100%`；任务动作/对象 token exact `33.33% → 66.67%`；确定性 TimePoint exact `33.33% → 66.67%`。
- runtime: 30 次候选 OCR，Type-7 单图 p95 `73.24 ms`；3 选页逐介质 p95 保守相加上界 `180.11 ms`；Node 组件增量 RSS `40.26 MiB`；只证明当前匿名组件代理低于 `15s / 45s / 512MiB`，不是浏览器/手机验收。
- residual_errors: 截图仍有“荣学金/成结单”，照片仍有“这写/正件聊”；每介质 n=1，不能声称商业正确率或分格式阈值达标。
- artifact: `docs/recognition-optimization/RCO-4_OCR_QUALITY_ROUTING.md`。

### 工程门与完整性

- cloud_model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`；本机 Tesseract 实跑单列，不计云端模型调用。
- regular_test_policy: live OCR 默认 skip，必须显式环境变量运行，避免 CI 隐式联网或把可变组件运行伪装成固定单测。
- `npm run recognition:contract:check`、`npm run lint`、`npm run typecheck`、`npm run build`: PASS；保留既有 >500 kB 主 chunk warning。
- `npm test`: PASS；Vitest 289 passed / 1 live OCR skipped、server 8、Cloudflare Worker 25、time parity 1、multimodal evaluator 23、Firebase Functions 5，共 351 个常规测试通过；live OCR 另行显式 1 test PASS。
- `npm run security:scan`: PASS；258 files；`npm audit --audit-level=high`: 0 vulnerabilities。
- `npm run cloudflare:check`: PASS；default/preview/multimodal_preview 三环境 dry-run；没有部署。
- protected_inputs: V2/V3 dataset、OCR、checkpoint、summary、freeze 十个固定 SHA 在完成门禁后逐路径一致；Expected 与 `.evaluation-cache` 无 Git 变更。

### 决策

- decision: `RCO-G4 PASS_COMPONENT / SEEN_DIAGNOSTIC / NO_PROMOTION / DO_NOT_LAUNCH`。
- pass_scope: 只证明冻结匿名组件上的字符/日期/下游代理同时净改善、伤害候选被淘汰、质量提示和组件性能代理通过。
- claims_not_supported: 分格式商业 CER、模型正确率、真实材料泛化、真人修改时间、Chrome/Edge/手机、RCO-A…J、Commercial Preview 或 Production。
- rc4 / release / production / stable_model: `UNCHANGED`。
- next_step: `NONE；RCO-5 尚未授权，停在 RCO-G4 等待当前用户明确指令`。

## 19. RCO-5-001 启动记录 — 2026-09-02

### Context Snapshot

- owner / authorization_source: 当前用户于 2026-09-02 明确指令：`执行R5与R6`；解释为按依赖顺序授权 RCO-5 与 RCO-6 的阶段实施，不自动授权 Secret、模型调用、新数据、真实材料、真人研究或部署，也不允许在 RCO-G5 未通过时越门。
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `ea7d9841a46be65007662c22ad162fa944f13de3` / 同一 commit。
- working_tree_before_start: `clean`；无重叠用户改动。
- current_gate / last_passed_gate: `RCO-G5 IN_PROGRESS` / `RCO-G4 PASS_COMPONENT`。
- hypothesis: 把模型责任收敛为 requiresAction、动作、对象、raw time、材料、事件、约束和逐字证据，并由确定性代码创建 ID、时间派生、引用和默认值，可以减少事实抽取与大 Schema 构造之间的竞争；但是否提升 Recall 必须由同输入模型配对证明。
- single_variable: `facts-1.0` 候选账本、task composer、跨字段 validator、匿名负例和 0 调用技术消融；不修改稳定 Prompt/模型、Worker 路由、Expected、历史数据或部署。
- allowed_actions: 新增候选 fact schema、Prompt 常量、task composer、validator、匿名 Mock/对抗测试、阶段报告、日志/短上下文；验证、单独提交并推送。
- forbidden_actions: B1/B4 模型调用、Secret、Repair、真实材料、真人研究、Preview/Production；修改 Expected/freeze/dataset/checkpoint/cache、RC.4/Release/稳定模型；RCO-G5 未通过前启动 RCO-6。
- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- protected_inputs_sha256: RCO-0 固定的 V2/V3 dataset、OCR、checkpoint、summary、freeze 十个 SHA 在启动时逐路径一致；Expected 随 dataset 受保护，`.evaluation-cache` 无 Git 变更。
- stop_conditions: 需要把手工事实夹具冒充模型质量；需要放宽 Evidence/Forbidden/完整 Schema；触碰保护输入或任何未授权外部动作；RCO-G5 证据不足却进入 RCO-6。
- decision_before_change: `AUTHORIZED_RCO_5 / RCO-G5_IN_PROGRESS / DO_NOT_LAUNCH / 0_MODEL_CALLS`；RCO-6 仅排队并受 G5 依赖门约束。

## 20. RCO-5-001 完成记录与 RCO-6 阻断 — 2026-09-02

### 实现与单变量边界

- implementation: 新增隔离的 `facts-1.0` 严格账本、`recognition-facts-first-1.0.0` 未调用候选 Prompt、确定性 task composer 与共享 `RecognitionResult 2.0` 末端复验；没有接入稳定 Worker、浏览器默认路径或已部署环境。
- safety: 未知/缺失/超限字段、悬空关系、来源外文字证据、`requiresAction` 矛盾、敏感对象/提示注入和无关文字为视觉动作洗白均 fail-closed；视觉 observation 可表达但在 RCO-6 provenance 契约前禁止 compose。
- technical_ablation: 14 个 RCO-5 定向测试通过；其中八类负例只证明手工构造的内部矛盾会被拒绝，不证明模型会正确判断 `requiresAction`，也不构成 Recall/Precision 证据。
- freeze: `docs/recognition-optimization/RCO-5_COMPONENT_FREEZE.json` 固定 facts 实现、测试、共享 Schema 与时间 AST 哈希；不把报告、日志或上下文写入组件冻结，避免循环哈希。

### 新鲜对抗审查

- reviewer: 独立新鲜同模型家族审查；证据见 `docs/recognition-optimization/RCO-5_EXPERIMENT_AUDIT.md`、`.json` 与 `.aris/traces/experiment-audit/2026-09-02_run01/`。
- findings_fixed_before_final: 补齐资源上限、关联 distinct 上限、最终共享 Schema 复验、敏感对象独立检测、真实视觉边界、视觉独有事件和“无关文字洗白”对抗用例；纠正八类负例的过度解释。
- final_audit: `Overall WARN / CONTRACT_EVIDENCE_REPRODUCED_WITH_AUTHORITY_CHAIN_WARNINGS / same-family / provisional`。A ground truth、B normalization、E scope、F classification 与阶段顺序通过；C/D 因尚未提交、候选隔离且未接产品路径而保留 WARN。该 WARN 不否定技术契约，但禁止质量晋级。
- trace_boundary: 保存的是可取得的最终审查结论、哈希与限制说明；不存在可导出的内部推理轨迹，不得将该目录描述为完整思维链。

### 工程门、完整性与决策

- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- full_gate: `recognition:contract:check`、lint、typecheck、build PASS；`npm test` 为 Vitest 303 passed / 1 live OCR skipped，加 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5，共 365 个常规测试通过。
- security_and_packaging: 最终 security scan PASS（267 files）；`npm audit --audit-level=high` 为 0 vulnerabilities；Cloudflare default/preview/multimodal_preview 三环境 dry-run PASS，未部署；保留既有 >500 kB chunk warning。
- protected_inputs: RCO-0 V2/V3 dataset、OCR、checkpoint、summary、freeze 十个固定 SHA 在完成后逐路径一致；Expected 随 dataset 受保护；`.evaluation-cache` 无 Git diff、未修改。
- decision: `RCO-5 TECHNICAL PASS / RCO-G5 QUALITY NOT_RUN / NO_PROMOTION / DO_NOT_LAUNCH`。
- claims_not_supported: facts-first 模型 Recall/Precision 提升、图片或文件正确率、完整案例率、真人修改时间、真实材料泛化、浏览器验收、Preview/Production 上线。
- RCO-6: `BLOCKED_BY_RCO_G5 / NOT_STARTED`。虽然用户已提出执行 R6，但固定顺序要求先用冻结同输入完成 B1/B4 质量配对；本轮没有具体模型、Development 数据、调用次数和金额上限授权，禁止把技术 PASS 冒充 RCO-G5 PASS 后越门。
- rc4 / release / production / stable_model: `UNCHANGED`。
- next_step: 当前用户若要继续，需另行明确批准 B1/B4 的具体模型、匿名 Development 数据、两臂调用次数与金额上限；只有 RCO-G5 质量门通过后，既有 RCO-6 阶段请求才能恢复执行。

## 21. RCO-5-002 修补轮启动记录 — 2026-09-02

### Context Snapshot

- owner / authorization_source: 当前用户于 2026-09-02 明确要求先执行一次“RCO-5 修补轮”，列明字段—证据支持、`requiresAction=false + explicit event`、必填 `sourceId`、受控动作归一化、审计/上下文订正、全量验证与新鲜审查；明确保持 0 次模型调用。
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `a016d51e5f4ad244efbbc5942810572a890975ab` / 同一 commit。
- working_tree_before_start: `clean`；无重叠用户改动。
- current_gate / last_passed_gate: `RCO-G5 CONTRACT_REPAIR_IN_PROGRESS` / `RCO-G4 PASS_COMPONENT`；RCO-5-001 仅为技术候选，质量门仍 `NOT_RUN`。
- hypothesis: 若对时间、材料、约束和事件地点执行字段级逐字证据绑定，并消除 `requiresAction`/event、来源 ID 与动作别名的确定性歧义，就能在花费模型预算前关闭已知的证据洗白和跨来源冲突路径。
- single_variable: `facts-1.1` 的确定性契约加固与匿名回归；不接入稳定 Worker/浏览器产品路径，不改变模型、数据或部署。
- allowed_actions: 修改 `facts.ts`/定向测试、候选 Prompt 版本、组件冻结、阶段报告、Corrections、短上下文与审计记录；运行本机/Mock/全量工程门；独立提交并推送。
- forbidden_actions: B1/B4 或任何模型/Repair 调用、Secret、真实材料、真人研究、Preview/Production；修改 Expected/freeze/dataset/checkpoint/`.evaluation-cache`、RC.4/Release/稳定模型；启动 RCO-6。
- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- protected_inputs_sha256: RCO-0 的 V2/V3 dataset、OCR、checkpoint、summary、freeze 共十个 SHA 在启动时逐路径一致；`.evaluation-cache` 无 Git 变更。
- stop_conditions: 需要语义猜测代替逐字证据、放宽安全/Schema、修改受保护输入、调用模型、接触 Secret、影响稳定路径或越过 RCO-G5。
- decision_before_change: `AUTHORIZED_RCO_5_REPAIR / ZERO_MODEL_CALLS / RCO-G5_QUALITY_NOT_RUN / RCO-6_BLOCKED / DO_NOT_LAUNCH`。

## 22. RCO-5-002 首次新鲜审查拒绝记录 — 2026-09-02

- candidate: `facts-1.1 / recognition-facts-first-1.1.0`；组件哈希保留于 `RCO-5_REPAIR_COMPONENT_FREEZE.json`，状态改为 `REJECT_CANDIDATE`，不覆盖或冒充最终候选。
- reviewer: `/root/rco5_repair_integrity_audit`；fresh same-family / ultra / read-only / provisional；轨迹 `.aris/traces/experiment-audit/2026-09-02_run03/`。
- verdict: `FAIL / CONTRACT_PROVENANCE_LAUNDERING_REPRODUCED`。
- reproduced_failures: 材料属性跨材料串借；无关时间绑定动作；无关约束绑定动作；地点跨事件串借；optional/strong 动作对象无文字支持；运行时缺失 `sourceContent` 时来源外证据可绕过。
- interpretation: 首轮 34 个测试与全量工程绿灯只覆盖已写断言，不能证明契约完整；审查发现的是可复现的真实契约缺口，不是模型质量结果。
- disposition: 在同一已授权零调用修补范围内创建新版本 `facts-1.2`，要求字段和关系两端在同一条连续 text/OCR 证据中绑定；所有动作层级必须有对象依据；composer 在账本校验前要求 `sourceContent`。
- gate: `RCO-5-002 REJECT_CANDIDATE / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`；模型调用、Secret、真实数据、部署仍为 0/NONE/NOT_USED/NOT_RUN。

## 23. RCO-5-002 第二次新鲜审查拒绝记录 — 2026-09-02

- candidate: 冻结 `facts-1.2 / recognition-facts-first-1.2.0`；四个组件 SHA 见 `RCO-5_REPAIR_V2_COMPONENT_FREEZE.json`，状态 `REJECT_CANDIDATE`，不由后续版本覆盖。
- reviewer: `/root/rco5_facts12_fresh_audit`；fresh same-family / ultra / read-only / provisional；轨迹 `.aris/traces/experiment-audit/2026-09-02_run04/`。
- verdict: `FAIL / CONTRACT_RELATION_AND_GROUNDING_BYPASSES_REPRODUCED`。
- reproduced_failures: 把多句无关原文合并为一条合法 quote 后，时间、材料、constraint 和 event location 仍可跨句串借；另复现联系人名词子串、否定动作、description 洗白、数量 2 从 12 截取、event 时间角色不兼容、optional action 的依赖材料被勾选，以及缺 referenceTime/timezone 的运行时绕过。
- positive_controls: facts-1.1 的六个精确反例已拒绝，sourceId、`requiresAction=false + explicit event`、vision composition 阻断继续成立；但类别未封闭，故不能 PASS。
- disposition: 在同一已授权零调用修补范围内升为 `facts-1.3`；语义绑定单位收紧为句/分句，新增否定与联系人保护、description 依据/安全、数量边界、event 时间类型、optional 依赖选中传播及完整 runtime options 校验。
- gate: `RCO-5-002 REJECT_CANDIDATE / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`；审查者未访问保护输入，保护输入由主任务另行逐 SHA 复核。

## 24. RCO-5-002 第三次新鲜审查拒绝记录 — 2026-09-02

- candidate: 冻结 `facts-1.3 / recognition-facts-first-1.3.0`；四个组件 SHA 见 `RCO-5_REPAIR_V3_COMPONENT_FREEZE.json`，状态 `REJECT_CANDIDATE`。
- reviewer: `/root/rco5_facts13_final_audit`；fresh same-family / ultra / read-only / provisional；轨迹 `.aris/traces/experiment-audit/2026-09-02_run05/`。
- verdict: `FAIL / FAIL_CROSS_ENTITY_SEMANTIC_GROUNDING_BYPASSES_REPRODUCED`。
- reproduced_failures: 远距离取消绕过；结果公示日误作提交截止；同分句相邻材料串格式；同分句相邻事件串地点；阅读说明误把材料标必需；从另一材料借 optional 状态。
- interpretation: 句/分句边界只能封闭跨句池化，不能把词面共现升级为语义关系；字段归属必须使用受控关系谓词并保持不确定时 fail-closed。
- disposition: 升为 `facts-1.4`，为 deadline、材料动作/格式/命名/数量/渠道/必填性、constraint 和 event location 使用受控关系句式；否定/取消覆盖整个分句；六个反例全部进入回归。
- gate: `RCO-5-002 REJECT_CANDIDATE / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`。

## 25. RCO-5-002 最终失败封存与授权关闭 — 2026-09-02

### 最终候选与新鲜审查

- candidate: `facts-1.4 / recognition-facts-first-1.4.0`；四个组件 SHA 见 `RCO-5_REPAIR_V4_COMPONENT_FREEZE.json`，状态固定为 `REJECT_CANDIDATE`，不得接入稳定 Worker、浏览器默认路径或发布候选。
- reviewer: `/root/rco5_facts14_final_audit`；fresh same-family / ultra / read-only / provisional；轨迹 `.aris/traces/experiment-audit/2026-09-02_run06/`。
- verdict: `FAIL / FAIL_CONTROLLED_RELATION_GROUNDING_BYPASSES_REPRODUCED`。
- reproduced_failures: 并列动作的对象错配、远距离取消、把名词性状态误当动作、跨句 description 洗白、截止 rawText 扩张、相邻材料的格式/渠道/optional 串借、材料和事件名称子串、相邻事件时间串借，以及 constraint 跨实体绑定；另有“无需打印但须提交”被过度拒绝。
- first_principles_conclusion: evidence quote 的逐字存在、同句共现和受控正则只能证明词面出现，不能证明字段归属同一动作、材料或事件。继续堆正则会在漏接与错接之间摆动，无法把测试外语义归属封闭为商业级安全契约。

### 工程门、完整性与决策

- targeted_contract: facts-1.4 的 54 个已注册用例通过；这只证明已注册断言，不推翻 fresh audit 在测试外复现的 P1 缺口。
- full_gate: `recognition:contract:check`、lint、typecheck、build PASS；`npm test` 为 Vitest 343 passed / 1 live OCR skipped，加 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5，共 405 个常规测试通过。
- security_and_packaging: 最终 security scan PASS（286 files）；`npm audit --audit-level=high` 为 0 vulnerabilities；Cloudflare default/preview/multimodal_preview 三环境 dry-run PASS，未部署；保留既有 >500 kB chunk warning。
- protected_inputs: RCO-0 V2/V3 dataset、OCR、checkpoint、summary、freeze 十个固定 SHA 在最终完成时逐路径一致；Expected 随 dataset 受保护；`.evaluation-cache` 和 `docs/e2-multimodal-experiment` 无 Git diff。
- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- decision: `RCO-5-002 TECHNICAL REPAIR FAIL / REJECT_CANDIDATE / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`。
- claims_not_supported: facts-first 质量改善、图片或文件识别正确率、真实材料泛化、完整案例率、真人修改时间、浏览器验收、Commercial Preview 或 Production 上线。
- authorization_closed: 本轮授权随失败封存和本次交付关闭；不得在当前授权下继续补正则、启动 B1、使用 Secret、接触真实材料、运行真人研究、启动 RCO-6 或部署。
- next_step: `NONE`。若用户另行授权，应先设计 parser-verified spans、typed relation assertions 与不确定事实保持 unlinked/unselected 的新契约，再做新的 0 调用审查；只有该基础门通过后，才讨论预注册 B1 的具体模型、同批匿名 Development 输入、12×2=24 次调用和人民币金额上限。

## 26. RCO-5-003 启动记录 — 2026-09-03

### Context Snapshot

- owner / authorization_source: 当前用户于 2026-09-03 原文授权：`授权执行 RCO-5-003：建立原文精确位置和信息归属关系的新契约，仅做 0 次模型调用的实现与对抗测试；不修改 Expected、freeze、dataset、checkpoint、cache，不接入稳定路径，不部署。`
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `83685d40b42be0d10b2e6f43df2a32466395b23f` / 同一 commit。
- working_tree_before_start: `clean`；无重叠用户改动。
- current_gate / last_passed_gate: `RCO-G5 PROVENANCE_RELATION_CONTRACT_IN_PROGRESS` / `RCO-G4 PASS_COMPONENT`；RCO-G5 模型质量仍 `NOT_RUN`。
- hypothesis: 只有把每个事实字段绑定到本机解析器可复算的字符 span，并把 action-time、action-material、action-constraint、event-time、event-location 变成带最小 relation span 的类型化断言，才能阻止“同段出现但归属错误”；无法确定的关系必须保持 unlinked、unselected、needsConfirmation。
- single_variable: 新建隔离的 `facts-1.5` provenance/relation 契约与确定性 composer；保留并拒绝 `facts-1.4`，不修改稳定 Worker、浏览器默认路径或旧冻结证据。
- allowed_actions: 新候选代码、匿名 contract/adversarial fixtures、新候选组件冻结、阶段报告、审计轨迹、日志和短上下文；本机全量验证、独立提交并推送。
- forbidden_actions: 任何模型/Repair 调用、Secret、真实材料、真人研究、Preview/Production；修改 Expected、既有 freeze、dataset、checkpoint、cache、RC.4、Release、稳定模型；接入稳定路径或启动 RCO-6。
- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- protected_inputs_sha256: RCO-0 V2/V3 dataset、OCR、checkpoint、summary、freeze 共十个 SHA 在启动时逐路径一致；Expected 随 dataset 受保护；`.evaluation-cache` 与 `docs/e2-multimodal-experiment` 无 Git diff。
- stop_conditions: relation span 仍可跨实体洗白；模糊关系被自动勾选；为通过测试修改保护输入或放宽安全/Schema；需要模型、Secret、真实材料、稳定路径或部署；工程门或新鲜审查失败。
- decision_before_change: `AUTHORIZED_RCO_5_003 / ZERO_MODEL_CALLS / RCO-G5_QUALITY_NOT_RUN / RCO-6_BLOCKED / DO_NOT_LAUNCH`。

## 27. RCO-5-003 三轮对抗与失败封存 — 2026-09-03

### 候选与新鲜审查

- `facts-1.5`: 定向 27/27；fresh same-family/provisional 审查 `FAIL`，复现遗漏取消/更正、未验证 required、错误时间角色、重复事件角色、约束错接和来源元数据洗入；轨迹 `2026-09-03_run07`。
- `facts-1.6`: 定向 38/38；fresh same-family/provisional 审查 `FAIL`，复现疑问/暂定作用域被裁掉、第三方完成态、范围数量、开始结束错配、非具体地点和独立动作进入 constraint；轨迹 `2026-09-03_run08`。
- `facts-1.7`: 定向 52/52；最终 fresh same-family/provisional 审查仍 `FAIL`。决定性未登记反例为“想确认一下，家庭经济困难认定表为必交？”：账本只取肯定词片段，validation 与 shared Schema 均通过，材料仍为 `required=true / selected=true`；轨迹 `2026-09-03_run09`。
- final_decision: `REJECT_CANDIDATE`。精确 offset 可证明词面位置，但最小端点 span 不能证明完整命题的疑问、否定、主体、时态和修订作用域；继续堆词表不是可封闭的商业级契约。

### 工程门、完整性与边界

- implementation: 新增隔离 `factsProvenance.ts`、52 个匿名 contract fixtures、三份候选冻结与审计/阶段报告；静态搜索未发现稳定 Worker、浏览器默认路径、服务端或部署入口引用。
- full_gate: Schema/time drift、lint、typecheck、build PASS；Vitest `395 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5 全部通过。
- security_and_packaging: security scan PASS（302 files）；`npm audit --audit-level=high` 为 0 vulnerabilities；Cloudflare default/preview/multimodal_preview 仅 dry-run PASS，未部署；保留既有 >500 kB chunk warning。
- protected_inputs: RCO-0 V2/V3 dataset、OCR、checkpoint、summary、freeze 当前 10/10 SHA 匹配，保护路径无 Git diff；只证明当前无净字节漂移，不声称 ignored cache 期间从未写入。Expected 未改。
- classification: `contract_fixture / simulation_only`；不是 `real_gt`、模型质量、真实材料或真人效率证据。
- model_calls / repair_calls / secret_access / real_data / human_study / browser_acceptance / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN / NOT_RUN`。
- gate: `RCO-5-003 CLOSED / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`；RC.4、Production 和稳定路径不变。
- claims_not_supported: 模型 Recall/Precision、图片或文件正确率、完整案例率、真人修改时间、真实材料泛化、浏览器验收或上线资格。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，应先另行授权带完整命题范围、语气/极性、主体、时态和修订关系的结构设计；不得在本轮自动调用模型、接入稳定路径或启动 RCO-6。

## 28. RCO-5-004 启动记录 — 2026-09-03

- owner / authorization_source: 当前用户于 2026-09-03 明确授权完整命题图、完整证据范围、主体、语气/极性、时态、状态、修订关系、独立验证与确定性选择策略；明确要求模型不得输出 `selected`，并限定 0 次模型调用、禁止修改既有 Expected/freeze/dataset/checkpoint/cache、禁止接入稳定路径和部署。
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `b71e27283c3583d97c7397df02c352f0b6593b5d` / 同一 commit；启动前工作树 clean。
- current_gate / last_passed_gate: `RCO-G5 COMPLETE_PROPOSITION_CONTRACT_IN_PROGRESS` / `RCO-G4 PASS_COMPONENT`；RCO-G5 模型质量仍 `NOT_RUN`，RCO-6 仍阻断。
- hypothesis: 抽取器只能提出不含选择权的完整命题；命题必须引用本机生成、保留标点的完整 scope，独立验证结果必须绑定整个文档和候选图，最终 `selected` 只能由确定性策略按主体、语气、极性、时态、状态、有效性、修订和已验证关系共同计算。
- single_variable: 新增隔离的 proposition graph 与 composer；不修改或接入既有 facts-1.7、Worker、浏览器、稳定模型、RC.4、Release 或 Production。
- allowed_actions: 新候选 Schema/composer、匿名 contract/property-mutation fixtures、新候选 freeze、审计轨迹、阶段报告、日志与短上下文；本机全量工程门和 dry-run；独立提交并推送。
- forbidden_actions: 任何业务模型/Repair 调用、Secret、真实材料、真人研究、Preview/Production 部署；修改既有 Expected、freeze、dataset、checkpoint、cache；接入稳定路径或启动 RCO-6。
- startup_evidence: 受保护输入当前 10/10 SHA 匹配且保护路径无 Git diff；Preview 首页 HTTP 200，状态仅为 `secret-present-unverified`，未发识别请求。
- model_calls / repair_calls / secret_access / real_data / human_study / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- stop_conditions: 抽取候选可携带 `selected`；scope 可裁掉标点/语气；验证结果未绑定全原文/候选图；验证缺失仍能自动勾选；确定性策略可被单一语义字段绕过；需要修改保护输入、接触 Secret、调用模型、接入稳定路径或部署。

## 29. RCO-5-004 五轮对抗与失败封存 — 2026-09-03

### 候选与新鲜审查

- V1: 定向 49/49；fresh same-family/provisional 审查 `FAIL`，复现“上传 API Key”被勾选，以及等价重复旧命题绕过单一取消关系；轨迹 `2026-09-03_run10`。
- V2: 定向 56/56；审查 `FAIL`，复现零宽字符绕过，以及敏感材料经 task-material 关系搭便车；轨迹 `2026-09-03_run11`。
- V3: 定向 59/59；审查 `FAIL`，复现“Access Token 文件”利用敏感词遗漏和通用“文件”对象放行；轨迹 `2026-09-03_run12`。
- V4: 定向 62/62；审查 `FAIL`，复现“填写并提交”“完成递交/上传/发送”“办理交付”等把外传行为藏在 object 中、绕过 verb-only 门；轨迹 `2026-09-03_run13`。
- V5: 定向 69/69；最终审查仍 `FAIL`。决定性未登记反例“请完成报名材料邮寄。”被编码为 `verb=完成 / object=报名材料邮寄 / effect=local_change`，候选校验通过且 composer 生成 `selected=true`；轨迹 `2026-09-03_run14`。
- final_decision: `REJECT_CANDIDATE`。`action.effect` 是正确抽象，但当前 effect 仍由有限本地词表推断；词表有“寄送”而无“邮寄”即被绕过，证明开放式自然语言不能靠补同义词封闭。

### 工程门、完整性与边界

- implementation: 新增隔离 `propositionGraph.ts`、严格无 `selected` 候选 Schema、全原文/全图 fingerprint 绑定、完整命题 scope、语义状态、类型化关系、独立验证边界和确定性 composer；稳定 Worker、浏览器默认路径、服务端及部署入口无 import。
- verifier_boundary: `contract_fixture_oracle` 仅用于显式本机匿名测试；`independent_semantic_verifier` 当前为 `NOT_CONNECTED` 并被拒绝；FNV-1a 只防无意漂移，不是密码学身份或抗篡改证明。
- full_gate: Schema/time drift、lint、typecheck、build PASS；Vitest `464 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5 全部通过。
- security_and_packaging: security scan PASS（327 files）；`npm audit --audit-level=high` 为 0 vulnerabilities；Cloudflare default/preview/multimodal_preview 仅 dry-run PASS，未部署；保留既有 >500 kB chunk warning。
- protected_inputs: RCO-0 V2/V3 dataset、OCR、checkpoint、summary、freeze 当前 10/10 SHA-256 匹配；Expected 随 dataset 受保护；`.evaluation-cache` 与 `docs/e2-multimodal-experiment` 无 Git diff。
- classification: `contract_fixture / simulation_only`；五轮审查任务为同系列模型的独立只读复核，结论为 provisional，不是产品模型调用或真实材料质量证据。
- model_calls / repair_calls / secret_access / real_data / human_study / browser_acceptance / deploy: `0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN / NOT_RUN`。
- gate: `RCO-5-004 CLOSED / RCO-G5 COMPLETE_PROPOSITION_CONTRACT_FAIL / QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`；RC.4、Production 和稳定路径不变。
- claims_not_supported: 模型 Recall/Precision、图片或文件正确率、完整案例率、真人修改时间、真实材料泛化、浏览器验收或上线资格。
- authorization_closed: 本轮授权随失败封存和本次交付关闭；不得继续补词表、运行 B1、使用 Secret、接触真实材料、启动 RCO-6 或部署。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，需当前用户另行授权可验证身份、绑定整份原文与完整候选图、缺失时失败关闭的独立语义/安全验证器，或等价的非词表确定性动作效果证明；基础门重新通过后才讨论付费 B1。

## 30. RCO-5-005-B0 启动与预调用冻结 — 2026-09-03

- owner / authorization_source: 当前用户于 2026-09-03 明确授权使用 `deepseek-v4-flash-vision-exp`，对 12 个新冻结匿名 Development 案例运行 facts-first、完整命题图抽取、独立语义复核各 12 次，共 36 次真实调用；固定 `temperature=0`、Repair 0、人民币上限 10 元；只新增实验数据、checkpoint 和报告，不修改既有 Expected/freeze/dataset/checkpoint/cache，不接稳定路径，不部署。
- branch / HEAD / upstream: `codex/e2-multimodal-recognition-exp` / `d0686c441cca6708c45b69e0c692f750f0315534` / 同一 commit；启动前工作树 clean。
- hypothesis: 开放式动作效果不能靠本地同义词白名单封闭；让模型先产出完整命题图，再由一次独立、绑定整份原文和候选图的语义复核筛除矛盾节点，最后由确定性策略计算默认勾选，可能同时提高关键事实召回并守住禁止默认操作边界。
- classification: `anonymous_synthetic_development`；12 个案例、12 个语义家族；不是真实材料、Holdout、真人修改时间或浏览器证据。
- frozen_inputs: dataset `RCO-5-005-B0_DEVELOPMENT_DATASET.json` SHA-256 `f80abd495c3075e59055a17e0298c5393556e52b6fb3ba797638c5be19c94a99`；runner SHA-256 `98b3a3406962210a39d4d81853954252db94be3872fd4bbefc60a10d89cfe5d3`；三份 system prompt SHA 见 `RCO-5-005-B0_FREEZE.json`。Expected 仅供本地计分，不进入模型请求。
- runner_contract: 每次调用前原子写入 `started`；已有条目不静默重试；无 Repair；三臂失败/无效 Schema 保留在分母；只在新目录 `docs/recognition-optimization/rco-5-005-b0-runs/<run-id>/` 生成 checkpoint、result 和报告。
- evaluator_preflight_repairs: 修正 freeze 费用字段层级；修正“无预期时间”被错误记为正确；复核判矛盾的节点不再进入复核臂 Task 指标；补 event/location、意外字段惩罚、关系端点/顺序/节点类型校验与零调用自测。上述修补发生在首次调用和最终 runner freeze 之前。
- metrics: Task Precision/Recall/F1、requiresAction、effect、time、material、event、location、Evidence、Complete Case、Major Correction、Forbidden、Missed Safe Default；不能只报单一 F1。
- preregistered_decision: 36/36 或三臂 12/12 Schema 不完整则 `INVALID_RUN`；复核臂有 Forbidden，或 Task Precision/Complete Case 低于 facts-first 则 `REJECT_CANDIDATE`；只有命题图 Recall 提升、复核 Recall 不低于 facts-first、Forbidden=0 且未触发拒绝，才是 `PROMISING_FOR_LARGER_DEVELOPMENT_B1_ONLY`；其他为 `INCONCLUSIVE`。
- cost_gate: 依据 2026-09-03 官方峰值价格，按 prompt bytes 当 input tokens、每次预留 2,000 output tokens、10 CNY/USD 保守口径，36 次最大理论费用 `3.545626 CNY`，低于 10 元硬上限；Provider 实际账单若不可观测必须写 `NOT_OBSERVABLE`。
- protected_inputs: RCO-0 V2/V3 dataset、OCR、checkpoint、summary、freeze 共 10 个固定 SHA 在预调用阶段逐路径 `10/10 PASS`；Expected 随 dataset 受保护；`.evaluation-cache` 与 `docs/e2-multimodal-experiment` 无 Git diff。
- preflight: runner syntax、自测、freeze 契约、12 案例/12 家族数据结构均 PASS；lint、Vitest `464 passed / 1 live OCR skipped`、server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5、build、security scan 331 files、npm audit 0 vulnerabilities 全部 PASS；`model_calls=0`，Secret 尚未读取；预调用提交待完成。保留既有 >500 kB chunk warning。
- current_decision: `AUTHORIZED / PRECALL_FROZEN / IN_PROGRESS / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`。

## 31. RCO-5-005-B0 运行完成、失效与审计封存 — 2026-09-03

- run_id / output: `rco-5-005-b0-20260903a`；只新增 `docs/recognition-optimization/rco-5-005-b0-runs/rco-5-005-b0-20260903a/` 下 checkpoint、result 与报告。
- calls: facts-first / proposition graph / semantic verifier 各 12，共 `36/36`；36 条均 HTTP 200、可解析 JSON、返回模型名 `deepseek-v4-flash-vision-exp`；temperature 请求值 0，thinking disabled；Repair 0、retry 0、原始输出 selected 0。
- usage / cost: input 25,535、output 8,954、total 34,489；Provider billed cost `NOT_OBSERVABLE`；按冻结峰值价与保守汇率精确复算 `0.2305468 CNY < 10 CNY`。
- frozen_integrity: dataset、runner 与三 prompt SHA 仍匹配调用前 freeze；result 的 checkpoint SHA `e144e7e68ecb02e9273eb50bbe0afcb3e74524b966a7931f2bf6ee8b7b56dcce` 与文件一致；没有修改既有 Expected/freeze/dataset/checkpoint/cache；保护输入 10/10 与两处保护路径无 diff。
- automatic_result: facts-first Schema `10/12`，graph `0/12`，verifier pipeline `0/12`；预注册决定 `INVALID_RUN`。facts 的 TP/FP/FN 为 10/0/2，但其 Task F1 90.91% 不得与无效后两臂比较或称产品正确率。
- primary_failure: graph 独立调用的提示词用“枚举与紧凑事实抽取一致”引用本次调用不可见的另一提示词；模型在 12/12 使用自然但非法的 actor/polarity/status/validity/modality/speechAct，并把 time/material/location 写入错误节点。verifier 又按候选复制非法枚举；facts 两例漏必填 `ignored`。
- orchestration_failure: verifier 只等待 graph 返回 JSON，没有等待 graph 通过 Schema；12 次复核均消耗在结构不合格候选上。其结果 Schema 又被实现成 `graphValid && verifierValid` 复合指标，不能直接解释为 verifier 自身 0/12，虽独立离线检查也发现自身 12/12 不合格。
- scorer_corrections: requiresAction 实际由 active task 推导而未评分模型顶层字段；无效空臂撞对负例产生 25% 假象；Missed Safe Default `3/9/9` 未进入 Complete/decision/自动报告；FP 附属字段惩罚与 Evidence 语义充分性不足。因此自动表中这些局部百分比只保留为原始诊断，不构成正确率。
- audit: fresh GPT-5.6-Sol ultra / same-family / read-only / provisional；overall `FAIL`，reason `INVALID_RUN_SCHEMA_CONTRACT_FAILURE_WITH_SCORER_AND_AUTHORITY_STATE_DEFECTS`；A GT provenance PASS、B score FAIL、C consistency FAIL、D reachability WARN、E scope PASS、F classification PASS；轨迹 `.aris/traces/experiment-audit/2026-09-03_run15/`。
- evidence: run 内 `REPORT.md`、`POST_RUN_DIAGNOSIS.md`、`EXPERIMENT_AUDIT.md/json`；classification=`simulation_only / manually labeled anonymous synthetic Development proxy`。
- supported_claims: 36 次返回、Schema 通过数、usage、保守费用、失效根因和 `INVALID_RUN`。
- unsupported_claims: graph/verifier 相对 facts 的质量或安全收益、真实材料泛化、图片/文件正确率、真人修改时间、浏览器验收、商业候选、RCO-6、发布或上线。
- final_decision: `RCO-5-005-B0 CLOSED / INVALID_RUN / INTEGRITY AUDIT FAIL / NO_PROMOTION / RCO-6 BLOCKED / DO_NOT_LAUNCH`；稳定路径、RC.4、Production 不变，未部署。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，应新开 B0.1，先做 0 次模型调用的 prompt/schema/scorer/checkpoint 修补与新鲜对抗审查；不得修改或重算本轮 protected artifacts，不得用同一 run-id 重试。

## 32. RCO-5-005-B0.1 零调用契约修补与对抗审查 — 2026-09-03

- owner / authorization_source: 当前用户明确要求完整内联枚举、使用严格 JSON Schema、graph 不合格就不调用复核器，并修正 scorer 与 checkpoint；要求修好并通过对抗测试后，再新冻结数据申请下一轮付费调用。
- branch / start_head / upstream: `codex/e2-multimodal-recognition-exp` / `ea5ce76ed542f19de78a2c7c231053c0146b4f63` / 同一 commit；启动前工作树 clean。
- scope: 只新增隔离的 B0.1 library、零调用验证入口、定向/新鲜对抗测试、候选 manifest 与文档；不修改 B0 或更早 Expected/freeze/dataset/checkpoint/result/cache，不接稳定路径，不部署。
- prompt/schema: 三个独立 prompt 各自完整携带 canonical 枚举；候选请求从 Chat `json_object` 改为 DeepSeek Responses API `text.format.type=json_schema`，所有对象 `additionalProperties:false`，命题图按节点 kind 使用 `oneOf`。官方文档能力只作为候选构造依据，本轮未做真实在线请求。
- orchestration: graph 必须先通过本地 Schema 和 producer run 绑定才可构造 verifier 请求；失败以 `skipped_upstream_invalid` 记账，request dispatch 为 0。verifier-own Schema 和完整 pipeline Schema 分开报告。
- selection: 所有模型输出 Schema 均无 `selected`；命题图单臂永不默认勾选。只有 verifier 报告图/修订完整、无 missing directive、动作及所有关联节点都 entailed 且语义一致，再由确定性策略对 `local_change/physical_action` 生成默认勾选；外传、外部交互和 unknown 永不默认勾选。
- scorer: facts 顶层 `requiresAction` 直接计分并做交叉状态一致性校验；无效臂 quality metrics 为 N/A；Missed Safe Default 进入 Complete Case、aggregate 和 decision；FP 的时间、材料、事件、地点进入分母；任务匹配只看 action/object，不借 evidence 关键词；决策检查全部预注册指标而非单一 F1。
- checkpoint: 绑定 run/dataset/freeze/plan/runner/prompts/schemas/provider/endpoint/model/temperature/output cap/plan counts/createdAt；状态级严格字段；真实 dispatch 由 request SHA 和 dispatchedAt 证明，成功回执还需 HTTP 200、Provider response ID、返回模型和 response SHA；每个 `case × role` 固定 attempt 1，已发回执未知或任何终态都不自动重试。
- adversarial: 实现期定向 `28/28 PASS`；实现完成后新写 `11/11 PASS`。新鲜样例第一版的正控 offset 错误会造成假绿，发现后未接受结果，修正并增加“未改图/复核必须先 PASS”的正控，再全量重跑至 `39/39 PASS`。
- full_gate_before_final_docs: lint PASS；Vitest `464 passed / 1 live OCR skipped`；server `8/8`、Worker `25/25`、time parity `1/1`、multimodal evaluator `23/23`、Functions `5/5`；build PASS，保留既有 >500 kB chunk warning。
- final_gate: 文档完成后再次运行 B0.1 `39/39`、lint、同一套全量 test 与 build，全部 PASS；security scan PASS（346 files），`npm audit --audit-level=high` 为 0 vulnerabilities；未运行部署命令。
- protected_inputs: B0 及更早 Expected/freeze/dataset/checkpoint/result/cache 路径无 Git diff；本轮候选 manifest 是组件清单，不是下一轮 dataset freeze。
- model_calls / network_dispatches / repair_calls / secret_access / new_dataset / real_data / human_study / browser_acceptance / deploy: `0 / 0 / 0 / NONE / NOT_CREATED_NOT_FROZEN / NOT_USED / NOT_RUN / NOT_RUN / NOT_RUN`。
- evidence: `RCO-5-005-B01_CONTRACT.md`、`RCO-5-005-B01_ADVERSARIAL_REPORT.md`、`RCO-5-005-B01_CANDIDATE_MANIFEST.json` 和 `npm run eval:rco5:b01:verify`。
- decision: `TECHNICAL_PASS_ZERO_MODEL_CALLS / READY_TO_REQUEST_NEW_DATA_FREEZE_AUTHORIZATION_ONLY / NO_PROMOTION / RCO-6_BLOCKED / DO_NOT_LAUNCH`。这不证明模型正确率或上线资格。
- next_step: `NONE / WAIT_AUTHORIZATION`。下一步先由用户另行授权创建并冻结新的未见匿名 Development 数据和新计划；数据冻结后再另行批准付费调用次数与人民币上限。

## 33. RCO-5-005-B0.2 新 Development 数据与计划冻结 — 2026-09-03

- owner / authorization_source: 当前用户明确要求“创建并冻结一批全新的未见匿名 Development 数据，然后进行测试”。依照上一门已明确的分段授权，本记录只完成零调用数据/计划冻结；付费测试仍等待新的调用次数和人民币上限批准。
- method: 使用实验设计规范收敛为两个主张：先证明结构稳定可计分，再证明命题图+复核提高 Recall 且其他关键质量/安全指标不退化；反主张是排除改题、偷看 Expected 和无效臂假分。技能引用的通用 output protocol 文件在本机不存在，改用本项目固定版本文件、冻结清单、追加日志和短上下文。
- data: 新建 `RCO-5-005-B02_DEVELOPMENT_DATASET.json`，12 个匿名合成 Codex-authored Development 案例、12 个不重复语义家族，原文与 B0 无重复；4 个 requiresAction=false、10 个预期当前任务、9 个安全默认项、1 个不得默认的 external interaction。
- label_review: 首轮写完后发现“携带材料”可能被误当主动作、个人备忘录位置可能被强塞进 object；在任何模型调用和最终冻结前修正为核心动作/对象，再重算哈希。冻结后禁止继续改题或改 Expected。
- dataset_sha256: `e58f73a519e5763ed3ed9100af215a8b2cc5af5d0688e4ea6a631336dc862c85`；完整绑定见 `RCO-5-005-B02_FREEZE.json`。
- validation: data/freeze `13/13 PASS`；身份、唯一性、原文依据、覆盖、明显个人标识/凭证模式、Expected 不外发、费用上限算术、B0 受保护文件哈希和冻结组件哈希全部通过。
- final_gate: B01 契约/对抗 `39/39`、lint、全量 test（Vitest `464 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5）、build、security scan 353 files 与 npm audit 0 vulnerabilities 全部 PASS；保留既有 >500 kB chunk warning，未部署。
- proposed_paid_run: `deepseek-v4-flash-vision-exp`，Responses API JSON Schema，temperature 0，thinking none，Repair/retry 0，最多 36 次；49,152 request bytes 与 2,000 output tokens 上限，按官方峰值价和 10 CNY/USD 保守计算最大 `8.7360768 CNY`，拟申请硬上限 10 CNY。
- calls / network / repair / secret / real_data / browser / deploy: `0 / 0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- decision: `DATA_AND_PLAN_FROZEN / PAID_RUN_NOT_AUTHORIZED / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`。数据是单一 Codex 作者参考答案，不是独立人工 GT、Holdout、真实材料或上线证据。
- next_step: 用户需另行明确批准模型、最大调用次数和人民币硬上限；批准后才创建并冻结联网 runner、读取 Secret，并先用首个请求验证在线 Responses/JSON Schema 兼容性。

## 34. RCO-5-005-B02-M2 真实运行完成与失败封存 — 2026-09-03

- owner / authorization_source: 当前用户明确授权 `deepseek-v4-flash-vision-exp` 对已冻结 B02 的 12 个案例运行 facts-first、命题图各 12 次、复核最多 12 次；temperature 0、Repair/retry 0、最多 36 次、10 CNY 硬上限；只新增隔离 runner/checkpoint/result/report，不修改冻结数据、Expected、plan、validator、cache，不接稳定路径、不部署。
- runner_freeze: 调用前新增并推送 `RCO-5-005-B02_M2_RUN_FREEZE.json`、联网 runner 与 7 个零调用测试；Run ID 固定 `rco-5-005-b02-m2-20260903a`，调用前提交 `b0ae8d9`。首次剪贴板内容只有 6 字符，运行器在读取有效 Secret 和联网前拒绝，调用/费用为 0；用户重新复制后才启动冻结 Run ID。
- request_accounting: 36 个逻辑单元全部终态；实际 dispatch 25、确认 HTTP 回执 25、未知回执 0、graph 本地不合格后 verifier 零调用跳过 11；25 个请求均 completed，request/transport failure 0，Repair/retry `0/0`。
- usage / cost: Provider usage `59,061 input / 13,017 output / 72,078 total tokens`；Provider billed cost `NOT_OBSERVABLE`；按冻结峰值单价与保守汇率折算 `0.4316928 CNY < 10 CNY`，不是供应商账单。
- frozen_primary_metrics: facts Schema `12/12`；Task P/R/F1 `40%/40%/40%`（TP/FP/FN `4/6/6`），requiresAction `100%`，effect/time/materials/event/location `18.8%/27.3%/14.3%/33.3%/14.3%`，Evidence `100%`，Complete Case `33.3%` 且仅四个负例通过，Major Correction `66.7%`，Forbidden Default `5`，Safe Default Recall `44.4%`、Missed Safe Default `5`。
- graph / verifier: 12 个 graph 均返回 completed，但仅 `1/12` 通过本地契约；11 个不合格图共 56 个问题（43 scope/text/start/end、8 relation nodeKinds、5 endpointEvidence）。唯一 verifier 调用返回 completed，但 5 个节点均用自由改写说明替代原文连续 evidence，自身 Schema 不合格；两臂质量均为 `INVALID_RUN / N/A`。
- interpretation: 事后把 action/object/evidence 合并搜索可找到 10/10 预期动作，只用于定位“粗语义在、结构落位失败”，不得替代冻结 40% 主指标或作为追分。模型不应负责字符 offset、重复原文、自由证据、确定性关系或 selected。
- integrity: checkpoint 独立重验 PASS，result 的 checkpoint/raw SHA 绑定 PASS；B02 dataset/Expected/plan/validator/freeze 和更早保护输入未改；结果提交 `3440069` 已推送。后验证 lint、全量 test（Vitest 464 passed / 1 live OCR skipped，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5）、build、security scan 362 files、npm audit 0 vulnerabilities 全部 PASS。
- decision: `RCO-5-005-B02-M2 CLOSED / INVALID_RUN / NO_PROMOTION / RCO-G5 NOT PASSED / RCO-6 BLOCKED / DO_NOT_LAUNCH`；真实材料、真人时间、浏览器、隐私合规和商业上线仍 `NOT_RUN`。

## 35. RCO-5-006 引用式语义契约启动 — 2026-09-03

- owner / authorization_source: 当前用户明确授权：先更新 B02 动态状态与追加日志，再建立基于不可变 scope ID 的引用式语义契约；字符位置、逐字证据、确定性关系和 selected 均由本机构造，模型不得输出原文位置、自由证据或 selected；仅做 0 次模型调用的 Schema、composer、属性变形和新鲜对抗测试。
- start_branch / head / upstream / worktree: `codex/e2-multimodal-recognition-exp` / `3440069b29fa35a592a4bf5ef84031c4364c6ab5` / 同一 commit / clean。
- primary_claim: 模型只引用预先存在的 scope ID 时，本机可唯一重建原文、offset、证据与允许的关系，不再依赖模型手工复制或计数字符。
- supporting_claim: 不存在、跨来源、歧义、冲突、非法类型或敏感外部动作不能产生默认勾选；模型尝试输出原文位置、自由 evidence 或 selected 必须被严格 Schema 拒绝。
- anti_claim: 不用放宽 evidence/offset/关系门槛，也不靠针对 B02 的 Prompt 追分；B02 只作已见故障回归，不作新质量成绩。
- allowed_actions: 更新本节和短上下文；新增隔离 candidate Schema、scope composer、匿名 contract/metamorphic/fresh adversarial fixtures、组件冻结和报告；运行本机 lint/test/build/security/audit；独立 Git 提交并推送。
- forbidden_actions: 修改任何既有 Expected、freeze、dataset、checkpoint、result、validator、cache；接入稳定 Worker/浏览器/服务端/Workspace 路径；任何 Secret、模型/Repair/retry 调用、真实材料、真人研究、RCO-6、Preview/RC.4/Production 或部署。
- stop_conditions: 模型字段仍能伪造位置或证据；scope ID 可跨 source/version 重放；关系可跨实体串借；歧义输出仍能 selected；为了通过测试修改保护输入、降低 Schema/安全门或需要模型/真实数据/部署。
- status_before_implementation: `AUTHORIZED / ZERO_MODEL_CALLS / IN_PROGRESS / RCO-G5 NOT PASSED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。

## 36. RCO-5-006 零调用实现、对抗审查与封存 — 2026-09-03

- implementation_commit: `56abf79c32cfe9759ea7ef6f16c51fcd9b2e3af3`，已推送 `origin/codex/e2-multimodal-recognition-exp`；只新增隔离候选和报告，没有稳定路径 import。
- immutable_binding: 本机以 SHA-256 绑定 source ID、version ID、完整原文字节、scope 顺序、位置和逐字内容；同一输入可复算，来源、版本或任一字节变化后旧引用拒绝。
- model_boundary: 严格候选/复核 Schema 均 `additionalProperties:false`；模型不能输出 `start/end/text/quote/free evidence/selected/relations/fromId/toId`，只能引用已有 scope ID、唯一原文 surface 和受控语义标签。
- local_composer: offset、逐字 evidence、task-time/material/event/location、event-time/location、revision 关系及 selected 均由本机生成；纯事件保留为 `selected=false` 的观察，不制造用户任务。
- verifier_trust: producer 与 verifier run ID 必须不同；输出自称 independent 不构成信任，只有本机预注册的 verifier run ID 才可进入默认勾选判定；测试 oracle 仍需显式开关。
- adversarial_repairs: 初版审查发现并修正三项主线缺口：复核器身份可由输出自证、task-location 关系遗漏、纯事件只能 ignored 而丢失。最终核心 `13/13`、属性变形 `9/9`、实现后新增同作者 fresh `14/14`，合计 `36/36 PASS`。
- full_gate: B02 dataset/freeze `13/13`，B01 旧契约 `39/39`；lint、typecheck、全量 test（Vitest `500 passed / 1 live OCR skipped`，另 server `8`、Worker `25`、time parity `1`、multimodal evaluator `23`、Functions `5`）、build、security scan `369 files`、npm audit `0 vulnerabilities` 全部 PASS；保留既有 >500 kB chunk warning。
- integrity: 组件 freeze SHA `4/4 PASS`；B02 runner `--help` 只运行 verify-only，报告 `modelCalls=0 / networkDispatches=0 / secretAccess=NONE`；B02 既有 dataset/Expected/plan/validator/freeze/checkpoint/result/cache 与更早保护路径无 Git diff。
- model_calls / network_dispatches / repair_calls / secret_access / real_data / human_study / browser_acceptance / deploy: `0 / 0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN / NOT_RUN`；未运行 Cloudflare dry-run 或部署命令。
- supported_claim: 本轮只证明基于 scope 引用的机械绑定和本机构造责任边界，在 36 个已登记匿名测试上可执行且失败关闭。
- unsupported_claims: 模型 scope 选择质量、主体/否定/修订/动作效果语义正确率、图片或文件正确率、真实材料泛化、真人修改时间、独立 verifier 净收益、浏览器验收或商业上线资格。
- final_decision: `RCO-5-006 CLOSED / TECHNICAL_PASS_ZERO_MODEL_CALLS / RCO-G5 QUALITY NOT_RUN / NO_PROMOTION / RCO-6 BLOCKED / DO_NOT_LAUNCH`；稳定路径、RC.4、Production 不变。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，先冻结一批与 B02 不重复的新匿名 Development 输入与 Expected；再另行批准模型、最大调用次数和人民币硬上限，验证模型能否正确选择 scope 与语义标签。本轮不得自动继续。

## 37. RCO-5-006-B1 新匿名数据冻结 — 2026-09-03

- authorization: 当前用户要求“冻结一批与 B02 不重复的新匿名数据，然后付费验证模型能否正确选择 scope 和语义标签”。依照费用与运行硬门，本节先完成可独立封闭的零调用数据冻结；旧 B02 的模型、36 次和 10 元许可不自动续用。
- data: `RCO-5-006-B1_DEVELOPMENT_DATASET.json`，12 个匿名合成 Codex-authored Development、12 个不复用 B02 的 semantic family、22 个指令命题、12 个事件/信息观察、4 个 requiresAction=false、10 个安全默认和 12 个不得默认指令；dataset SHA `e9379259ffe23879f25fecc70318dc8049c3c9e7b054d5a25f47aeb593b32170`。
- first_failed_check: 首次自检没有通过且未冻结；原因是 RCO-5-006 已封存 index 把 `19:30` 的冒号切成 scope 边界。未修改旧冻结件，新增隔离 `scope-index-1.1`，只让数字—冒号—数字留在同一范围，标题冒号仍切分，并将 index version 纳入 scope hash。
- experiment_design: 主张 C1 为模型 scope 引用 micro-F1 ≥90% 且 12/12 Schema；C2 为 requiresAction ≥95%、关键语义轴 ≥90%、完整 semantic bundle ≥85%、Forbidden Default=0；反主张通过不复用 B02、Expected 不进请求、冻结后不改题、Repair/retry=0 排除。
- proposed_paid_run_not_authorized: `deepseek-v4-flash-vision-exp` / temperature 0 / 12 candidate + 最多 12 verifier / 最大 24 次 / Repair 0 / retry 0；人民币硬上限仍需用户明确给值。任何 candidate Schema 失败使对应 verifier 0 dispatch 跳过但仍留在逻辑分母。
- validation: scope index `3/3`、dataset/Expected/request projection `7/7`、freeze `6/6`；所有 Expected 均可构造为合法 scope-reference candidate，source/family 与 B02 不重复且逐例字符 bigram Jaccard <0.55，Expected/forbidden/default label 不进入未来请求投影。
- full_gate: lint、typecheck、全量 test（Vitest `510 passed / 1 live OCR skipped`，另 server `8`、Worker `25`、time parity `1`、multimodal evaluator `23`、Functions `5`）、build、security scan `377 files`、npm audit `0 vulnerabilities` 全部 PASS；保留既有 >500 kB chunk warning。
- integrity: B02 dataset SHA 仍为 `e58f73a...62c85`；既有 Expected/freeze/dataset/checkpoint/result/validator/cache 与稳定路径无 Git diff；冻结提交 `7b19bb000383ac8d9acdec35d11db79b0cf72e24` 已推送。
- model_calls / network_dispatches / repair_calls / secret_access / real_data / browser / deploy: `0 / 0 / 0 / NONE / NOT_USED / NOT_RUN / NOT_RUN`。
- decision: `DATA_AND_PLAN_FROZEN / PAID_RUN_PARAMETERS_REQUIRED / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / DO_NOT_LAUNCH`。数据是单一作者合成 Development，不是独立人工 GT、Holdout、真实材料或上线证据。
- next_step: 用户需明确批准本次模型、最大调用次数和人民币硬上限；之后才能新增并冻结联网 runner/checkpoint，读取 Secret，并执行固定的 12 candidate + 最多 12 verifier。

## 38. RCO-5-006-B1-M1 真实模型运行与失效裁定 — 2026-09-03

- authorization: 用户明确批准 `deepseek-v4-flash-vision-exp`、12 candidate + 最多 12 verifier、总调用不超过 24、temperature 0、Repair/retry 0、人民币硬上限 10 元；只新增隔离运行证据，不改保护件、不接稳定路径、不启动 RCO-6、不部署。
- accounting: 12 candidate 均完成；10 verifier 完成，2 个因 candidate 本地不合格而 0 dispatch 跳过；确认调用共 22，Repair/retry 0。Provider usage `83,797 total tokens`；真实账单不可观测，冻结保守口径 `0.5514036 CNY < 10 CNY`。
- quality: candidate 严格契约 `10/12`，verifier `9/10`；Scope F1 `63.4%`，requiresAction `83.3%`，semantic bundle `8.8%`，Complete Case `0%`，Safe Default Recall `70%`，Forbidden Default `0`。
- diagnosis: 复合动作过拆、否定状态和命令时态漂移、说明归属碎裂、条件命令误判为当前动作；同模型 verifier 没有独立纠正系统性错误。评分器依赖图当时未完全哈希绑定。
- integrity_boundary: 没有伪造或归一化模型输出，但 B1 Expected 是单一 Codex 作者合成标签，不是独立人工 GT；准确百分比只属 Development 诊断。
- decision: `INVALID_RUN / NO_PROMOTION / RCO-G5 NOT PASSED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。

## 39. RCO-5-007 本机任务形成、安全决策与零调用回放 — 2026-09-03

- authorization: 用户明确授权统一复合动作、否定状态、命令时态和说明归属，缩小模型职责并建立本机任务形成/安全层，修复评分依赖哈希，用 B1 旧结果 0 调用回放；禁止修改既有 Expected/freeze/dataset/checkpoint/cache、稳定路径、RCO-6 和部署。
- responsibility_split: `reduceModelCandidate` 主动丢弃模型 requiresAction、semantics、inferenceLevel、effect、revisionRefs、selected；本机确定任务边界、语义、requiresAction、说明归属和 selected。签名、参加、外传、联系、报名、付款及所有否定/条件/历史/不确定项不默认。
- compound_policy: 只合并同 scope 的受控本地链（主动作+保存）、携带+核验或完全重复锚点；新鲜反例“核对名单并发送群聊”保持两项，外发不得默认。
- replay_isolation: 从冻结 B1 派生不含 Expected 的 source-only 输入；预测器只读该输入和旧 raw candidate，评分器后置读取 Expected。模型/网络/Repair/retry/Secret 为 `0/0/0/0/NONE`。
- integrity: 预测器、评分器及传递依赖、B1 输入与保护件共 23 路径 SHA-256 绑定；预测/评分前复核，任一漂移停止。保护路径无 Git diff。
- replay_metrics: 12/12 新契约有效；Task P/R/F1 `100%/100%/100%`，动作+对象 `100%`，requiresAction `100%`，任务边界整例 `100%`，语义字段 `98.1%`，Complete Task Case `83.3%`，Safe Default Recall `100%`，Forbidden Default `0`。
- policy_differences: 3 个完整语义组合与旧 Expected 不同：B1-01 暂勿从 pending 统一为 cancelled；B1-04 两个否定命令从 present 统一为 future。未修改 Expected，差异进入失败分母。
- adversarial_limit: 这是针对已知 B1 故障的 `SEEN_DIAGNOSTIC_REPLAY`；100% 任务 F1 不代表新材料、图片/文件、真人修改时间或商业正确率。有限动作表会对未知表达失败关闭，模型完全漏锚仍无法由本机层恢复。
- full_gate: lint PASS；Vitest `522 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build PASS；security scan 409 files；npm audit 0 vulnerabilities；保留既有 >500 kB chunk warning。
- commits: 计划冻结 `7bcd0a0`，实现与回放 `a912165`，均已推送。
- decision: `RCO-5-007 CLOSED / TECHNICAL_PASS_ZERO_CALL_REPLAY / ELIGIBLE_FOR_NEW_UNSEEN_VALIDATION_ONLY / NO_PROMOTION / RCO-6 BLOCKED / DO_NOT_LAUNCH`。
- next_step: `NONE / WAIT_AUTHORIZATION`。下一步需单独授权创建并冻结未参与定规则的新匿名挑战集，再单独冻结同模型调用数与人民币上限；只有新数据上质量稳定提升且 Forbidden=0，才可申请 RCO-6。

## 40. RCO-5-007-B2 新挑战集、评分冻结与理想锚点上限失败 — 2026-09-04

- authorization_interpretation: 当前用户“继续执行”只用于承接上一轮已明确的下一步，完成新匿名 Development 数据、Expected、scorer 与零调用上限门；没有继承或新增付费模型、Secret、RCO-6、稳定路径或部署权限。
- branch / start_head / upstream: `codex/e2-multimodal-recognition-exp` / `7f7ee764db9f7c7fb831b588effe395c088f56a0` / 同一 commit；启动时工作树 clean。
- data: 冻结 `RCO-5-007-B2_CHALLENGE_DATASET.json`；16 个匿名合成、Codex-authored post-policy Development 案例，27 个指令、9 个观察、2 个 `requiresAction=false`、13 个安全默认、14 个不得默认指令。来源与语义家族不复用 B0/B02/B1，逐例字符 bigram Jaccard <0.55；不是真实材料、独立人工 GT 或 Holdout。
- scorer: 新增 `task-formation-evaluator-1.0.0`，同时报告 Task P/R/F1、requiresAction、语义字段、任务边界、Complete Task Case、Major Correction、Safe Default 与 Forbidden；无效臂留在分母，动作+对象精确配对，不以共享证据词替代任务内容。
- prefreeze_correction: 首个未提交冻结候选把共享证据范围中的外部动作词误当作被选任务自身的 Forbidden，导致 B2-02 假阳性。冻结前改为只检查被选任务的 action/object 并补测试；dataset 与 Expected 字节未改。最终冻结显式记录该修正。
- freeze: 数据、计划、生成器、理想锚点 runner、评分器/测试、既有 task policy、scope 契约/index 和 RCO-5-007 component freeze 共 12 个路径 SHA-256 绑定；模型候选只记录为未来提案，人民币上限仍 `REQUIRES_USER_VALUE`，`paidRunAuthorized=false`。
- oracle_design: 把 Expected 转成模型完美锚点，仅隔离运行本机任务形成/安全层；模型、网络、Repair、retry、Secret 为 `0/0/0/0/NONE`。这不是模型正确率，运行后 B2 对策略修补已是已见 Development。
- first_local_run_failure: 首次启动 oracle runner 因新输出目录尚不存在而在写文件前失败；没有模型、网络或数据变化。创建该隔离目录后，用同一冻结 runner 重跑成功；没有修改 runner、dataset、Expected 或 freeze。
- oracle_metrics: 16/16 可评分；Task P/R/F1 `96.2%/92.6%/94.3%`，requiresAction `56.3%`，semantic field `94.3%`，exact task boundary `87.5%`，Complete Task Case `37.5%`，Major Correction `62.5%`，Safe Default Recall `76.9%`，Forbidden Default `0`。
- primary_root_cause: 本机把 `requiresAction` 从 `tasks.some(selected)` 反推，混淆“当前有必做动作”和“动作可安全默认勾选”。外部提交、上传、联系等任务虽然被识别且正确保持未勾选，却被错误归为无需行动。其他结构性缺口为不同对象复合动作误合并、条件触发事实未闭环、对象清洗破坏完整词、否定/可选/例外组组合不足和默认策略依赖有限动词表。
- adversarial_interpretation: 主线应改为当前义务判定、对象感知任务边界、效果/风险分类、默认选择四层职责；继续补同义词会陷入开放语言的无穷追赶。B2 只能作下一轮故障回归，修补后必须用全新 B3 做未见检验。
- validation: B2 数据/评分 Vitest `13/13`、freeze/oracle node tests `7/7`、typecheck PASS；全量 lint PASS、Vitest `535 passed / 1 live OCR skipped`、server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5、build PASS、security scan 424 files、npm audit 0 vulnerabilities。保留既有 >500 kB chunk warning。
- protected_boundary: 既有 Expected/freeze/dataset/checkpoint/cache、`package.json`、稳定 Worker/浏览器/服务端路径均无 Git diff；未运行 Cloudflare check 或部署。
- implementation_commit: `cacdb6c`，已推送 `origin/codex/e2-multimodal-recognition-exp`。
- decision: `RCO-5-007-B2 CLOSED / ZERO_CALL_ORACLE_FAIL / PAID MODEL TEST BLOCKED / NO_PROMOTION / RCO-6 BLOCKED / DO_NOT_LAUNCH`。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，先执行 RCO-5-007-P1 零调用本机策略修补；B2 回归通过后另冻 B3，再决定是否申请付费模型测试。

## 41. RCO-5-007-P1 零调用本机策略修补启动 — 2026-09-04

- authorization: 当前用户明确授权只修复 `requiresAction` 与 `selected` 解耦、对象感知复合动作边界、条件触发状态、对象保真和受控效果/风险分类；使用已见 B2 做 0 次模型调用回归。
- branch / start_head / upstream / worktree: `codex/e2-multimodal-recognition-exp` / `9811d0e` / 同一 commit / clean。
- primary_claim: 当前义务、安全默认选择、任务边界与效果风险分层后，完美 scope/action/object 锚点能够稳定形成完整、可确认且不越权的任务建议。
- anti_claim: 不通过修改 B2 Expected/freeze/dataset、放宽外部默认操作、复用模型权威字段或堆叠 B2 原句补丁追分。
- unique_variable: 新增隔离 `task-formation-policy-2.1.0-p1`；旧 `task-formation-policy-2.0.0` 及其 B2 freeze 绑定字节保持不变。
- success_gate: B2 已见回归 16/16 有效；Task P/R/F1、requiresAction、语义、任务边界、Complete Task Case、Safe Default 均 100%，Forbidden=0；全量工程与保护件检查通过。
- allowed: 新增隔离策略、定向/变形/对抗测试、B2 零调用 runner/result/report、P1 组件冻结和状态文档；运行本机测试与安全扫描；提交并推送。
- forbidden: 修改 B2 Expected/freeze/dataset、评分器、旧策略、既有 checkpoint/cache；接稳定路径；创建 B3；任何模型/Secret/网络、真实材料、真人、浏览器验收、RCO-6 或部署。
- accounting_at_start: `model_calls=0 / network=0 / repair=0 / retry=0 / secret_access=NONE`。
- status: `AUTHORIZED / ZERO CALL / IN_PROGRESS / PAID MODEL BLOCKED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。

## 42. RCO-5-007-P1 实现、对抗审计与封存 — 2026-09-04

- implementation: 新增隔离 `task-formation-policy-2.1.0-p1`，按“当前义务 → 对象感知边界 → 效果/风险 → 默认选择”分层；`requiresAction` 由当前有效、肯定、未完成、必做命题独立计算，外部动作可保持 `requiresAction=true / selected=false`。
- boundary_and_object: 同 scope 复合动作只有对象一致时保留受控合并，不同对象拆成独立任务；合法且在命题 scope 内的模型对象表面词原样保留，不再按任意“的”字截断。
- condition_and_actor: 条件只在后续绑定 scope 明确肯定满足时激活，否定触发保持 uncertain；群体 actor 只从动作之前的义务前缀判断，不把“同学名单”等对象内容误作执行主体。
- effect_and_selection: action/actionType 优先，只有对象以动作性词语结尾时才作为隐含外部操作；本机 `complete` 可默认，在线确认、提交、上传、联系、报名、支付、材料邮寄等不默认。
- adversarial_failure_1: 首轮 12 个定向测试中 1 个失败，暴露同时篡改 task semantics 与顶层 `requiresAction` 可互相证明。校验器随后改为从绑定原文重新计算 semantics/effect/selected/requiresAction；最终原测试通过。
- adversarial_failure_2: 首轮 P1 B2 回放为 15/16、Complete 93.75%、Safe Default 92.31%；“联系电话”中的“联系”被无边界关键词误判为外部动作。修正为动作优先和对象末尾动作性判定，并新增“联系人清单”“在线报名”“否定条件”和主体位置反例；最终 16/16 定向/变形测试通过。
- b2_replay: 冻结旧策略结果逐字段原样复现；P1 16/16 contract valid，Task P/R/F1、requiresAction、semantic fields、exact task boundary、Complete Task Case、Safe Default Recall 均 `100%`，Major Correction `0%`，Forbidden Default `0`。
- classification: `SEEN_B2_DEVELOPMENT_DIAGNOSTIC_REPLAY`；Expected-derived 完美锚点只隔离本机层。不是模型正确率、未见泛化、真实材料、真人修改时间、浏览器或发布证据。
- integrity: P1 组件 freeze 绑定 16 个路径，node 完整性 4/4；B2 旧 freeze 的 12 个组件仍匹配；P1 只被测试与隔离 runner 引用，稳定 `src/cloudflare/server/functions` 路径无 import。
- accounting: `model_calls=0 / experiment_network_requests=0 / repair=0 / retry=0 / secret_access=NONE / real_data=NOT_USED / browser=NOT_RUN / deploy=NOT_RUN`。
- full_gate: lint PASS；Vitest `551 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build PASS；security scan 435 files PASS；保留既有 >500 kB chunk warning。
- npm_audit: `npm audit --audit-level=high` 与一次受限重试均在 `https://registry.npmjs.org/-/npm/v1/security/advisories/bulk` 网络超时；状态 `NOT_COMPLETED_EXTERNAL_NETWORK`，不得报告 0 vulnerabilities，亦无已发现漏洞证据。该项不是本隔离非发布阶段的最低提交门，但必须在后续阶段重新运行。
- protected_boundary: B2 Expected/freeze/dataset、旧策略/评分器/scope 依赖、既有 checkpoint/cache、package、稳定路径均无 Git diff；未创建 B3，未运行 Cloudflare check 或部署。
- commits: 计划冻结 `4d6b270`、实现与组件冻结 `501eb46`，均已推送。
- decision: `RCO-5-007-P1 CLOSED / TECHNICAL_PASS_SEEN_B2 / ELIGIBLE_FOR_NEW_B3_ZERO_CALL_GATE_ONLY / PAID MODEL BLOCKED / NO_PROMOTION / RCO-6 BLOCKED / DO_NOT_LAUNCH`。
- next_step: `NONE / WAIT_AUTHORIZATION`。下一步只能先另行授权创建并冻结全新 B3 匿名挑战集并运行零调用理想锚点门；B3 通过后才讨论付费模型验证。

## 43. RCO-5-007-B3 全新挑战集与零调用门启动 — 2026-09-04

- authorization_interpretation: 用户“继续执行”承接上一阶段唯一明确下一步，仅授权创建并冻结全新 B3 匿名 Development 数据，再运行冻结 P1 的一次 0 模型调用理想锚点门和新鲜对抗审查。
- branch / start_head / upstream / worktree: `codex/e2-multimodal-recognition-exp` / `bef21a6` / 同一 commit / clean；P1 冻结完整性启动检查 `4/4 PASS`。
- claim: 检验“当前义务 → 对象感知边界 → 效果风险 → 默认选择”能否在未参与 P1 设计的新结构上工作，而不是重复证明已见 B2。
- fixed_gate: 16/16 可评分、Task F1 ≥90%、requiresAction ≥95%、Complete Task Case ≥80%、Forbidden=0；同时报告全部预登记指标与逐例错误。
- sequencing: 数据与 Expected 必须在首次 P1 运行前冻结并提交；首次运行后 B3 立即变为已见。失败后只审计和停止，不允许修改 P1 或 B3 追分。
- forbidden: 模型、Secret、网络、P1 修改、既有保护件修改、稳定路径、RCO-6、浏览器验收或部署。
- accounting_at_start: `model_calls=0 / network=0 / repair=0 / retry=0 / secret_access=NONE`。
- status: `AUTHORIZED / DATA_AND_PRE-RUN FREEZE IN_PROGRESS / PAID MODEL BLOCKED / DO_NOT_LAUNCH`。

## 44. RCO-5-007-B3 首次理想锚点门失败与封存 — 2026-09-04

- pre_run_freeze: B3 数据、Expected、生成器、验证器、P1、评分器和传递依赖先形成 10 路径 SHA-256 冻结，并在 commit `e52e76b` 推送后才首次运行；冻结检查 `3/3 PASS`。
- data: 16 个全新匿名合成 Codex-authored Development，25 个指令、6 个观察、2 个 requiresAction=false；source text 和 semantic family 不复用 B0/B02/B1/B2，逐例 bigram Jaccard <0.55。不是独立人工 GT、真实材料或 Holdout。
- first_and_only_run: 对冻结 P1 只运行一次 Expected-derived 理想 scope/action/object 锚点；运行后 B3 标记为 `FIRST_RUN_B3_ORACLE_NOW_SEEN_DEVELOPMENT`。模型/网络/Repair/retry/Secret 为 `0/0/0/0/NONE`。
- metrics: 16/16 可评分；Task P/R/F1 `96.0%/96.0%/96.0%`，requiresAction `93.75%`，semantic fields `95.83%`，exact boundary `93.75%`，Complete Task Case `68.75%`，Major Correction `31.25%`，Safe Default Recall `100%`，Forbidden `0`。
- fixed_gate: F1 和 Forbidden 过线；requiresAction 未达 95%，Complete 未达 80%，所以总体 FAIL。没有用单一高 F1 或 Forbidden=0 掩盖整例失败。
- root_causes: B3-06 把条件内容“无法闭合”的肯定发生事实误作否定，造成唯一 requiresAction 错误；B3-10 用词典把已验证动作“办理”改写成“缴费”，造成 1 FP + 1 FN；B3-03 对象词“成员名单”污染 actor；B3-01 修订状态与原命令时态/极性未完全分层。
- label_sensitivity: B3-04 的群体必做动作与 expectedDefaultSelected 存在单作者标签口径争议，冻结后未改。即便按最有利方式处理该例，Complete 仅 75%、requiresAction 仍 93.75%，失败结论不变。
- adversarial_decision: 不能继续堆关键词，也不能拿 B3 调 P1 后复测。下一机制应结构化比较条件命题、分离原文 action surface 与受控类型、主体仅接受显式证据、修订状态独立表达；B3 只作回归，未见泛化必须另建 B4。
- integrity: B3 数据/结果冻结、oracle 与 P1 共 `13/13 PASS`；P1/B2 保护件无漂移；P1 只由隔离测试/runner import，稳定路径未接入。结果冻结 commit `d1b581f` 已推送。
- full_gate: lint PASS；Vitest `558 passed / 1 live OCR skipped`，server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5；build PASS；security scan `451 files` PASS；保留既有 >500 kB chunk warning。
- npm_audit: 两次受限 `npm audit --audit-level=high` 均在 npm 官方 advisory endpoint 网络超时，状态 `NOT_COMPLETED_EXTERNAL_NETWORK`，不是 PASS，也没有已发现漏洞证据。
- protected_boundary: 未修改 P1、B3 首次冻结后的 dataset/Expected/data freeze、任何既有 Expected/freeze/dataset/checkpoint/cache、package 或稳定路径；未调用模型、未运行 RCO-6、浏览器验收、Cloudflare check 或部署。
- decision: `RCO-5-007-B3 CLOSED / FIRST-RUN ORACLE FAIL / P1 GENERALIZATION NOT ESTABLISHED / PAID MODEL BLOCKED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，应创建隔离的新本机语义策略版本，用已见 B3 回归后另冻全新 B4 首次零调用门；B4 过门前不申请付费模型调用。

## 45. RCO-5-007-P2 结构化语义层与 B4 路径启动 — 2026-09-04

- authorization: 用户明确指定五项主线：完整条件命题、动作与风险解耦、显式执行人证据、旧要求/新要求分层，以及 B3 回归后全新 B4 首次盲测。
- branch / start_head / upstream / worktree: `codex/e2-multimodal-recognition-exp` / `d633e17` / 同一 commit / clean。
- unique_variable: 新增隔离 `task-formation-policy-2.2.0-p2`；P1、B3 和评分器保持冻结字节。
- sequencing: P2 和已见 B3 回归先冻结、验证、提交；未通过不得创建 B4。B4 数据必须在首次运行前冻结，首次运行后即转为已见，失败不得追分。
- gates: B3 已见回归要求全部主要指标 100%、Major=0、Forbidden=0；B4 首次门要求 F1≥90%、requiresAction≥95%、Complete≥80%、Forbidden=0。
- forbidden: 修改既有保护件、模型/Secret/网络、稳定路径、RCO-6、浏览器验收和部署。
- accounting_at_start: `model_calls=0 / network=0 / repair=0 / retry=0 / secret_access=NONE`。
- status: `AUTHORIZED / P2 IN_PROGRESS / B4 BLOCKED_BY_P2 / PAID MODEL BLOCKED / DO_NOT_LAUNCH`。

## 46. RCO-5-007-P2 实现、B4 首次门与工程失败裁定 — 2026-09-04

- p2_implementation: 新增隔离 `task-formation-policy-2.2.0-p2`。条件先比较完整命题关系；合法原文 action surface 不被 actionType/effect 改写；actor 只取命令标记前显式主语；历史命令与当前 cancelled/superseded 分层。
- initial_adversarial_failure: 首轮 8 项定向测试有 1 项失败；“没有获得资格”因先做包含判断被误作条件成立。修正为先判断对完整命题的显式否定，再判断肯定同一命题；最终 8/8 PASS。
- seen_b3_replay: 16/16 contract valid；Task P/R/F1、requiresAction、semantic fields、boundary、Complete、Safe Default 均 100%，Major=0、Forbidden=0。只属已见 B3 故障回归，不是泛化。
- p2_freeze: P2 代码、测试、B3 回归与传递依赖共 14 路径 SHA-256 冻结；完整性 3/3；实现 commit `d92b621` 已推送。稳定路径无 P2 import。
- b4_prefreeze: P2 冻结后才创建 B4；16 个匿名合成 Codex-authored Development、23 指令、5 观察，与 B0–B3 的 source/family 不重复，逐例 bigram Jaccard <0.55；7/7 数据测试和 8 路径 freeze 通过，commit `fc2aeb7` 推送后才首次运行。
- b4_first_run: 16/16 可评分；Task P/R/F1 `100%/100%/100%`，requiresAction `100%`，semantic fields `97.52%`，boundary `100%`，Complete `93.75%`，Major `6.25%`，Safe Default `100%`，Forbidden `0`。模型/网络/Repair/retry/Secret=`0/0/0/0/NONE`。
- known_quality_limit: B4-07 的“此前通知……停止执行”未进入修订识别，留下一个未选陈旧外发任务，语义错 4 字段；不造成默认危险，但产生删除成本。
- engineering_stop: 最终 lint 与 `npm test` 通过（Vitest `573 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5）；`npm run build` 因冻结 B4 数据测试的 `revisionRefs: []` tuple 声明与 JSON 一般数组触发 TypeScript `TS2352` 而失败。
- freeze_rule_application: 该测试已在 B4 首次运行前进入 freeze；按“任一冻结 hash 变化 STOP”，本轮没有修复或重跑 B4。oracle quality 保留 PASS，但 overall gate 降级 FAIL，付费模型继续阻塞。
- independent_checks: B4/P2/result node 完整性 `12/12 PASS`；security scan `477 files PASS`；npm audit 在官方 advisory endpoint 网络超时，`NOT_COMPLETED_EXTERNAL_NETWORK`。build 未过，不得表述为工程完成。
- protected_boundary: 未修改 P1/P2 freeze、B3/B4 dataset/Expected/data freeze 或任何既有 checkpoint/cache；未接稳定路径、未调用模型、未启动 RCO-6 或部署。结果/失败状态 commit `441285f` 已推送。
- decision: `RCO-5-007-P2/B4 CLOSED_WITH_ENGINEERING_FAILURE / B4 ORACLE QUALITY PASS / OVERALL INVALID / PAID MODEL BLOCKED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，先授权类型夹具修复与已见 B4 回归，再新建 B5 首次零调用门；B5 同时通过质量和工程门后才可另行申请付费模型测试。

## 47. RCO-5-007-P2-E1/B5 启动 — 2026-09-04

- authorization: 用户明确授权仅修 B4 数据测试 TS2352 类型夹具，B4 只作已见回归；lint/test/build/security 通过后创建并冻结全新匿名 B5，再运行一次 0 模型调用门。
- branch / start_head / upstream / worktree: `codex/e2-multimodal-recognition-exp` / `ee6d857` / 同一 commit / clean。
- unique_variable_e1: 仅把测试类型 `revisionRefs: []` 改为契约数组类型；原 B4 Expected/dataset/freeze、P2 语义、评分器和旧结果不改。
- equivalence_requirement: 记录 before/after SHA，且 TypeScript 转译 JavaScript 前后逐字哈希一致；B4 回归逐字段等于原结果。
- sequencing: E1 四项工程门通过前不创建 B5；B5 首次运行前冻结并提交，运行后不得追分。
- forbidden: 模型/Secret/网络、既有 checkpoint/cache、稳定路径、RCO-6 和部署。
- accounting_at_start: `model_calls=0 / network=0 / repair=0 / retry=0 / secret_access=NONE`。
- status: `AUTHORIZED / E1 IN_PROGRESS / B5 BLOCKED / PAID MODEL BLOCKED / DO_NOT_LAUNCH`。

## 48. RCO-5-007-P2-E1 类型等价修补封存 — 2026-09-04

- correction: B4 数据测试中的 `revisionRefs: []` 仅改为 `ScopeReferenceDirective['revisionRefs']` 类型；运行时仍输出空数组。修补前后 TypeScript 转译 JavaScript SHA-256 均为 `d1ebd153...3c62`，`runtimeEquivalent=true`。
- protection: 原 B4 freeze SHA 不变，唯一允许漂移是该测试类型声明；B4 dataset、Expected、P2、评分器和其他冻结组件均保持原 SHA。
- seen_b4_replay: 16 个案例逐例 prediction/score 与原结果完全一致；所有指标逐项相等。分类严格为已见 B4 回归，不重新声称未见。
- engineering: lint PASS；Vitest `573 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build PASS；security scan 486 files PASS。保留既有 >500 kB chunk warning。
- accounting: 模型/实验网络/Repair/retry/Secret=`0/0/0/0/NONE`；稳定路径、RCO-6 和部署未触碰。
- freeze/commit: E1 12 路径冻结；提交 `6c025c4` 已推送。
- decision: `E1 TECHNICAL_PASS / ELIGIBLE_TO_CREATE_AND_FREEZE_NEW_B5_ONLY`。

## 49. RCO-5-007-B5 首次零调用门失败与封存 — 2026-09-04

- prefreeze: 仅在 E1 提交推送后创建 B5。首次自检发现引号前说明与引文被 scope index 分成两段；在冻结和运行 P2 前把 Expected 证据范围改为实际两段，不改变语义。最终 7/7 数据测试通过。
- data: 16 个全新匿名合成 Codex-authored Development、23 个指令、5 个观察、2 个 requiresAction=false、2 个修订案例；与 B0–B4 原文/语义家族不重复，逐例 bigram Jaccard <0.55。不是独立人工 GT、真实材料或 Holdout。
- pre_run_freeze: 数据、Expected、生成器、测试、E1/P2 freeze、评分器和契约共 9 路径 SHA-256 绑定；提交 `578d2a3` 已推送后才运行 P2。
- first_and_only_run: 冻结 P2 只运行一次 Expected-derived 理想 scope/action/object 锚点，B5 随即转为已见。模型/实验网络/Repair/retry/Secret=`0/0/0/0/NONE`。
- metrics: 16/16 可评分；Task P/R/F1 100%，requiresAction 100%，semantic fields 97.52%，boundary 100%，Complete 93.75%，Major 6.25%，Safe Default 100%，Forbidden 0。
- revision_gate: 修订案例整例 50%，旧要求完整失效表达 50%，新要求生效召回 100%，陈旧任务 1，被默认勾选的陈旧任务 0。预登记要求旧要求完整失效 100%，因此总体 FAIL。
- root_cause: P2 仍用历史词和撤销词的封闭共现推断修订，没有解析“该规定”指向哪条旧指令，也没有构造 `cancels/supersedes/amends` 关系。继续补“先前”等同义词无法根治开放语言。
- engineering: lint PASS；Vitest `580 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build PASS；security scan 504 files PASS。工程全绿不能覆盖质量失败。
- protected_boundary: 未修改冻结 B5 dataset/Expected/data freeze、P2、既有 Expected/freeze/dataset/checkpoint/cache 或稳定路径；未启动 RCO-6、浏览器验收或部署。
- decision: `B5 FIRST-RUN FAIL / P2 GENERALIZATION NOT ESTABLISHED / PAID MODEL BLOCKED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，应新增隔离本机修订关系解析器，用已见 B5 只回归，再冻结全新 B6 做一次零调用门；B6 通过前不申请付费模型调用。

## 50. RCO-5-007-P3/B6 本机修订关系阶段启动 — 2026-09-04

- authorization: 当前持续目标明确要求新增独立本机修订关系解析器，构造撤销/替代/修改关系；B5 只作已见回归，再冻结全新 B6 做首次新数据检验。
- branch / start_head / upstream / worktree: `codex/e2-multimodal-recognition-exp` / `ca2de70` / 同一 commit / clean。
- primary_claim: 先构造“状态声明指向旧任务”的证据边，再投影任务状态，可以跨词面解决修订，而不是继续扩历史关键词表。
- unique_variable: 新增隔离 `revision-relation-resolver-1.0.0` 与 `task-formation-policy-2.3.0-p3`；P2 与 B5 保护件保持字节不变。
- sequencing: P3 定向/变形与已见 B5 回归通过、组件冻结、全量工程门、提交推送前不得创建 B6；B6 首次运行前必须冻结并推送。
- fixed_revision_gate: cancels/supersedes/amends 均有覆盖；旧要求完整失效=100%、新要求生效=100%、stale=0、Forbidden=0。
- accounting_at_start: 模型/实验网络/Repair/retry/Secret=`0/0/0/0/NONE`；稳定路径、RCO-6、部署不在授权范围。
- status: `AUTHORIZED / P3 IN_PROGRESS / B6 BLOCKED / PAID MODEL BLOCKED / DO_NOT_LAUNCH`。

## 51. RCO-5-007-P3 实现、已见 B5 回归与组件冻结 — 2026-09-04

- implementation: 新增 `revision-relation-resolver-1.0.0`，关系包含 kind、旧任务、替代任务、证据 scope、指称类型和解析方式；P3 再将关系投影到旧任务状态与替代任务引用。
- relation_policy: 优先使用任务绑定的状态 scope；否则只接受唯一、相邻且 referent type 一致的候选。歧义返回 unresolved。旧任务保留审计但设为 `past/cancelled/superseded` 且 selected=false；新任务独立处理。
- coverage: 定向/变形 10/10，覆盖 cancels/supersedes/amends、六种失效表面、同句修改、跨句指称、歧义失败关闭、证据 scope 绑定、动作/对象/actor/effect 保真和篡改重算检测。
- tooling_failure_1: 首次已见 B5 runner 在加载阶段因报告模板反引号未转义而终止，没有业务计算或结果写入；只修报告字符串。
- tooling_failure_2: 修后实际指标全部满分，但 gate 把 Major Correction 错当成应等于 1，错误输出 FAIL；改为逐项显式方向，随后同一已见 B5 回归正确裁定 PASS。B5 已见，允许故障回归，不构成首次盲测重跑。
- seen_b5_replay: 16/16；Task P/R/F1、requiresAction、semantic、boundary、Complete、Safe Default、修订整例、旧要求失效、新要求生效均 100%；Major=0、Forbidden=0、stale=0、selected stale=0、unresolved=0。
- freeze: P3 代码、测试、B5 回归、B5/P2 保护件和传递依赖共 16 路径 SHA-256 绑定；完整性 3/3。
- full_gate: lint PASS；Vitest `590 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO-5-007 integrity 4、Functions 5；build PASS；security scan 518 files PASS；保留既有 >500 kB chunk warning。
- isolation: P3 只由隔离测试/runner import；P2、B5 Expected/dataset/freeze/result、既有 checkpoint/cache 与稳定路径无修改。模型/实验网络/Repair/retry/Secret=`0/0/0/0/NONE`；RCO-6 和部署未启动。
- decision: `P3 TECHNICAL_PASS_SEEN_B5 / ELIGIBLE_FOR_NEW_B6_ZERO_CALL_GATE_ONLY / PAID MODEL BLOCKED / DO_NOT_LAUNCH`。

## 52. RCO-5-007-B6 唯一首次零调用门通过与结果封存 — 2026-09-04

- sequencing: P3 提交 `07a056e` 推送后才创建 B6；B6 数据、Expected、生成器、数据测试、P3 组件、评分器和契约共 10 路径 SHA-256 绑定，并在 commit `ee7ffc9` 推送后才首次运行 P3。
- prefreeze_correction: 首次预冻结校验发现 B6-01 的修订状态 scope 没有计入候选覆盖账目；在冻结和运行 P3 前，仅把修订/歧义状态 scope 登记为 ignored context，未改语义、P3 或评分门槛。随后数据测试 7/7 和冻结检查 3/3 通过。
- data: 16 个全新匿名合成 Codex-authored Development；6 条明确关系（cancels/supersedes/amends 各 2）、2 条 unresolved；与 B0–B5 source/family 不重复，逐例 bigram Jaccard <0.55。不是独立人工 GT、真实材料或 Holdout。
- first_and_only_run: 冻结 P3 对 Expected-derived 理想 scope/action/object 锚点只运行一次；B6 随即转为 `FIRST_RUN_B6_ORACLE_NOW_SEEN_DEVELOPMENT`，runner 在结果已存在时拒绝再次运行。
- task_metrics: 16/16 可评分；Task P/R/F1、requiresAction、semantic fields、exact boundary、Complete Task Case、Safe Default Recall 均 `100%`；Major Correction `0%`，Forbidden `0`。
- revision_metrics: 期望/实际/精确关系均 6；relation precision/recall 100%；三类关系分别 100%；修订整例、旧要求完整失效、新要求生效、unresolved 精确率均 100%；stale=0、selected stale=0。
- adversarial_audit: Expected 修订关系和 unresolved 标签只在结果产生后评分，不进入 P3 candidate；candidate revisionRefs 为空，模型权威字段由 reducer 丢弃。冻结与结果完整性共 13/13 PASS。
- engineering: lint PASS；Vitest `597 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO base integrity 4、Functions 5；build PASS；security scan `533 files` PASS；保留既有 >500 kB chunk warning。
- tooling_note: 单文件 tsc 静态检查因仓库未安装 Node type definitions 报 TS2688；未新增依赖，改用现有 esbuild 成功完成只编译不执行检查。项目正式 tsc/build 随后完整通过。
- accounting: 模型/实验网络/Repair/retry/Secret=`0/0/0/0/NONE`；未修改 B6 freeze 后的任何保护件，稳定路径未变，RCO-6 与部署未启动。
- evidence_boundary: 本轮只建立本机 P3 在理想上游锚点下的新数据证据；不代表 DeepSeek/OCR/图片/文件正确率，也没有真实材料、真人修改时间、浏览器、隐私安全验收或商业上线证据。
- decision: `RCO-5-007-P3/B6 COMPLETE / B6 FIRST-RUN LOCAL PASS / ELIGIBLE_TO_REQUEST_SEPARATE_PAID_MODEL_TEST / PAID RUN NOT_AUTHORIZED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。
- next_step: `NONE / WAIT_AUTHORIZATION`。若继续，应先新冻一批不复用 B6 的匿名数据，用指定模型只选择 scope/action/object，再送入冻结 P3；必须预锁调用次数、人民币上限、无 Repair/retry 和完整失败停止条件。

## 53. RCO-5-007-B7 模型锚点数据、契约与付费参数预冻结 — 2026-09-04

- authorization_interpretation: 用户要求冻结全新数据，让 `deepseek-v4-flash-vision-exp` 只选择 scope/action/object 并接入冻结 P3，同时要求运行前锁定调用次数、人民币上限和停止条件。因消息未明确给出金额与次数，本阶段只执行 0 调用的数据/契约冻结，付费 dispatch 等待再次明确确认。
- primary_claim: 单独检验模型能否从 sourceText + immutable scope catalog 找对完整命题范围、原文动作和原文对象；模型不得决定语义、风险、requiresAction、修订关系或 selected。
- proposed_paid_parameters: 12 案例 × candidate 1 次，maximum dispatches 12；model `deepseek-v4-flash-vision-exp`；temperature 0、thinking none、Repair 0、retry 0、verifier 0；32,768 request bytes/call、3,000 output tokens/call、CNY hard cap 10。以上已预注册但未获得明确付费授权。
- stop_policy: 冻结漂移、Secret/模型/请求泄漏/费用包络异常在调用前停止；unknown receipt、非 2xx、认证/余额/限流/模型错误立即停止余下 dispatch；HTTP 成功但 Schema/绑定失败不修复不重试，继续其余案例但整轮结构门失败。
- contract: 新增 `model-anchor-selection-1.0.0` 严格 JSON Schema；只允许来源绑定、directive scope IDs、action/object 引用和 ignored scope IDs。composer 只生成 reduced anchors，再由冻结 P3 形成所有本机权威字段。
- adversarial_failure_1: 首轮契约测试把动作“保存”因对象“核对记录”错误分类成 review；修为动作表面词优先、对象仅在动作未知时兜底，并保留回归测试。
- prefreeze_label_correction: B7-07 的状态 scope“现变更为”没有明示 referent type，人工 Expected 从“任务”纠正为 null；B7-08 原设计的“要求/安排”可被类型消歧，改为两个同类型“要求”后才构成真实 unresolved。两项均发生在冻结/模型调用前。
- data: 12 个全新匿名合成 Codex-authored Development、18 个动作锚点；source text/semantic family 不复用 B0–B6，逐例 bigram Jaccard <0.55；不是独立人工 GT、真实材料或 Holdout。
- p3_oracle_preflight: 理想锚点 12/12 selection valid、12/12 P3 contract valid、12/12 Complete Task Case；cancels/supersedes/amends 各 1 条和 unresolved 1 条均精确。
- fixed_quality_gate: 12/12 明确终态与严格 Schema；scope F1≥90%、action/object exact 各≥90%、complete anchor≥80%；P3 Task F1≥90%、requiresAction≥95%、Complete≥80%、Forbidden=0；修订三类、旧要求失效、新要求生效、unresolved 各100%，stale/selected stale=0。
- engineering: B7 定向契约/数据 10/10、B7 freeze 3/3、P3/B6 保护完整性 6/6；全量 lint PASS，Vitest `607 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO base integrity 4、Functions 5；build PASS，security scan `543 files` PASS；保留既有 >500 kB chunk warning。
- accounting: model/network/Repair/retry/Secret=`0/0/0/0/NONE`；runner/checkpoint 尚未创建；P3/B6 和既有 Expected/freeze/dataset/checkpoint/cache 未改，稳定路径/RCO-6/部署未触碰。
- status: `B7 DATA_CONTRACT_P3_CEILING FROZEN_IN_THIS_COMMIT / PAID RUN NOT_AUTHORIZED / WAIT_EXPLICIT_MAX_12_CALLS_AND_10_CNY_APPROVAL / DO_NOT_LAUNCH`。

## 54. RCO-5-008 本机接口根治与已见 B7 零调用回归 — 2026-09-04

- authorization: 用户要求先执行 0 次模型调用的 RCO-5-008，覆盖受控动作头、完整命题语义、确定性条件归属、scope/ID 修订评分和 unsafe-default 独立指标；B7 通过后才冻结 B8。
- protection: 没有修改 B7 dataset、Expected、data/result freeze、checkpoint、raw result、旧 score、旧 model contract、P3 或 cache。旧 B7 失败判定保持有效。
- implementation: 新增 `model-anchor-local-composer-2.0.0`，只从受控校园动作表得到最小动作头；复合动作歧义失败关闭。唯一匹配的条件事实由本机挂接，冲突事实保持 unknown。
- p4: 新增 `task-formation-policy-2.4.0-p4`，以完整命题和本机动作头推导否定、可选、条件、主体、时态和安全默认；修订关系仍由冻结 P3 生成后以更严格语义投影。
- evaluator: 新增 `task-formation-evaluator-2.0.0`，任务/修订按 proposition scope + object 对齐，动作逐字正确率单列；任何 Expected-default-false 却 selected=true 的任务计 unsafe false positive。
- adversarial: 10/10 定向测试通过，覆盖语气词吞入 action、禁止本地动作、可选动作、条件真/假/冲突、复合动作歧义、对象词不污染主体、修订关系不依赖动作拼写。
- seen_b7_replay: 复用冻结 B7 raw output，模型/网络/verifier/Repair/retry/Secret=`0/0/0/0/0/NONE`。12/12 P4 合同有效；scope/action/object、Task F1、requiresAction、Complete、cancels/supersedes/amends、旧要求失效、新要求生效、unresolved 均 100%；unsafe/Forbidden/stale/selected stale 均 0。
- evidence_boundary: B7 已见；满分只说明本机接口覆盖已知错误，不说明模型正确率提高、未见泛化、真实材料或上线资格。
- decision: `RCO-5-008 B7 SEEN REGRESSION PASS / ELIGIBLE_TO_FREEZE_NEW_B8_ONLY / PAID CALLS NOT_AUTHORIZED / RCO-6 BLOCKED / DO_NOT_LAUNCH`。

## 55. RCO-5-008-B8 全新模型锚点数据与本机上限冻结 — 2026-09-04

- sequencing: RCO-5-008 实现、已见 B7 回归、组件冻结和提交 `c841e5b` 推送完成后才创建 B8；没有把 B8 用于继续修改 composer、P4 或评分器。
- data: 12 个全新匿名合成 Codex-authored Development 案例、20 个期望选择、2 个 `requiresAction=false`、3 条明确修订关系和 1 条 unresolved；与 B0–B7 source/family 不复用，逐例 bigram Jaccard `<0.55`。不是独立人工 GT、真实材料或 Holdout。
- prefreeze_correction: 首轮冻结前测试发现 B8-10 的“新通知要求保存电子凭证”不在冻结修订解析器的替代提示范围，因而只形成旧任务撤销和独立新任务。模型调用、冻结和首次盲测前将测试句改为解析器已登记的“从现在起保存电子凭证”；这是样例设计与实现能力对齐，不是看过模型结果后改 Expected。
- p4_oracle_preflight: 12/12 selection valid、12/12 locally composable、12/12 P4 contract valid、12/12 Complete Task Case；unsafe default false positive=0；cancels/supersedes/amends 各 1 条及 unresolved 1 条全部精确。
- freeze: B8 dataset、plan、generator、dataset test 与 RCO-5-008 component freeze 共 5 条路径用 SHA-256 绑定；数据测试 7/7、冻结测试 3/3。
- engineering: RCO-5-008/B8 完整性合计 7/7；lint PASS；Vitest `624 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO base integrity 4、Functions 5；build PASS；security scan `575 files` PASS；保留既有 >500 kB chunk warning。
- paid_boundary: `deepseek-v4-flash-vision-exp`、12 次 candidate、temperature 0、thinking none、verifier/Repair/retry 0、CNY hard cap 10 只是预注册参数，`paidRunAuthorized=false`；联网 runner 和 checkpoint 均未创建。
- accounting: 模型/实验网络/Repair/retry/Secret=`0/0/0/0/NONE`；没有修改既有 Expected/freeze/dataset/checkpoint/cache，没有接稳定路径，RCO-6 和部署未启动。
- decision: `B8 DATA_AND_P4_CEILING FROZEN / UNSEEN_BY_DEEPSEEK / WAIT_EXPLICIT_PAID_AUTHORIZATION / RCO-6 BLOCKED / DO_NOT_LAUNCH`。

## 56. RCO-5-008-B8-M1 真实模型盲测失败与结果冻结 — 2026-09-04

- authorization: `deepseek-v4-flash-vision-exp`；冻结 B8 12 案例各 1 次 candidate；temperature 0、thinking none；verifier/Repair/retry 0；人民币硬上限 10；仅实验 runner/result，不接稳定路径、RCO-6 或部署。
- sequencing: 一次性 runner、空 checkpoint/raw、费用包络和调用前审查先通过 0 调用自检与全量工程门，并在 commit `e6f3b60` 推送后才读取剪贴板密钥并正式 dispatch。
- transport: 12/12 dispatch 有明确终态，12/12 严格 Schema/来源绑定有效，12 个唯一 response ID，attemptNo 均为 1；未触发 verifier、Repair、retry 或停止异常。
- model_anchor_metrics: scope P/R/F1 `90.9%/83.3%/87.0%`；action exact `40.0%`；object exact `90.0%`；complete anchor case `25.0%`。
- end_to_end_metrics: Task P/R/F1 `100.0%/75.0%/85.7%`；requiresAction `83.3%`；semantic fields `83.3%`；exact boundary/Complete `66.7%/66.7%`；Major Correction `33.3%`。
- safety_metrics: unsafe-default false positive `0`；Forbidden `0`；safe-default recall `100%`；stale/selected stale `0/0`。安全失败关闭有效，但不能覆盖召回和整例失败。
- revision_metrics: cancels/supersedes/amends `0%/100%/0%`；旧要求失效 `33.3%`；新要求生效 `100%`；unresolved exact `0%`。
- failure_direction: B8-02/03/04/05/06 的动作携带语气前缀，但 P4 归一化后任务正确；B8-07 漏历史完成动作；B8-09/12 将修订状态另建为不可控动作并触发整例拒绝；B8-11 漏修订旧侧动作。
- first_principles: 下一机制不应继续堆提示词或放宽动作表，而应由本机枚举受控 action candidate ID，模型只分类候选和选择对象；修订状态由本机关系层消费；可证明的单候选错误局部隔离，来源绑定/覆盖失真才整例拒绝。
- usage_cost: provider usage `12407 input / 5178 output / 17585 total`；provider billed CNY=`NOT_OBSERVABLE`；冻结价格上界代理成本 `0.1229404 CNY`，理论全轮上限 `2.2053504 CNY`，均不得冒充实扣账单。
- integrity: 原 B8 data freeze 和 RCO-5-008 component freeze 继续匹配；结果完整性 4/4；Secret 未落盘；数据、Expected、contract、RCO-5-008 组件和 cache 无修改。
- decision: `NO_PROMOTION_PAID_REPLICATION_BLOCKED / WAIT_SEPARATE_ZERO_CALL_CONTRACT_REDESIGN_AUTHORIZATION / RCO-6_BLOCKED / DO_NOT_LAUNCH`。

## 57. RCO-5-009 本机候选契约根治阶段启动 — 2026-09-04

- authorization_interpretation: 用户要求从第一性原理彻底根治并持续优化；本轮仅扩展为 0 次模型调用的隔离候选 index/contract/composer、已见 B8 回归和通过后全新 B9 首次本机门。没有再次付费、Secret、稳定接入、RCO-6 或部署授权。
- primary_claim: 本机枚举不可变动作/对象 candidate ID，模型只能逐候选分类和引用对象；不能自由写 action、创建 directive 或通过遗漏删除本机候选。
- failure_isolation: 单候选结构/分类错误只 quarantine 自身且不得 selected；来源绑定、目录指纹或覆盖账目失真才整例拒绝。
- sequencing: 计划先冻结提交；实现与已见 B8 回归全门通过并独立提交后才能创建 B9；B9 首次运行前必须冻结并推送。
- protected: B8 与既有 Expected/freeze/dataset/checkpoint/cache、RCO-5-008 组件和稳定路径不得修改。
- accounting_at_start: model/network/Repair/retry/Secret=`0/0/0/0/NONE`。
- status: `AUTHORIZED_ZERO_CALL_RCO-5-009 / IMPLEMENTATION_PENDING / B9_BLOCKED / PAID_MODEL_BLOCKED / RCO-6_BLOCKED / DO_NOT_LAUNCH`。

## 58. RCO-5-009 候选账本实现与已见 B8 分层回归 — 2026-09-04

- root_cause: B8 的 20 个真实动作中旧模型找对 18 个、漏 2 个，并多造 2 个修订状态动作。最终 5 个 Task FN 中，2 个来自模型漏项，3 个来自旧 composer 因单条坏动作整案清空；主因是“开放式枚举 + 整案连坐”，不是 API 或 temperature。
- contract_change: 本机生成绑定 source fingerprint、scope 和 UTF-16 位置的 action/object candidate ID；模型只能返回 candidateId + proposition/mention_only/uncertain + owned objectCandidateId，不能写 action、位置、语义、修订、requiresAction、effect 或 selected。
- object_policy: 复合/重复动作逐位置编号；共享前置或后置对象可由多个动作引用同一不可变 object span；同文不同位置不去重；只有对象候选唯一时才给本机默认。动作词嵌在对象名中时保留审计但不形成任务。
- failure_isolation: 来源/目录根绑定损坏才拒绝整例；missing、duplicate、unknown ID、坏 verdict、跨候选对象和越权字段只影响对应候选。quarantine 不进入 P4、不 selected；表外明确要求进入 unresolved scope，requiresAction 返回 unknown 而不是假 false。
- directed_tests: 新增 21 个候选目录/严格合同/composer 对抗测试及 3 个 B8 分层回归测试，覆盖稳定 ID、字符位置、复合/重复动作、前后共享对象、引号/断言诱饵、对象内动作词、空目录、目录篡改、缺失/重复/未知 ID、对象借用、模型越权、局部隔离、未知覆盖和本机修订。
- b8_oracle: 22 个本机候选中 20/20 Expected 动作可表达，2/2 明确诱饵为 non-task；Task F1/Complete 100%，unsafe/Forbidden/stale=0，三类修订与 unresolved 均准确。此项只证明已见答案在新合同下可表达。
- b8_legacy_diagnostic: 冻结 raw 的候选 Precision/Recall/F1 均 90%，漏项为 B8-07 已完成动作和 B8-11 修订旧侧，多造项为 B8-09“停止执行”和 B8-12“取消”。本机明确语法恢复 2/2 漏项，合法兄弟连带损失降为 0，最终产品层 Task F1/Complete 100%；恢复量不计入模型正确率。
- engineering: 定向 Vitest 24/24、RCO/B8 完整性 10/10、全量 lint PASS；Vitest 648 passed / 1 live OCR skipped，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO base integrity 4、Functions 5；build PASS；security scan 601 files PASS。保留既有大于 500 kB chunk warning。
- accounting: 模型/网络/verifier/Repair/retry/Secret=0/0/0/0/0/NONE；B8 旧失败结论保持，既有 Expected/freeze/dataset/checkpoint/cache 与稳定路径无修改，RCO-6 和部署未启动。
- decision: B8 SEEN ARCHITECTURE REGRESSION PASS / MODEL CLASSIFIER STILL 90% ON B8 / ELIGIBLE_TO_FREEZE_NEW_B9_AFTER_COMPONENT_COMMIT / PAID MODEL BLOCKED / DO_NOT_LAUNCH。

## 59. RCO-5-009A 新鲜对抗发现三项本机边界漏洞 — 2026-09-04

- sequencing: RCO-5-009 v1 已在 commit a618126 独立提交并推送；B9 尚未创建。随后使用不属于 B9 的四个新通用对抗夹具做首次审查。
- first_run: 4 个夹具 1 PASS / 3 FAIL。失败分别为同 scope 界面诱饵连坐真任务、对象内“已经核对”的动作词被拆成第二任务、条件事实跨过普通信息被远距离绑定；权威引文与示例引文对照通过。
- first_principles: 三项都是本机边界规则错误，继续调 Prompt 或直接创建 B9 只会把盲测当调试器。B9 保持未创建，先在新版本组件中修复，旧 v1 freeze 不修改。
- accounting: 模型/网络/verifier/Repair/retry/Secret=0/0/0/0/0/NONE；稳定路径、RCO-6、部署未触碰。
- status: RCO-5-009A ZERO-CALL PATCH AUTHORIZED_BY_CONTINUOUS_OPTIMIZATION / IN_PROGRESS / B9 BLOCKED / PAID MODEL BLOCKED。

## 60. RCO-5-009A 直接候选物化与局部修订安全门 — 2026-09-04

- second_root_cause: 修复最初三项边界后，独立审查仍判 BLOCK。原因是旧 P5 把候选交给 P4 后再按 `scopeId + action.surface` 反查；同 scope 同动作、条件前件、历史状态和对象 occurrence 会丢失。这是身份链断裂，不是再补几个关键词能解决的问题。
- direct_materialization: 新 P5 直接从 accepted candidate ledger 形成 `task:${candidateId}`；保留 origin candidate/occurrence ID、action/object 精确 span、clause role、currentness、condition truth/status。accepted candidate 与 owned object/task 强制双射，缺失时失败关闭。
- revision_locality: 新增 candidate-aware revision resolver，以原文 offset 和 currentness 解析关系；quarantine 只降低相关修订窗口的确定性，未决历史修订不再阻断后置独立当前任务。
- three_valued_actionability: 明确当前义务为 true；仍可能是义务但条件/动作/对象未决为 null；历史、已完成、否定、可选或第三方且覆盖完整时为 false。selected 仅由本机在当前、肯定、待办、有效、必需、收件人、安全动作和条件 true/none 时生成。
- adversarial: 聚焦 Vitest 49/49；独立复审 PASS。历史要求、条件前件、同 scope 条件真值、重复同字动作、sibling quarantine、修订歧义局部影响、模型未知 ID 和双射篡改均通过。
- b8_seen_replay: 20/20 expected action 可表达；Task P/R/F1 与动作对象边界 100%，合法 sibling collateral loss=0，三类修订/unresolved 精确，unsafe/Forbidden/stale/selected-stale=0。冻结旧模型 candidate P/R/F1 仍为 90%/90%/90%，2 漏、2 多造，不把本机挽救记作模型准确率。
- frozen_label_conflict: B8-12 冻结 Expected 把“旧任务/原任务……上述任务取消”仍记为 future/pending/active 和 requiresAction=true；新安全策略将两项保留为历史审计项、状态/有效性未知且不选。Expected 未修改，冲突显式列账，所以 Complete=11/12；不为凑分恢复不安全语义。
- experiment_limit: B8 全部 20 个 expected action 都是 local_proposition，没有真实 needs_model；本轮只能证明本机架构，不能证明 classifier 泛化。B9 必须覆盖 needs_model、多对象闭集、重复 occurrence、局部坏响应、修订窗口和 OOV。
- engineering: lint PASS；build PASS，仅保留既有大于 500 kB chunk warning；security scan 617 files PASS；完整 npm test 合计 763 passed、1 skipped、0 failed，另有 contract checks 2/2。唯一 skip 是需显式环境变量的 live OCR，因此本轮不构成真实 OCR 证据。
- accounting: model/network/verifier/Repair/retry/Secret=0/0/0/0/0/NONE；既有 Expected/freeze/dataset/checkpoint/cache 与稳定路径未改，RCO-6 和部署未启动。
- status: RCO-5-009A ADVERSARIAL_PASS / B8_SEEN_ARCHITECTURE_PASS_WITH_FROZEN_LABEL_CONFLICT / PENDING_FULL_GATES_AND_COMPONENT_FREEZE / PAID_MODEL_BLOCKED / DO_NOT_LAUNCH。

## 61. RCO-5-009-B9 首次零调用失败、根因分账与后续门 — 2026-09-05

- sequencing: B9 数据先在 commit `9812382` 冻结；runner 在 `3ffe3fd` 冻结并推送。运行前复现检查发现 manifest 错把动态上游 HEAD 当固定条件，因此保持 0 次运行；修复来源提交绑定并推送 `053e3ed` 后，才执行唯一一次 B9。
- terminal: run `rco-5-009-b9-zero-call-20260904a` 为 `COMPLETED / gate FAIL`；12/12 案例各执行一次。自运行开始 B9 已见，禁止重跑或修改 B9 追分。
- accounting: model/network/verifier/Repair/retry/Secret=`0/0/0/0/0/NONE`；pipeline 1，case executions 12。
- observed: 19/19 候选身份、位置、处置和对象精确；13/13 任务双射、语义和 selected 精确；safe default 7/7，unsafe/extra default 0，sibling survival 1；`requiresAction` 11/12。
- semantic_failure: B9-07 冻结要求 `requiresAction=false`，实际为 `null`。旧任务未默认勾选，但“不确定归属”命题和“流程作废”修订均未完整解决；`false` 表示确定无当前义务，`null` 表示仍不能安全判定，两者不能为了分数互换。另需在完整命题层判断“核对 X 是否……尚未说明”到底是信息缺失陈述还是指令。
- evaluator_failure: 冻结和实际计数逐项一致，却因 ledger count 对象的键插入顺序不同被 `JSON.stringify` 误报 `EXPECTED_COUNTS_DO_NOT_MATCH_DATA_FREEZE`。这是计分器 bug，不是识别错误；旧结果原样保留，修复只能进入新版本/B10。
- label_limit: B9-12 原文明确条件已经发生，冻结 Expected 却保留 condition unknown 以测试实现边界；该标签不是独立语义真值，禁止据此宣称语义准确。
- result_verifier: 首次检查 7 项中 6 项通过；唯一失败是预登记 `gate === PASS` 断言与实际 FAIL 一致。不得再次运行该成功门追分。
- evidence_boundary: 单作者匿名合成 Development + 冻结本机闭集 oracle fixture；不构成模型准确率、OCR、图片/文件、真实去标识材料、独立人工 GT、真人修改时间、浏览器或商业上线证据。
- protection: 既有 Expected/freeze/dataset/checkpoint/cache、B9 原始运行产物和稳定路径不改；RCO-6 未启动，未部署。
- next: 先冻结本次结果；随后执行 RCO-5-010 零调用根治：顺序无关结构比较、三值 actionability 充分条件、完整命题语法、语义真值/实现边界双标签。已见 B9 只作回归；新 B10 必须独立无上下文双审后冻结，首次本机门通过才可申请付费模型。
- decision: `B9 FAIL / RETAIN_RESULT / NO_RERUN / NEXT RCO-5-010 ZERO_CALL / PAID_MODEL_BLOCKED / RCO-6_BLOCKED / DO_NOT_LAUNCH`。

## 62. RCO-5-009-B9 唯一失败结果冻结与工程复核 — 2026-09-05

- result_freeze: runner freeze、checkpoint、result、report 和阶段 tracker 共 5 个不可变路径已写入 `RCO-5-009-B9_ZERO_CALL_RESULT_FREEZE.json` 并逐项 SHA-256 绑定；全局 context/log 明确列为可更新镜像，不进入递归哈希。
- integrity: freeze 生成后复现检查 PASS；结果冻结 4/4，B9 数据/runner/result与 RCO-5-009/009A 组件联合完整性 19/19 PASS。
- engineering: lint PASS；全量测试 Vitest `711 passed / 1 live OCR skipped`，另 server 8、Worker 25、time parity 1、multimodal evaluator 23、RCO base integrity 4、Functions 5；build PASS，仅保留既有大于 500 kB chunk warning；security scan `639 files` PASS；npm audit `0 vulnerabilities`。
- evidence_boundary: 唯一 skip 是需显式环境变量的 live OCR；上述工程绿灯不改变 B9 质量 gate FAIL，也不构成模型、OCR、浏览器、真人效率或商业上线证据。
- protection: 没有改 B9 或任何既有 Expected/freeze/dataset/checkpoint/cache；没有重跑 B9 成功门，未接稳定路径，RCO-6 未启动，未部署。
- decision: `B9 FIRST RESULT IMMUTABLY FROZEN / OVERALL FAIL / NEXT RCO-5-010 ZERO_CALL / PAID MODEL BLOCKED / DO_NOT_LAUNCH`。

## 63. RCO-5-010 完整命题与三值行动性根治启动 — 2026-09-05

- authorization_interpretation: 用户要求从第一性原理彻底根治并持续优化；当前只延续 0 次模型调用的隔离本机修复和已见 B9 诊断，不扩大到付费调用、稳定接入、RCO-6 或部署。
- root_problem: 动作词不等于动作命题；`selected=false` 不等于无需行动；`false` 与 `null` 分别代表完成排除证明和证据不足。B9 还暴露了 JSON 对象键顺序造成的计分假失败。
- architecture: 新增完整 scope 命题裁决，只做可证明的本机非任务降级；新增独立三值行动性决策与理由码；新增对象键顺序无关、数组顺序敏感的结构比较。旧 B9 链和结果不改。
- label_authority: 后续数据分离 `semanticTruth`、`implementationExpectation`、`reviewStatus` 和完整证据范围；B9-12 保留为不可用于语义正确率的实现边界标签。
- validation: 先做定向/属性变形/新鲜对抗，再做 `SEEN_B9_DIAGNOSTIC_REPLAY`。全门与独立审查通过才允许创建 B10；B10 必须先双路无上下文复核并冻结。
- accounting: model/network/verifier/Repair/retry/Secret=`0/0/0/0/0/NONE`。
- protection: 不修改任何既有 Expected/freeze/dataset/checkpoint/cache/B9 运行产物，不接稳定路径，不启动 RCO-6，不部署。
- status: `RCO-5-010 PLAN_READY / IMPLEMENTATION_PENDING / B9_READONLY / PAID_MODEL_BLOCKED / DO_NOT_LAUNCH`。

## 64. RCO-5-010-E1 审查失败后恢复 — 2026-09-05

- authority: 用户明确“继续执行”，恢复 E1 零调用修补；只在本轮门内恢复，不创建 B10，不付费、不接稳定路径、不部署。
- start_snapshot: branch `codex/e2-multimodal-recognition-exp`，HEAD/upstream `c67e59e`；RCO-5-010 新增实现/测试/已见诊断未提交，tracked 受保护文件无修改。
- prior_failures: 前轮审查发现词内请、外层转述/问句、多字符要求与名词化冲突、候选对象篡改可自证。93 项定向通过未证明这些反例通过；前轮 FAIL 原样记录。
- stop_level: `REJECT_CANDIDATE`；用户恢复仅允许在原门修补，定向与独立审查通过之后才做全量工程门。
- changes: 正向 governor 逐位置解析；外层问句/冒号语境与名词化竞争保持未知；从原文重建 scope/catalog 逐项比对；异步前快照。selected 与行动性继续分离。
- directed: 6 文件 107/107；独立审查进行中；全量工程门、冻结、提交未开始。
- accounting: model/model-network/verifier/Repair/retry/Secret/CNY=`0/0/0/0/0/NONE/0`。Git 与依赖审计网络不属于模型实验请求。
- protection: 既有 Expected/freeze/dataset/checkpoint/cache、旧 B9 runner/结果不变；B9 FAIL，已见数据仅回归；RCO-6 与部署未启动。

## 65. RCO-5-010-E1 机制复核与全量门通过 — 2026-09-05

- review_history: 新鲜审查发现未证明多字governor回退放行、整窗问号连坐；相邻变形进一步发现吗+逗号失配。统一未证明标记隔离、原文绝对slice/换行边界和分句语气终止符后，独立内存攻击复核PASS；先前FAIL保留，不删除或弱化测试。
- independent_review: `/root/e1_resumed_review` 初始无上下文、只读；最终相关三文件108/108，报告 `RCO-5-010_E1_AUDIT.md`。仅为同系列代码机制复核，不是跨模型或人工语义真值。
- directed: 六文件122/122；遍历20,992个基本汉字bridge，四个明确允许单字另有正例；不能当成20,992份语义材料。
- engineering: 一次完整lint/test/build通过；Vitest833 passed/1 live OCR skipped，适配器66 passed，合计899 passed/1 skipped/0 failed。安全扫描PASS，依赖audit0漏洞。保留已有>500 kB chunk提示。
- safety_supplement: 全门后增加已见B9额外默认和内部违规断言并通过3/3，类型/lint再次通过；原文、动作、对象和条件的篡改拒绝及异步快照均有测试。
- protected: B9/009/009A联合保护检查19/19；原B9与此前诊断产物均未重写，旧一次性runner没有运行。B9行动性11/12，额外/内部违规默认0；历史FAIL和B9-07/B9-12标签边界保留。
- next: 生成新组件冻结并核验，独立提交推送后停止。正式提交SHA以Git为准；不创建B10，不付费，不接稳定路径、不启动RCO-6、不部署。
- accounting: model/model-network/verifier/Repair/retry/Secret/CNY=`0/0/0/0/0/NONE/0`。

## 66. RCO-5-010-E1 组件冻结与交付准备 — 2026-09-05

- freeze: `RCO-5-010_COMPONENT_FREEZE.json` 新建后只读核验25路径SHA-256，联合旧B9/009/009A保护检查20/20。动态context/log不进入递归哈希。
- delivery_message: `fix(app): verify source and proposition scope before safe selection`。提交与推送结果以该Git提交及upstream为准；本日志不预报远程成功。
- status: `LOCAL_VERIFIED_AND_FROZEN / NO_PRODUCT_PROMOTION`。交付后停止；B10/付费模型/RCO-6/稳定接入/部署未授权且未执行。

## 67. RCO-DOCS-002 主线重整启动 — 2026-09-05

- authority: 当前用户要求重新制作优化 AGENTS/PRD、功能范围、详细路线、注意事项、优化/目标提示词及上下文流程；本次仅授权文档，不含产品实现、识别模型调用、真实材料、真人研究或部署。
- start_snapshot: `codex/e2-multimodal-recognition-exp`；HEAD/upstream tracking=`60332e16ebb062c4af0fa85531212286ab020a23`；工作区干净。已在本轮工具会话保存644个tracked文件的SHA-256基线；只允许AGENTS、PRD、总计划、提示词、动态context与本日志变化，其余tracked文件须逐个保持原哈希。
- authority_correction: 本日志第1/2节和旧计划的“当前”措辞是此前阶段快照，不代表最新状态；最新已完成代码阶段为010-E1。恢复时按有编号的最新追加记录核对Git，禁止根据旧索引重新启动B0或RCO-0。
- intent: 保留安全底座，将后续RCO-5交付聚焦整份通知的时间/材料/任务/证据完整性及真实确认链路；规则覆盖与模型语义质量分开，工程/合成/真人/发布证据分开。
- protection: 不修改既有Expected/freeze/dataset/checkpoint/cache、历史报告、一次性runner及商业验证契约；不创建B10、不进入RCO-6、不接稳定路径、不部署。
- accounting: product_model_calls=0；model_network_requests=0；Secret_access=NONE；experiment_cost_cny=0。文档读者审查属于开发协作，不是被测识别API请求，Codex使用量不混记成产品实验账单。
- status: `RCO-DOCS-002 IN_PROGRESS / IMPLEMENTATION_WAIT_AUTHORIZATION / DO_NOT_LAUNCH`；后续记录验证与交付，不预先宣称通过。

## 68. RCO-DOCS-002 文档重整与读者复核 — 2026-09-05

- changes: 更新根AGENTS与PRD v0.9，重写总计划/优化目标恢复提示词/短交接；新增12项功能清单、语义职责、确认状态、首次/最终结果与真人计时设计，后续工作包归于既有RCO-5，不从RCO-0重启。
- priorities: 先MAINLINE-01隔离端到端上限，再MAINLINE-02候选表达/职责，最后MAINLINE-03另批付费配对；G5质量过门后才申请RCO-6。开发优先格式不缩减正式商业矩阵。
- reader_review: doc-coauthoring无上下文辅助读者8问通过；发现PRD14.6旧“模型输出逐字证据”与新引用规则冲突，修为本机还原并获得解除确认；同系列开发审查不等于人工语义真值或商业验收。
- validation: 初轮文档检查34/34，diff与安全扫描通过；加入报告后的最终检查见RCO_DOCS_002_CHECKS.json。638个非本轮修改范围的原tracked文件逐个哈希未变；旧日志内容仅追加。未重跑产品lint/test/build或历史runner，前轮899测试不计为本轮成绩。
- artifacts: RCO_DOCS_002_REVIEW.md、RCO_DOCS_002_CHECKS.json；CURRENT_CONTEXT保持短交接。原商业验证契约字节不变、仍未批准，既有Expected/freeze/dataset/checkpoint/代码/runner/result不变，B9历史FAIL保留。
- accounting: product_model_calls/model_network/verifier/Repair/retry/Secret/experiment_CNY=`0/0/0/0/0/NONE/0`；未采集真实材料/真人数据，未启动RCO-6，未部署。Codex读写文档与辅助审查用量不混作产品模型实验费用。
- delivery: 计划单独提交`docs(product): refocus recognition roadmap on complete task outcomes`并推送；实际SHA/远程结果以Git及交付答复为准，不预报成功。
- decision: `DOCS_READER_VERIFIED / NO_PRODUCT_PROMOTION / NEXT RCO-5-MAINLINE-01 WAIT_AUTHORIZATION / DO_NOT_LAUNCH`；本次文档交付后停止，不自动执行可复制提示词。

## 69. RCO-5-MAINLINE-01 隔离端到端启动 — 2026-09-05

- authority: 用户明确授权人工工程响应→真实客户端组件→确认→新建测试数据库/内存repository；不测模型正确率，不宣称G5通过。
- baseline: HEAD/upstream=`282fd99dde1ca4f31fa3170bcdf57450e9c49b46`；分支`codex/e2-multimodal-recognition-exp`；起始干净，646个tracked文件已保存实际字节SHA-256。
- scope: 仅新增隔离适配、夹具、测试入口、测量设计和报告；CURRENT_CONTEXT更新、本日志追加。其余原tracked文件644个必须不变。
- chain: 复用CapturePersistenceService、RecognitionResult 2.0校验、legacyView、DraftReviewPanel、DomainCommitPlan和CanonicalWorkspaceRepository；不导入App或线上识别服务。人工响应显式标记，不声称产品整体已接新研究链。
- stop: 冻结/公共组件缺口只报告；最多两轮本轮新增代码局部修补；不得为PASS绕过冻结契约。旧B9 runner/result、Expected/freeze/dataset/checkpoint/cache、稳定路径不动。
- accounting: model/model-network/verifier/Repair/retry/Secret/CNY=`0/0/0/0/0/NONE/0`；真人数据0；不创建B10、不启动RCO-6、不部署。开发协作审查不是被测识别API。
- status: `IN_PROGRESS / MODEL_ACCURACY_NOT_MEASURED / NO_PROMOTION`。

## 70. RCO-5-MAINLINE-01 隔离链路验证与失败诊断交付 — 2026-09-05

- changes: 只新增人工工程夹具、真实capture/legacyView/domainCommit/repository编排、DraftReviewPanel测试入口、新前缀IndexedDB适配、定向/字段对照、保护/工程门脚本及测量/审查/报告；既有产品和研究代码未改。
- outcome: `ISOLATED_CHAIN_ESTABLISHED / ACCEPTANCE_FAIL / NO_PROMOTION`。8人工场景：来源8/8保留、7/7可构造响应持久化完全一致、1 unknown因契约不可表达明确失败。不是模型正确率或新盲测。
- main_cause: 同一双任务42字段，直接domain42/42，经真实客户端投影40/42；两处未编辑时间rawText被标准值覆盖，完整案例0/1。浏览器实际读回同样改写。公共代码不在本轮修改范围，未绕过掩盖。
- browser: 真实DraftReviewPanel确认→隔离IndexedDB，1场景7步覆盖部分确认/重复确认/刷新读回/工程编辑/剩余确认/事务失败；正式记录未确认写入0、重复0、已确认任务覆盖0、原文与记录丢失0，但时间字段改写2，不能笼统宣称丢失0。额外执行依据定位检查。非完整App、Chrome/Edge/手机或真人验收。
- independent_review: 无上下文只读审查者`/root/mainline01_independent_review`独立17/17，重跑字段对照42/42与40/42；提出unknown不能填false，新增夹具修补1轮，改为显式失败且保留分母。解除诊断交付阻断，不解除产品验收FAIL。另补新构建产物扫描，审计CLI必填不再可静默省略。
- engineering: lint、app/node类型、Schema/时间契约检查通过；Vitest850 passed/1 live OCR skipped，6适配器组66 passed，共916 passed/1 skipped/0 failed；新临时构建、源码安全扫描、新构建扫描/隔离检查、npm audit通过（0漏洞）。已有>500 kB chunk警告保留。使用不加载.env、不用旧实验缓存的等价工程门；cloudflare:check不适用且未运行，不读取Wrangler凭证。
- protection: 644/644非本轮可改原tracked文件实际字节SHA-256未变；旧日志前缀字节不变。Expected/freeze/dataset/checkpoint/冻结组件/契约/历史runner/result未改；旧实验cache未调用/重写。长日志、新build和工程审计临时缓存留在独立临时目录，见mainline-01/ENGINEERING_CHECKS.json。
- accounting: model/model-network/verifier/Repair/retry/Secret/CNY=`0/0/0/0/0/NONE/0`；真人数据0；模型识别准确率=本轮未测量；未创建B10、未启动RCO-6、未接稳定路径、未部署。
- delivery: 计划单独提交`test(app): establish isolated recognition confirmation diagnostics`并推送当前分支；实际提交SHA/远程结果以Git和交付答复为准。
- next: 完成诊断交付后停止。最小下一授权为MAINLINE-01-P1：明确新版本/公共文件范围，仅修确认边界（显示值与实际编辑区分、时间原文保真、无日期与模糊时间分离）；随后才讨论MAINLINE-02条件/修订表达。不自动申请或执行付费模型。

## 71. MAINLINE-01-P1 范围确认与固定交付规则 — 2026-09-05

- authority: 用户要求先明确P1新版本/公共文件范围，以及每次执行后上传Git、提供审计、下一步及理由/提示词。本轮仅制定范围与交付文档，不把“建议P1”当作冻结组件或公共代码的无界修改许可。
- baseline: `e67314ecb3ba42495b5f50a3732d8a59fa5a5436`已核对Git，分支`codex/e2-multimodal-recognition-exp`起始干净；666个原tracked文件实际字节SHA-256记录于本轮工具会话。
- allowed_docs: AGENTS新增固定交付规则，CURRENT_CONTEXT更新，本日志追加，mainline-01-p1新计划/提示词/审计。本轮代码、Expected/freeze/dataset/checkpoint/cache、MAINLINE-01历史产物不改。
- proposal: 仅拟申请domainCommit.ts与DraftReviewPanel.tsx的显式V2增量，新确认模块/隔离入口复用现有事务，旧默认行为保持；App与稳定路径仍不接。V2过门后必须再申请实际App接入及下游无日期验收，不能无限停在隔离演示。
- fixed_delivery: 每次执行后安全单独提交推送、核验远程SHA，提供审计报告及下一步/原因/授权提示词；无持久化改动的只读咨询不制造提交。该要求写入AGENTS12.6，不写全局记忆。
- accounting: model/model-network/verifier/Repair/retry/Secret/CNY=`0/0/0/0/0/NONE/0`；未运行产品测试或历史runner、未创建数据/真人研究、未部署。上一轮916测试与40/42是历史证据，本轮不重新计分。
- status: `P1_SCOPE_PROPOSED / CODE_NOT_STARTED / NO_PROMOTION`；文档检查与交付将另追加，不预报完成。

## 72. P1范围提案读者复核与文档交付 — 2026-09-05

- review: doc-coauthoring空上下文读者`/root/p1_scope_reader`5问正确复述；澄清“模型verifier=0不禁本机校验”和“新脚本调用旧公开路径复现，不运行旧一次性runner”两处表述歧义。
- checks: 本轮文档/diff/源码安全/保护检查；666个原tracked文件中3个获准动态规则文档变化，其余663/663实际字节SHA-256未变，旧日志前缀字节不变；未重跑上一轮916项产品测试，不创建新数据。
- artifacts: mainline-01-p1/PLAN.md、NEXT_PROMPT.md、SCOPE_AUDIT.md、SCOPE_CHECKS.json；AGENTS12.6固化每轮Git/审计/下一步理由/提示词交付，短交接指向精确计划。
- boundary: 仅完成P1范围/文档，未实施两个公共文件修改；旧40/42、unknown缺口、旧App拦截和历史FAIL不变。0产品模型调用、0密钥访问、0模型费用、不接稳定路径、不部署；未写全局记忆。
- delivery: 单独文档提交并推送当前分支；最终SHA/远程结果以Git及答复核验为准。状态`DOC_SCOPE_REVIEWED / P1_IMPLEMENTATION_WAIT_AUTHORIZATION / NO_PROMOTION`，交付后停止。

## 73. MAINLINE-01-P1 实施授权与保护快照 — 2026-09-05

- authority: 用户明确批准已提交PLAN白名单；公共代码仅domainCommit.ts、DraftReviewPanel.tsx显式V2增量；默认行为、历史40/42和FAIL保持。
- baseline: HEAD=fbd6c4b67c9a9c30b9301f6648e7bca82b6aeb64；起始干净，670原tracked实际字节SHA-256已存新IMPLEMENTATION_BASELINE.json；666个原文件只读，日志旧前缀保护。
- scope: 沿用旧人工工程响应和42字段，不新建dataset，不运行旧一次性runner，不读密钥，不接稳定入口，不部署。产品模型调用/费用=0；当前只开始实施，不预报测试通过。

## 74. P1 V2 独立审查失败与立即停止 — 2026-09-05

- targeted: 旧17不改、新28，共45通过；新V2同口径42/42，旧40/42与历史FAIL保持。首轮未知条件异常接收测试失败，仅补明确拒绝与失败状态断言后通过；app类型检查通过。
- review: 无上下文审查者/root/p1_v2_independent_review复跑45通过；5组阻断：材料/事件时间归属丢失、相关实体冲突漏拦、非explicit错误默认勾选、时区显示/保存不一致、逐字编辑缓冲缺失。前4组程序反例，第5组静态审查；不把未执行逐键测试算实测。
- stop: 可选建议保留selected=true时仍默认勾选且可确认，至少1反例，触发PLAN停止条件；REJECTED_STOPPED_WAIT_AUTHORIZATION/NO_PROMOTION。停止后不再功能修补，不跑后续全量门、不建立组件freeze；解除须用户新授权，仅恢复原P1确认边界，不晋级。
- browser: 仅初始化0正式任务、展开真实面板、整串时间修改独立持久化读回；确认/刷新/重复/回滚/无日期验收未完成。测试页和9551本机服务关闭，测试库保留不删除。
- protection: 670原tracked中4个获准变化，其余666实际字节SHA-256不变，日志旧前缀不变；旧Expected/freeze/dataset/checkpoint/cache、组件、MAINLINE-01、历史runner/result不改。
- artifacts: mainline-01-p1/IMPLEMENTATION_AUDIT.md、INDEPENDENT_REVIEW_IMPLEMENTATION.md、REJECTED_SNAPSHOT.json、FAILED_IMPLEMENTATION.patch、NEXT_REPAIR_PROMPT.md。失败源码补丁仅是恢复/审计证据，不是已验证功能。
- delivery: 只将失败审计、保护/源码快照证据和交接文档检查后提交推送；活动业务代码留本机未提交，工作区预期非干净，禁止重复应用补丁或回滚。最终审计SHA/远程状态以Git与交付答复为准。
- accounting: 外部识别模型/模型网络/verifier/Repair/retry/密钥访问/CNY=0/0/0/0/0/0/0，模型准确率本轮未测量；不新建数据、不接稳定入口、不启动RCO-6、不部署。本轮停止，不自动执行P1-R1。

## 75. P1-R1 已登记确认边界修复授权 — 2026-09-05

- authority: 用户明确授权P1-R1原白名单修复5组已登记反例；先测试复现，再同根因最多两轮局部修补，新审查无阻断后才完整工程门与真实隔离存储验收。不重复应用FAILED_IMPLEMENTATION.patch。
- baseline: HEAD/upstream=644789d9be866bf5e048f3014f673b177a68be5d；8个失败源码哈希全匹配，旧666保护项不变；现场仅预期的8源码变化。本轮677原tracked/673只读见R1_BASELINE.json。
- boundary: “apikey在剪贴板如需可调用”不改变本轮明确0模型和不访问密钥范围；本轮不需要模型，保持0请求/0元，不读剪贴板，不改旧数据/冻结/历史结果，不接App或稳定入口，不部署。
- status: RESUMED_FOR_REGISTERED_REPAIRS / IN_PROGRESS / NO_PROMOTION；既有失败保持，本次完成与否由新证据决定。

## 76. P1-R1 新鲜审查阻断与失败证据交付 — 2026-09-05

- implementation: 一轮局部修补已登记5组确认边界：非explicit安全默认选择、相关实体引用/冲突、不能承接事件显式阻断、date-only时区、正常编辑缓冲/显式保存。公共代码仍仅domainCommit.ts与DraftReviewPanel.tsx显式V2；业务实现未验收。
- targeted: 修补前9失败/45通过；修补后58通过（旧17+原V2 28+R1新增13），新V2同旧人工响应42/42，旧40/42及历史FAIL原样保留。初步app类型通过，不代表全量工程通过。
- review: fork_turns=none的/root/p1r1_fresh_review独立复跑58/58及673/673保护；新内存反例：d0.type=planned_start时，保存新deadline获接受且无阻断，确认后canonical仍旧值。原任务仍explicit，不把此反例误称非任务误选或估算总体误选率。
- root_cause: 编辑入口按单个关联时间允许修改，提交器按时间类型排除planned_start/event_start/event_end的deadline覆盖；保存与提交采用范围不一致。无需模型或关键词规则，最小下一步是统一可编辑/可提交范围。
- stop: 新反例超出本轮已登记修复范围；立即停止源码修补、全量工程门与实际浏览器验收，不建立组件freeze。状态REJECTED_STOPPED_WAIT_AUTHORIZATION/NO_PROMOTION；本轮没有完成面板→测试库确认→刷新读回。
- artifacts: R1_BASELINE、R1_RED_TESTS、R1_TARGETED_TESTS、R1_BROWSER_PROTOCOL、R1_INDEPENDENT_REVIEW、R1_REPRODUCTION、R1_AUDIT、R1_REJECTED_SNAPSHOT、R1_NEXT_PROMPT与交付检查。旧失败patch/snapshot/审计完全保留，不重复应用。
- protection: 677原tracked中的673保护文件实际字节SHA-256未变，旧日志前缀保持；当前9代码文件哈希保存于R1_REJECTED_SNAPSHOT，不是通过组件冻结；Expected/freeze/dataset/checkpoint/cache/历史结果/旧runner不改。
- delivery: 按固定Git要求只提交推送失败证据和短交接；业务代码、新测试与两脚本保留本机未提交，不作为通过版本上传。最终文档SHA/远端状态以Git核验与交付答复为准。
- next: 建议P1-R2，仅修已登记时间类型/提交采用范围，先反例测试，正常路径不得一并拒绝；审查通过后才完整门与真实浏览器验收。提示词见R1_NEXT_PROMPT.md，未自动执行。
- accounting: 外部产品模型/模型网络/verifier/Repair/retry/密钥访问/CNY=0/0/0/0/0/0/0；模型准确率本轮未测量，不读取剪贴板，不新建数据/B10，不接稳定入口，不启动RCO-6，不部署。

## 77. P1-R2 时间编辑采用范围修复授权 — 2026-09-05

- authority: 当前用户明确授权仅修R1登记时间类型/提交采用范围不一致；先反例测试，同根因最多两轮，新无上下文审查通过后才全量与真实浏览器验收。原PLAN白名单不扩张。
- baseline: HEAD/远端=d45467d3cae849342dac9e6b3cc222127e650fa9；R1_REJECTED_SNAPSHOT九源码哈希全匹配，无重叠用户修改。R2_BASELINE记录687原tracked/683保护项，旧R1及更早证据只读；没有重复应用旧补丁。
- accounting: 模型/模型网络/verifier/Repair/retry/密钥访问/CNY=0/0/0/0/0/0/0；不读剪贴板，不新建数据/盲测，不运行旧一次性runner，不接稳定路径，不启动RCO-6，不部署。
- status: IN_PROGRESS/NO_PROMOTION；开始只写复现测试，不预先宣称通过。

## 78. P1-R2 隔离V2时间编辑采用一致性验收 — 2026-09-05

- implementation: 同根因1轮修补；V2共享现有提交器时间类型支持范围，拒绝planned_start/event_start/event_end编辑，真实计划试算后才写历史，正式提交检查用户值/计划/canonical一致。原接口/default、原文和首次响应不改，正常支持路径/无日期/兄弟项保留。
- targeted: 新红测试6失败/62通过；修补后68/68（旧17+原V2 28+R1 13+R2 10），旧40/42及历史FAIL不改，新V2同人工响应同42字段为42/42。
- independent: /root/p1r2_independent_review，fork_turns=none，只读；独立68/68，另14/14内存检查，未发现阻断。额外审查脚本空对象原型断言错误已单列，非产品失败，未改源码或弱化门槛。
- engineering: 新鲜审查通过后完整工程只跑1次，967通过/1 live OCR跳过/0失败；lint、app/node类型、Schema/时间契约、新临时构建、源码安全、新构建隔离与依赖审计通过，0漏洞。cloudflare:check非发布未跑，原>500 kB构建警告保留。长日志见R2_ENGINEERING_CHECKS.json。
- browser: R1协议8/8与补充双项批量确认通过，真实面板V2/真实repository/新IndexedDB；逐键输入、明确保存、部分/批量、刷新/重复/回滚/无日期/人工date-only/模糊阻断均验证。5测试页error日志0，0未确认写入/错误默认/重复/覆盖/丢失仅限实测工程场景，不推断总体率。观察脚本定位/旧标签页绑定错误在报告单列，未冒充产品结果。
- protection: 687原tracked中683保护文件实际字节SHA-256不变，旧日志前缀保持；R1及更早Expected/freeze/dataset/checkpoint/cache、组件、旧runner/result不改；未重复应用FAILED_IMPLEMENTATION.patch。R2_IMPLEMENTATION_SNAPSHOT记录当前九源码，不改旧freeze。
- delivery: 验收后单独提交推送业务实现及新报告，提交信息fix(app): verify isolated V2 time edit adoption，核对远端；最终SHA/工作区状态以Git回执与交付答复为准。测试页3–7和本机2623服务已关闭，五个测试库保留。
- boundary: ISOLATED_V2_VERIFIED/MAINLINE_PRODUCT_NOT_INTEGRATED/NO_G5_PROMOTION；旧App日期拦截、任务中心/日历/提醒无日期承接未改。unknown条件、事件和不安全关系编辑仍明确受限。不宣布产品商用或模型准确率提高。
- next: 完成后停止；下一建议MAINLINE-02-SCOPE仅定向审计实际入口/无日期下游和精确白名单，再申请接入实施。详R2_NEXT_PROMPT.md，不自动执行、不再新建数据或换模型。
- accounting: 外部产品模型/模型网络/verifier/Repair/retry/密钥与剪贴板访问/CNY=0/0/0/0/0/0/0；模型准确率本轮未测量，开发Codex用量另计。无人类数据/真实材料/新盲测/B10/RCO-6/稳定入口或部署。

## 79. MAINLINE-02-SCOPE 定向只读审计授权 — 2026-09-05

- authority: 当前用户只授权实际App接入确认V2及无日期下游的源码审计、精确实施白名单和验收设计；不授权代码实现。仅新增本阶段文档，更新短交接及追加日志。
- baseline: 起始HEAD与远端均为9c5ec0bc5c85c9ce339defd100c6d6958e94776e，工作区干净；R2九源码匹配，原683保护检查通过。本阶段705原tracked，除两个动态文档外703只读，见mainline-02-scope/BASELINE.json。
- scope: 从R2交付继续，追踪实际App、确认交接与无日期下游，不重审历史RCO，不改Expected/freeze/dataset/checkpoint/cache、Schema/repository/validator或历史结果。
- accounting: 外部产品模型/模型网络/密钥与剪贴板访问/部署=0/0/0/0，产品模型费用0元；模型识别准确率本轮未测量。状态AUDIT_IN_PROGRESS / IMPLEMENTATION_NOT_AUTHORIZED / NO_G5_PROMOTION。

## 80. MAINLINE-02-SCOPE 定向审计与实施白名单交付 — 2026-09-05

- outcome: 实际App未传V2面板props，单项/面板批量/收件箱批量均走旧确认，真正无日期也被拦；旧视图自动保存不能承担V2首次响应与编辑交接。本轮只读定位，无源码修改。
- downstream: 无日期任务能进任务中心但被标待核对、首页有异常加分；日历无独立任务列表；详情日期必填、提醒默认与ICS依赖deadline；v8/JSON本身可保留0时间。静态风险不是已误发/已丢失，也不是本轮浏览器测量。
- proposal: 唯一下一包MAINLINE-02-I1，真实App+显式实验runtime+新测试库，9已有文件、8新源码/测试及2脚本精确列名；旧默认不变，不改repository/Schema/迁移/validator或R2确认器。核心主链须成功，正式任务编辑/执行/真实提醒/ICS等明确未纳入，不能靠全禁用通过。
- review: 新无上下文/root/mainline02_scope_review只读复核；两项文档阻断（白名单外UI不能预禁用、下一提示词缺绝对仓库）已改并复核闭合；提交称谓小错也更正。无剩余文档/范围阻断，不是实现审查或产品验收。
- protection: 705原tracked中703源码/既有文档与证据实际字节SHA-256不变；R2九源码匹配、旧日志前缀保持、越权路径0。CURRENT_CONTEXT80行；文档diff/敏感信息检查见CHECKS.json。未重跑全量工程或浏览器、不运行旧runner。
- delivery: 仅新mainline-02-scope范围报告/白名单/检查设计/提示词/保护与复核证据，以及短交接/追加日志；单独docs(product)提交推送并核对远端，最终SHA以Git回执为准。完成后停止，MAINLINE-02-I1等待授权。
- accounting: 模型/模型网络/verifier/Repair/retry/密钥与剪贴板访问/人民币费用均0；模型识别准确率本轮未测量。没有真实用户材料、真人研究、新数据集、RCO-6或部署；Codex开发用量另计。

## 81. MAINLINE-02-I1 实际App隔离接线授权 — 2026-09-05

- authority: 当前用户明确批准SCOPE精确9已有+8新源码测试+2脚本，旧默认不变；只用旧人工工程响应，0模型，不改Schema/repository/确认器，不部署。
- baseline: HEAD/远端1657fb9a5b47504e7264a841b919d4765a710233，工作区干净；R2九源码和SCOPE703保护匹配。I1_BASELINE记录712原tracked，11个现有路径获准（9代码+2动态文档），其余701保护。
- sequence: 失败复现→同根因最多两轮局部修补→定向/对抗→新独立审查→一次全量及实际浏览器→保护/Git交付；当前IN_PROGRESS，不预先声称通过。
- accounting: 产品模型/模型网络/费用/密钥与剪贴板访问/真实材料/真人/部署均0；模型识别准确率本轮未测量。

## 82. MAINLINE-02-I1 工程通过、浏览器未完成，仅交付失败审计 — 2026-09-05

- outcome: NOT_ACCEPTED / BROWSER_INCOMPLETE。19源码/脚本本机未提交保留，只有审计文档与短交接提交推送；不得宣称业务完成/G5通过。
- implementation: 按9公共+8新源码测试+2脚本接真实App隔离runtime、真实capture/canonical/V2；真正无截止查询/显示/保存，不改默认入口与受保护契约。
- tests: 先3红；新测试构造更正单独说明，不改旧夹具或Expected。新审查3反例先红，一轮局部修补关闭date-only误判/日历假08:00/实验文案；最终定向99/99。
- full: 独立复核无阻断后一次完整门：Vitest932+Node66=998通过，原live OCR1跳过；lint/双类型/契约/构建/安全/依赖通过，漏洞0。日志rco-mainline-02-i1-yjIYJz。构建大chunk提示保留。
- browser: 官方Codex内置浏览器两个新库，首页/统一录入、逐键编辑/明确保存、部分/剩余确认、双击、Inbox多草稿、真实确认事务回滚、刷新读回已验证。multi实际42/42；no-date1任务0时间0提醒/真实jobs0；八类旧通知8来源8run8草稿、4任务，预期非行动未新增任务。仅限已跑场景错误默认选/重复/覆盖/未确认写入/关键丢失0。
- blocked: App JSON实际下载文件未取得；2次监听超时、Downloads同名文件0，但导出已进入读库链，不能确定浏览器限制或实现根因。辅助tab.content.export不支持也不等于App根因。面板双项、保存故障、已保存后确认故障、跨标签过期、date-only真实UI尚需补验，不冒充通过。
- protection: BASELINE.json（81节I1_BASELINE即此文件）712原tracked/701保护SHA不变，追加日志前缀相同，越界路径0；旧17/40/42/历史FAIL保持。未读密钥/剪贴板、不写旧缓存。REJECTED_SNAPSHOT绑定19文件。
- next: 唯一建议I1-R1，批准Edge新本机库先诊断实际下载并补剩余浏览器；证实根因后只改原获准导出/工程入口，不重做数据或换模型。等待授权。
- accounting: 外部识别模型/verifier/Repair/retry/模型网络/人民币费用0，模型准确率本轮未测量；无稳定接线/真实用户库/材料/真人/RCO-6/部署。Git与npm审计联网不计模型请求。

- cleanup: 两个本轮测试标签已关闭；核对命令行后停止本轮server PID46028，12998端口无监听；隔离数据库与临时证据保留，未清理用户数据。最终701保护/19实现哈希匹配、CURRENT_CONTEXT80行；Git只暂存审计文档。

## 83. MAINLINE-02-I1-R1 下载与登记浏览器缺口授权 — 2026-09-05

- authority: 当前用户批准恢复19本机实现，先诊断实际JSON下载，补面板批量/保存与确认故障/跨标签过期/date-only；源码允许职责严格限App实验导出、browser工程工具、mainlineAcceptance及两脚本。0模型、密钥、剪贴板、数据集、部署。
- baseline: HEAD/远端54e8f15ad7426ed37339bea56f19da33751aca2d；19源码与拒收快照完全匹配，701保护不变，无重叠修改。不回切/不套补丁。R1_BASELINE另绑定旧I1报告和本轮追加日志前缀。
- runtime: 官方Edge新标签与新空v8库；新origin http://127.0.0.1:11829，run a95225c8-344b-4dbc-baee-1c140a0fa84a。旧12998 origin及库保留，未访问/删除，不将新端口当旧库恢复。
- status: IN_PROGRESS；I1历史NOT_ACCEPTED不改。先保持源码不变检查下载，尚无新通过结论。模型准确率本轮未测量。

## 84. MAINLINE-02-I1-R1 本机隔离工程通过 — 2026-09-05

- outcome: ACCEPTED_ISOLATED_ENGINEERING；闭合I1登记浏览器缺口，旧I1 NOT_ACCEPTED/40/42/旧17/历史FAIL保持。R1源码改动0，19实现与拒收快照一致，成功后提交此前获准实现，不套FAILED补丁。
- diagnosis: Edge下载监听3次超时，但取得(2)/(3)/(4)实际文件；最终34166字节、现行v8 validator无issues、canonical摘要与实际库相同。两份旧下载文件仅核对身份，不计本轮成绩。不臆断监听/message-channel根因，不改导出代码。
- browser: 面板双项0→2；保存故障全库回滚/缓冲保留；保存2条编辑后确认故障全库不变；跨标签STALE零写入/核对后主动确认；逐字date-only日历不造时刻。最终3来源3草稿4任务3时间3用户编辑0提醒，文件42/42；真无日期1任务0时间0提醒/真实jobs0，刷新与工程门后全库全等。
- gates: 新99/99；新无上下文独立PASS后一次新全量998通过/1原live OCR跳过；lint/双类型/契约/构建/安全通过，依赖0漏洞。全量日志nWXYwl，定向Lcfq08。大chunk警告保留。
- limitations: message-channel非零无确定归因，下载监听不可靠；辅助工程工具遮挡未验收鼠标布局。正式执行/编辑/ICS/真实提醒/模型识别/稳定入口/商业效果不属通过范围。
- protection: 701受保护/17旧报告/19源码SHA匹配，日志追加前缀保持，未写旧cache/数据。R1_IMPLEMENTATION_SNAPSHOT与R1_FINAL_CHECKS绑定证据。模型/识别网络/verifier/Repair/retry/费用/密钥/剪贴板0。
- cleanup: 本轮Edge三标签已关闭；仅本轮server PID42292停止、11829无监听；新旧测试库/下载文件/临时证据保留，不访问真实库。
- delivery: 通过后精确暂存获准19实现、新R1报告及2动态文档，单独feat(app)提交推送并核对远端；最终SHA以Git回执为准。无部署/RCO-6/新数据/真人。
- next: 唯一建议MAINLINE-03-SCOPE只读查清真实识别输出到V2的交接，待新授权；不再反复造人工数据或直接换模型。模型准确率本轮未测量。完成后停止。

## 85. MAINLINE-03-SCOPE 只读交接范围授权 — 2026-09-06

- authority: 当前用户仅批准识别服务/冻结候选输出到MAINLINE-02隔离V2的定向只读追踪；只新增范围报告、精确白名单、检查设计、下一提示词及保护/复核文档，更新短交接并追加日志。
- baseline: 唯一repo C:\Users\Winner\student-affairs-multimodal-exp，branch codex/e2-multimodal-recognition-exp；HEAD与远端235e3650ee776277b5bdc4c6c371a9356c833a1f，工作区起始干净。R1实现19/19匹配；BASELINE绑定747既有只读文件和日志原字节前缀。
- boundary: 产品源码/契约/仓储/冻结组件/旧材料与历史结果只读；不新数据、不调用旧runner，不读密钥/剪贴板，不访问用户库/模型网络/真实材料/真人，不部署/RCO-6。费用0；模型准确率本轮未测量。
- status: IN_PROGRESS；先查实际调用链，区分字段丢失、表达缺口和模型语义错误。下一实施/付费方案仅待授权，当前不执行。

## 86. MAINLINE-03-SCOPE 文档范围交付 — 2026-09-06

- outcome: SCOPE_DOCUMENTS_REVIEWED；仅范围/白名单/验收/下一提示词及保护复核文档，不是识别实现或模型验证。模型准确率本轮未测量。
- diagnosis: 普通真实识别仍走旧确认；MAINLINE02隔离V2使用人工回调。Worker返回pending-source且无span，V2要求真实来源/逐字位置；现行候选composer空置时间材料等引用，三值/条件/修订也无完整目标表达，不能强转或靠换模型修交接。
- evidence: 仅旧人工8类及B8-01/07/09输入/raw/旧score、010已见B9摘要只读；不新评分，不改历史FAIL，不把旧fn一律归给模型。R1旧42/42/998通过等明确不是本轮新测。
- scope: 唯一下一包MAINLINE-03-I1拟改App实验来源提示、mainline02/runtime可选handoff，新增6源码/测试与2脚本；不动Schema/repository/capture/confirmationV2/validator/冻结候选。原始receipt可走新Source的现有legacyData，未实际写库。
- review: 新无上下文首次登记1处文档矛盾，已修正并复核PASS：完整校验失败只保留Source receipt和失败Run/Draft，不承诺无效result的局部确认；范围未扩大。
- checks: R1源码19/19匹配，010冻结组件25/25匹配；最终747保护/日志前缀/文档与密钥扫描详见CHECKS。本轮产品lint/test/build和浏览器未运行（仅文档），0源码修改。
- paid: 后续拟12份另批新匿名Development×2臂最多24次/10元，模型deepseek-v4-flash-vision-exp；完整契约/数据/预算仍NOT_READY，未创建、未冻结、未调用，不沿用旧许可。
- boundary: 模型/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/用户库/真实材料/真人/部署/RCO-6均0。提交推送仅本目录文档及2动态文件，远端核对以Git回执为准。
- next: 等待MAINLINE-03-I1新授权，先把来源接对并显示表达缺口；正式任务编辑/执行、ICS/真实提醒、稳定/商业接入分别审批。完成后停止。

## 87. MAINLINE-03-I1 来源绑定实施授权 — 2026-09-06

- authority: 当前用户明确授权SCOPE十文件白名单的零调用来源绑定/可表达性接入验证；唯一repo/branch保持，不改冻结契约/旧材料/默认入口，不访问密钥/剪贴板/模型网络/真实库，不部署。
- baseline: HEAD与远端3439a8ee6ec2f1c96932b20b86b519544af7af52，起始干净；SCOPE原747只读与R1原19源码匹配。本轮BASELINE固定全部原文件及仅4个可修改既有路径（2源码/2动态文档），新增仅6源码测试/2脚本与本轮报告。
- execution: 先来源断点复现→最小绑定→定向/对抗→新独立审查→一次适用完整门→真实Edge新库逐键/确认/刷新/文件读回。失败/保护变化等按授权停止；尚未有新通过结论。
- accounting: 外部模型/verifier/Repair/retry/模型网络/费用/密钥/剪贴板0，模型识别准确率本轮未测量。没有数据制作/冻结/旧runner/稳定接入许可。

## 88. MAINLINE-03-I1 来源凭据审查阻断 — 2026-09-06

- outcome: NOT_ACCEPTED / REVIEW_BLOCKED；按失败分支停止，10获准实现保留本机未提交，仅上传审计证据，不重置源码。
- implemented: 可选隔离handoff、Source匿名receipt、唯一逐字sourceId/span绑定、原始/首次/编辑分层、已见类型拒绝、新真实App本机入口；未接普通入口，不改冻结契约。
- directed: 当前134/134、11文件（旧99+新35）；multi内存canonical确认42/42，非绑定结构断言通过；首次旧服务形状来源断点复现1/1已包含。日志PFkR6r/早期bvOBd9/复现UXMIfc，非模型准确率。
- review: 新无上下文独立审查2例矛盾receipt（版本或rawOutputText不一致）经重新算hash仍capture成功、默认选true、明确确认后各写1项。属于来源凭据身份失守，不冒称语义任务误选；不能宣称全局错误放行0。
- stopped: 独立BLOCKED后源码修补0；完整lint/test/build/安全/依赖与实际Edge/下载均NOT_RUN，不继承R1旧浏览器42/42。只做收尾保护/文档检查，未启动本轮server或实际浏览器库。
- protection: 752只读SHA匹配，日志旧字节前缀保留；REVIEW_SNAPSHOT/REJECTED_SNAPSHOT绑定相同10源码。旧Expected/freeze/dataset/checkpoint/cache、旧40/42/17测试/历史FAIL不改。
- boundary: 外部识别模型/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/用户库/真实材料/真人/部署/RCO-6均0；无新数据/盲测/B10或旧runner执行。
- delivery: docs(product)仅审计目录与两动态文档，精确暂存不含未提交源码；最终提交/推送/远端SHA以Git回执为准。
- next: 唯一建议MAINLINE-03-I1-R1修复凭据内部一致性，复现→最小修复→独立审查→完整门→原浏览器协议；待新授权，不换模型/新数据。模型识别准确率本轮未测量。完成后停止。

## 89. MAINLINE-03-I1-R1 凭据一致性修复授权 — 2026-09-06

- authority: 当前用户明确授权仅修I1登记的版本/raw身份内部一致性，恢复现有未提交实现；不重做PLAN、不运行旧runner、不调用模型/密钥/剪贴板、不部署。
- baseline: 本机/远端c30cdb760a23353af191d6f9c1ee8dbb8d19eb40；10实现与REJECTED_SNAPSHOT全匹配、原752保护通过。R1_BASELINE追加保护I1报告及5只读实现，共768文件；日志旧字节前缀固定。
- scope: 仅recognitionHandoff/seenReplay两实现及对应两测试/mainlineAcceptance测试可修；其余5实现只读。新文件仅R1报告、短CURRENT_CONTEXT及日志追加；不改冻结材料/Schema/仓储/V2。
- sequence: 两个已登记反例先失败→至多两轮局部修复→新无上下文审查→无阻断再完整门/实际Edge协议→保护→成功提交推送；失败只交付证据，保留现场。
- status: IN_PROGRESS，尚无本轮通过结论；模型识别准确率本轮未测量，外部识别请求/费用0。

## 90. MAINLINE-03-I1-R1 定向与独立审查通过 — 2026-09-06

- reproduction: 新2反例失败/旧134通过（XWF2mj）；第1轮局部修复后136/136，再补同根因检查最终153/153（2xMFm0），旧134保留、42/42内存口径保留。
- fix: 原始JSON与对象结构一致，内嵌版本/模型对齐；对象键序/空白不影响，数组/缺键/类型差异拒绝。空响应版本null，已见候选仅记录已知身份；哈希不冒称服务商真实性认证。
- review: 新无上下文PASS，独立6类矛盾拒绝/合法重排正常确认2任务；3测试去新增块后与旧拒收SHA精确匹配。10快照匹配、768保护不变；独立诊断不混入153分母。
- next: 允许按原授权继续一轮完整工程门与实际Edge协议，尚不构成整轮验收。外部识别模型/网络/费用/密钥/剪贴板0。

## 91. MAINLINE-03-I1-R1 工程依赖范围阻断 — 2026-09-06

- outcome: NOT_ACCEPTED_ENGINEERING_BLOCKED；来源凭据修复/独立审查通过，但完整工程与实际浏览器未过。停机级别NO_PROMOTION / NEEDS_SCOPE_APPROVAL，须当前用户批准最小工程依赖范围才继续。
- checks: 153/153定向、42/42内存保真；独立6类矛盾拒绝、合法重排可确认且原始/首次保留，旧三测试断言SHA回构匹配。第1工程attempt（l1TQcP）lint2处换行失败，仅在获准测试文件调整并独立复核；新定向153/153（ylFLCW）。第2attempt（Rx2qfE）lint通过，app类型6个TS2307失败，后续门/Edge未运行。
- cause: 三I1测试原有node:fs/node:crypto导入缺@types/node，package/锁文件/安装目录均无该类型包；本机Node v24.18.0。标准修复需要新增开发依赖，package.json/package-lock.json不在本轮白名单，因此停止，不安装依赖或修改公共配置，不用屏蔽错误/删测试过门。
- preservation: 当前10实现保持R1_REJECTED_SNAPSHOT，768保护不变、日志旧字节前缀保留。旧Expected/freeze/dataset/checkpoint/cache/40/42/17测试/历史FAIL不改；原5只读实现未变。
- browser: 未启动本轮server/Edge/实际新库，未生成真实下载；不继承历史浏览器PASS，无需关闭服务，不清理临时/历史证据。
- delivery: 仅R1审计/检查/快照/下一提示词和两动态文档单独docs提交推送，远端以最终Git回执为准；10业务源码保持未提交，不回滚。
- next: 唯一建议MAINLINE-03-I1-R2，申请仅package两文件及对应开发依赖安装，先锁版本与影响→独立审查→完整门→原Edge协议。不是新语义或模型轮次。
- boundary: 外部识别模型/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/用户库/真实材料/真人/新数据/盲测/B10/部署/RCO-6均0。模型识别准确率本轮未测量。完成后停止。

## 92. MAINLINE-03-I1-R2 Node开发类型依赖授权 — 2026-09-06

- authority: 本轮仅新增package.json/package-lock.json精确Node开发类型依赖许可；原10实现只读，报告仅R2前缀，短交接与日志追加；不改语义/测试/配置/冻结材料。
- baseline: 本机及远端6534121fad9c844a825a2e9034af6f136ede79da；起始原768保护无变化，10源码与R1拒收快照匹配。R2_BASELINE固定782只读文件，仅两个依赖文件从旧保护中按本轮明确授权列为可改。
- reproduction: 新日志rco-mainline03-r2-2304f4909c7e4e9fab5be618400954b9/reproduction.log，类型检查退出2，复现三测试共6个node:fs/node:crypto TS2307，无其他类型错误。
- execution: 最小依赖核验/安装→类型与153定向→新独立审查→一次适用完整门→原Edge实际协议。旧checker含原package保护，不修改旧checker/基线；以R2授权保护清单执行相同检查命令并保留独立日志。
- boundary: IN_PROGRESS，无新PASS；必要公开包元数据/依赖审计及Git网络允许，其余外部识别/模型/费用/密钥/剪贴板/真实库/部署均0。模型识别准确率本轮未测量。

## 93. MAINLINE-03-I1-R2 类型闭合、历史环境门阻挡 — 2026-09-06

- outcome: NOT_ACCEPTED_HISTORICAL_ENVIRONMENT_GATE_BLOCKED；NO_PROMOTION / NEEDS_GATE_SCOPE_APPROVAL。已停止，不进入Edge；当前用户另批历史/当前环境分层验证后方可恢复。
- change: 只改package.json(+1)/lock(+18)，@types/node24.13.3及undici-types7.18.2均MIT开发类型；357旧非根锁对象/运行依赖/脚本零漂移，原10实现只读。使用新npm缓存/ignore-scripts，2次配置启动失败后实际安装added2，失败日志保留。
- checks: 6个TS2307先复现；app/node类型PASS，11文件153/153、42/42内存字段。新无上下文依赖审查PASS。完整attempt1的bundle/lint/type/contracts通过；Vitest986通过1原有跳过，server8/worker25/time1/multimodal23通过；历史回放库3通过1失败，先抛FREEZE_HASH_MISMATCH:package-lock.json。
- cause: 旧RCO-5-007 freeze的17绑定路径中仅package.json与lock变化，两项起始SHA均等于旧freeze，变化仅本轮获准依赖增量；旧freeze本身不改。历史整体环境已非相同，不能改旧SHA/删测试/回切依赖或以当前依赖比较替代旧门。独立工程复核确认。
- not_run: functions/build/完整安全/依赖漏洞审计及Edge12协议场景未执行；0本轮server/标签/实际库/下载，内存安全/jobs断言不冒充浏览器实测。153已包含在986，不累计。
- protection: R2保护782与原10源码SHA不变，日志旧前缀完整；Expected/freeze/dataset/checkpoint/cache/历史40/42/17/FAIL及冻结组件保持。R2_REJECTED_SNAPSHOT保存12源码/依赖文件现场。
- delivery: 只提交R2审计、短CURRENT_CONTEXT及日志，原10实现+2依赖保留未提交，不清理/回滚。Git提交/远端核对以回执为准，不称业务交付。
- next: 唯一建议MAINLINE-03-I1-R3新编排：原封旧门在逐字匹配历史快照运行，当前两类型增量单列严格兼容验证，再完整工程/原Edge。提示词R2_NEXT_PROMPT，尚未授权实施，不重做识别语义或创建数据。
- boundary: 模型/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/用户库/真实材料/真人/新数据/盲测/B10/旧一次性runner/部署/RCO-6均0。模型识别准确率本轮未测量。完成后停止。

## 94. MAINLINE-03-I1-R3 分层验证编排授权 — 2026-09-06

- authority: 当前用户仅批准新增check-mainline-03-i1-r3.mjs与R3报告、动态短交接/追加日志；现有12实现/依赖与所有旧冻结/测试只读，无模型/密钥/剪贴板/用户库/部署许可。
- baseline: 本机/远端beae935cba642027c8222644a6e541f2c636bfb2；12现场与R2拒收匹配、原782保护通过。R3_BASELINE固定旧文件和R2报告，包含当前12现场与日志旧前缀。
- evidence: 原17历史绑定只有2依赖变化；在内存逆转已登记R2新增行及其2上下文行CRLF，package逐字SHA与旧freeze一致；锁文件可由起始Git内容按已验证CRLF重建并须全SHA匹配，不忽略换行差异。
- sequence: 历史快照全SHA→原封库门；当前严格两开发类型增量→变形反例→新无上下文审查→分层完整门→原Edge协议。旧R2当前3通过/1失败保留，不冒称当前与历史环境一致。
- status: IN_PROGRESS，尚无新通过结论；模型识别准确率本轮未测量。禁止重装、扩大产品范围或自动进入后续模型阶段。

## 95. MAINLINE-03-I1-R3 分层工程通过、实际下载未验收 — 2026-09-06

- outcome: NOT_ACCEPTED_DOWNLOAD_UNVERIFIED / NO_PROMOTION；停止产品工作，只提交失败审计，原12与新增编排脚本保留未提交。不是工程或模型全通过交付。
- change: 仅新增check-mainline-03-i1-r3.mjs；原12及旧checker/库测试/freeze保持逐字。20个历史快照文件与原freeze/基线全SHA匹配，原17引用完整；package保留58 CRLF/6 LF，lock保留5510 CRLF，不忽略换行。未重装/升级或执行旧一次性runner。
- engineering: 最终定向13兼容+4原库；新无上下文独立审查PASS。一次分层完整门1HdKiX通过：Vitest986/1原跳过，server8/worker25/time1/multimodal23/functions5；lint/type/contracts/build/security通过，构建扫描18/0 findings，依赖审计0漏洞。153定向包含在986，不累计。旧R2当前环境3通过/1失败原样单列。
- browser: 新Edge两标签/同origin12736/新空隔离v8库，实际录入、来源适配、草稿恢复、逐键/保存、部分/批量/Inbox、故障/过期/重复/刷新均有实际库证据。原12协议10 PASS/1 PARTIAL/1 BLOCKED；canonical42/42，文件侧未核验。最终5来源/5草稿/6任务/5时间/4材料/18历史（3编辑）/0提醒，真无日期0时间，实际jobs0；原文/raw/首次建议/历史分层未丢。
- blocker: 三次真实导出按钮触发，两次下载监听超时，Downloads精确同名定位无本次新增文件；没有真实路径/大小/SHA/文件与整库比对。尚不能判定产品、浏览器或工具根因，未改App/下载生命周期或绕过权限，不用页面JSON代替文件。第二标签1条message-channel错误保留。
- protection: 799保护/原12匹配，新增脚本仍为独立审查SHA；日志旧前缀仅追加。Expected/freeze/dataset/checkpoint/cache/旧历史不改。两新标签关闭，核对PID43692命令行与12736后停止server；测试库、旧下载与所有临时证据保留。
- delivery: 只提交R3审计、短交接、追加日志并核对远端；原12业务/依赖与R3脚本不提交，见R3_REJECTED_SNAPSHOT。实际Git回执为准。
- next: 唯一建议R4-DOWNLOAD-SCOPE，只读定位下载落地断点并列精确最小白名单；不重新调模型、不重做已通过主链或历史计划。提示词R3_NEXT_PROMPT，尚未授权。
- boundary: 外部识别/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/真实用户库/新数据/盲测/B10/真人/真实材料/部署/RCO-6均0。模型识别准确率本轮未测量。完成后停止。

## 96. MAINLINE-03-I1-R3-CLOSE 文件补证与交付授权 — 2026-09-06

- authority: 当前用户仅批准补齐实际下载文件证据、独立复核、提交此前原12文件与R3编排脚本；产品逻辑/测试/依赖/编排本轮只读，新增仅R3_CLOSE_*报告、短交接与追加日志。
- baseline: 本机/远端40a7f13003563505be0d9408cb87149a13ca643a；799保护和原12+R3脚本SHA均匹配。R3_CLOSE_BASELINE绑定11份旧R3报告及当前日志完整前缀；旧失败不改写。
- verification: 15份原完整门日志与SHA一致，原机器结果全对象相同，20历史快照文件全SHA不变；不重跑全量工程/浏览器。保留REPL中此前真实runtime.load读回r3final，独立于下载文件，全对象摘要98fa1768d648bf49c862fdc1433f2630e3c9bed705af68fb67d2ef26e623e75a；本轮不是新浏览器读库。
- sequence: 文件定向/42字段/凭据→新无上下文审查→保护与明确暂存清单→成功才业务提交推送；当前IN_PROGRESS，不先宣称完成。
- boundary: 外部识别/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/用户真实库/新数据/盲测/B10/真人/真实材料/部署/RCO-6均0。模型识别准确率本轮未测量。

## 97. MAINLINE-03-I1-R3-CLOSE 真实文件补证通过、获准实现交付 — 2026-09-06

- outcome: PASS_ISOLATED_ACCEPTANCE_AFTER_FILE_SUPPLEMENT；新无上下文独立复核及短交接复核PASS。原协议补证后12/12，不是本轮重跑工程/Edge；Git完成状态须以随后实际提交、推送及远端精确核验回执为准。
- evidence: 用户提供实际mainline-02-i1-workspace (7).json，96198字节；文件SHA6fddeb86ea9c975e2085d15beb66d640820d4de7863fe7c33f13952aabe1c23e；全对象SHA98fa1768d648bf49c862fdc1433f2630e3c9bed705af68fb67d2ef26e623e75a匹配前轮真实runtime.load读回且保留于REPL的r3final。来源链与源码/原操作记录核实，不是同一文件自算两次，也非本轮新读库。
- file: 既有v8校验valid=true/0issues，原42字段文件侧42/42；5来源凭据一致、4成功响应只变获准来源/位置，3编辑历史独立保留；真无日期0时间、全部0提醒，原实际jobs0。B8-01仍失败/result=null。
- engineering: 15日志SHA、原全量JSON与20历史快照全SHA核验不变，复用既有完整门：兼容13/历史库4/Vitest986通过1原跳过（含153定向）/server8/Worker25/time1/multimodal23/Functions5，类型/契约/build/security通过、依赖0漏洞；不机械重跑。未声称GitHubCI通过；原CI Node22/旧npm test与本机R3分层门不同。
- review: 文件身份、全对象来源、42/42、历史保留、分层结论及12项协议完整性无阻断；CURRENT_CONTEXT旧下载缺失/R4优先项已更新。审查首次跨realm调用错误以同realm内存校验澄清，无产品修改或断言弱化。
- protection: 799保护0变化；原12+R3脚本共13文件逐字不变、11旧R3报告不变、日志全旧前缀仅追加。原文件未改，不动旧40/42、17测试、R2当前3通过/1失败和R3原失败审计。
- history: 原R3当时因未取得下载文件证据停止；后来通过用户提供真实文件补齐。不将监听超时写成已证实产品故障，不删除承载R4-DOWNLOAD-SCOPE建议的历史报告；该调查不再是当前优先。
- delivery: 仅明确暂存原13实现/依赖/编排、8份R3_CLOSE报告、短交接及追加日志，共23文件；无下载原件/临时证据/未获准文件。成功推送后核对远端，失败不强推或变基。源码本轮零修改。
- next: 唯一待授权MAINLINE-04-SCOPE，复用既有缺口，区分模型没给/契约装不下/转换丢字段，最小化条件三值、状态、修订、事件及时间材料语义承接；不重复下载诊断、不堆关键词，提示词R3_CLOSE_NEXT_PROMPT。
- boundary: 外部识别/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/真实库/新数据/盲测/B10/真人/真实材料/稳定接入/部署/RCO-6均0。模型识别准确率本轮未测量。交付后停止，不自动进入后续实施或付费。

## 98. MAINLINE-04-SCOPE 最小语义承接范围授权 — 2026-09-06

- authority: 当前用户仅批准只读追踪MAINLINE-03已登记语义缺口；新增mainline-04-scope六份范围文档，CURRENT_CONTEXT短交接及日志仅追加。原源码、旧证据、冻结/Expected/dataset/checkpoint/cache只读。
- baseline: 本机/远端d97326c65d6e042c07c56d68a79d65f1ac8ed0a7，工作区干净；R3-CLOSE原13文件SHA匹配、799保护不变。全819项既有非动态跟踪文件绑定原始SHA集合摘要bee7c944318af99c2a5356210e39129e961347575ba2ac8a0d0d8beb07d0d9e0，旧日志213633字节前缀受保护。
- focus: 区分模型未给出、契约不可表达、转接丢字段；仅形成任务所需的条件三值/当前状态/修订/事件与时间材料关联最小包，不建设通用知识图谱，不重复下载调查或从RCO-0重审。
- sequence: 定向源码及少量已见响应→最小结构/逐文件白名单/正反验收→无上下文范围复核→保护文档检查→明确清单提交推送。当前IN_PROGRESS，不宣称新工程、浏览器或模型能力通过。
- boundary: 0模型/模型网络/费用/密钥/剪贴板/真实库/真人/真实材料/新数据/盲测/部署/稳定接入/RCO-6。模型识别准确率本轮未测量。完成后停止，实施需另行授权。

## 99. MAINLINE-04-SCOPE 范围审计交付 — 2026-09-06

- outcome: PASS_SCOPE_DESIGN，新无上下文独立范围审查无阻断；只完成范围/白名单/验收设计，不是实现、模型或实际浏览器验收。
- finding: 研究候选/composer缺完整时间材料输入，不能自动算转换丢失；旧2.0只有整份boolean行动性，条件三值/逐项状态/修订缺等价承载；事件格式可表达但冻结V2任务确认不支持。区分MISSING_UPSTREAM、UNREPRESENTABLE_TARGET和有实际前后证据的DROPPED_IN_HANDOFF，不排除或杜撰模型语义错误。
- evidence: 复用MAINLINE-03交接图，定向核对旧8工程类型、B8-01/07/09 sourceText/parsed及旧事件/材料关系测试。B8原分数/FAIL不改，人工工程标签非独立真值，linked-event.location=null不算非空地点识别证据。
- decision: 唯一下一待授权MAINLINE-04-I1，新增7个语义模块/测试+1checker，已有源码只读。独立task-semantics-1/review-package-1保留条件三值/状态/修订/事件/时间材料，正向核对建议与有效兄弟必须成立；旧V2只做等价2.0的内存确认42口径。新语义实际App/正式保存仍NOT_RUN，不能靠legacyData/description或全拒绝过门。
- permissions: 涉及confirmationV2/domainCommit/类型/校验/capture/App/面板/仓储/迁移的后续范围明确另批；不在I1暗改。新checker使用新白名单复用R3分层方法，旧环境3/1单列；不直接运行旧整轮入口规避其白名单。
- checks: 819既有非动态文件逐字集合、799原保护、13已交付实现/依赖/编排保持；日志旧213633字节前缀仅追加。文档/路径/版本/提示词一致性及密钥模式检查通过，最终Git差异/远端以实际回执为准。
- delivery: 仅mainline-04-scope六文档、CURRENT_CONTEXT、追加日志共8文件，明确清单提交推送；不改旧报告和缓存、不制造业务提交。R3-CLOSE既有12/12、42/42及986/1不是本轮新成绩。
- next: 使用NEXT_PROMPT申请唯一I1；通过其新结构保真出口后再申请真实组件接入，不反复重做同类契约或新数据集。本轮不自动实施。
- boundary: 0外部识别/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/真实库/浏览器操作/真人/真实材料/新数据/盲测/B10/稳定接入/部署/RCO-6。模型识别准确率本轮未测量；Git网络仅提交推送/远端核验。
- reuse-clarification: 最终定向核对scopeReferenceContract已有语义枚举、surface/time/material/revision引用；I1必须复用而非从零再造命题图，仅增每项条件/依据三值、覆盖状态、完整实体属性/归属及承接能力。旧boolean/轻量引用不冒充完整新结构，旧分类器不重跑；实现白名单不扩大。

## 100. MAINLINE-04-I1 零调用实施授权 — 2026-09-06

- authority: 仅新增白名单8实现/测试/编排及本轮报告；原源码/测试/依赖/冻结只读。0外部识别/模型网络/费用/密钥/剪贴板，不建数据集、不接App新语义、不部署。
- baseline: 本机/远端2405cf59023511b28caa7e53e41db1af0e06d3b5且干净；SCOPE文档SHA与13实现匹配，799旧保护通过；本轮825既有非动态文件与日志完整前缀绑定BASELINE.json。
- sequence: 失败复现→最小契约/组合/承接边界→定向变形→新无上下文审查→适用分层工程→保护→明确清单提交推送。新错误默认选择或保护变化立即停止；同根因最多两轮局部修补。
- boundary: 人工新结构保真与旧V2的42字段确认分表；新语义实际App/正式保存NOT_RUN；旧FAIL/40/42/17及R2旧环境3/1保持。当前IN_PROGRESS，模型识别准确率本轮未测量。

## 101. MAINLINE-04-I1 独立审查失败，硬停交付 — 2026-09-06

- outcome: FAIL_INDEPENDENT_REVIEW；只交付审计，8新增实现/测试/checker保持拒收SHA且未提交。未改旧源码、测试、依赖或冻结。
- directed: red-01模块缺失执行0测试；directed-01为47/49、02为48/49、03为49/49，不累计各attempt。两轮局部修补仅修新测试对旧接口属性/完整错误码和B8真实ID的调用，未弱化断言。
- evidence: 8类人工工程结构往返与预定选择断言、B8三条已见原输出保留和强转阻断；原42字段经真实capture/confirmV2/内存repo读回42/42。逐字段console账本未由JSON reporter保留，未编造叶字段分母或完整报告交付。模型准确率本轮未测量。
- independent: 新无上下文审查/root/mainline04_i1_independent发现2个阻断；修订scopeIds缺失只阻断旧项，新项仍默认选（新增错误默认选择1）；m0属性差异导致独立print连坐阻断（1）。审查者和主线程均在同一未改现场内存复现，详见REVIEW/REPRODUCTION。
- stop: 收到错误默认选择即停止实现/测试/编排修改与全量工程晋级；仅补已登记反例证据和保护/差异/文档检查。完整checker审查NOT_COMPLETED；全量分层工程、新语义实际App/正式保存均NOT_RUN。49/49不能覆盖新反例，不宣称I1通过。
- protection: BASELINE绑定825既有非动态SHA全匹配，含799旧保护及13旧实现/依赖/编排；日志前缀不变。历史FAIL/40/42/17/旧R2环境3/1、Expected/freeze/dataset/checkpoint/cache和旧runner保持。失败8文件快照见REJECTED_SNAPSHOT，非成功组件冻结。
- delivery: 仅暂存本轮报告、CURRENT_CONTEXT和追加日志，明确清单见STAGING_MANIFEST；推送及远端号见实际Git回执。实现未暂存、未提交，不强推/自动变基。
- next: 仅建议另批MAINLINE-04-I1-R1，按关系真实影响范围处理修订依据与新旧两侧关联实体比较，保留有效新要求与独立兄弟；不重做契约、模型或数据。完整提示词见NEXT_PROMPT，本轮不自动执行。
- boundary: 外部识别/模型网络/费用/密钥/剪贴板/真实库/浏览器/真人/真实材料/新数据集/盲测/B10/稳定接入/部署/RCO-6均0；必要Git交付网络不等于模型网络。

## 102. MAINLINE-04-I1-R1 获准恢复 — 2026-09-06

- authority: 仅修I1已登记的修订证据影响范围与旧V2实体比较连坐；允许原mainline04内composer/handoff及对应两测试、acceptance共5路径，契约/契约测试/checker只读；新增R1_*报告、短交接与追加日志。
- baseline: 本机/远端1d039ac8065235528b6a507244e66ef382ba6901；原8实现与拒收/审查SHA一致，825父保护匹配，新增历史证据和3只读实现绑定R1_BASELINE。无重叠修改，不回切/重装/套补丁。
- sequence: 核对实际接口→两条真实业务反例及正常对照→先修修订、再修实体比较，各根因最多两轮→定向与无上下文独立审查→核对只读checker、需要调整先申请→适用工程/保护/精确Git交付。
- boundary: 不改旧49断言/Expected/freeze/dataset/checkpoint/cache和历史结果；新错误默认选择/范围扩大等立即停。0模型/模型网络/费用/密钥/剪贴板/新数据/真实库/稳定入口/部署/RCO-6，新语义App/正式保存NOT_RUN，模型准确率本轮未测量。当前IN_PROGRESS，不预称通过。

## 103. MAINLINE-04-I1-R1 代码审查通过，检查编排待授权 — 2026-09-06

- outcome: BLOCKED_CHECKER_SCOPE / AUDIT_ONLY_DELIVERY；两根因代码独立PASS，完整工程NOT_RUN。只交付R1审计，8新增实现保留未提交，不改旧失败结论。
- changes: 实改composer/handoff及composer/acceptance两测试，共4文件；修订依据覆盖两端，完整相关实体在新旧两侧求并集；共享材料不再穿透兄弟私人截止时间。契约/契约测试/checker及其他源码依赖只读。
- attempts: RED49/51→REVISION59/60→HANDOFF_RED18/23→首轮68/68；独立发现共享连坐，补4反例68/72→第二轮72/72；最后仅加强新增测试深拷贝、单侧归属和old不变断言，最终仍72/72。修订1轮、实体范围2轮业务修补，无第三轮业务修改；各JSON原样留存，不累计成绩。
- evidence: 最终原49+23新检查；8类人工结构关系保真及B8三条已见诊断保持，原V2真实内存确认42/42，无日期0时间/0提醒、重复幂等和兄弟确认断言通过。最终定向错误默认选择0；新语义实际App/正式保存NOT_RUN，模型准确率本轮未测量。
- independent: 新无上下文/root/mainline04_i1_r1_independent，最终代码PASS、阶段BLOCKED。真实helper内存验证修订、共有/私人材料时间、单侧归属、重排和old保真；4旧测试前缀、原49名称、8SHA与最终72报告核验。审查者未重跑整套72项，不混称独立全量通过。
- stop: 只读checker固定旧HEAD/旧BLOCKED REVIEW/旧TEMP与非R1输出；--protect在BASELINE_HEAD_CHANGED前置失败，未创建临时目录、未执行完整门，不属于产品功能失败。主线程只读复核，未改checker/旧BASELINE/旧REVIEW，未绕过授权。
- protection: R1_BASELINE845保护逐字核验，原4测试前缀与日志旧前缀不变；旧I1 FAIL、40/42、17、旧R2环境3/1、Expected/freeze/dataset/checkpoint/cache保持。最终证据见R1_CHECKS与R1_REJECTED_SNAPSHOT，非成功冻结。
- delivery: 精确暂存R1_*报告、CURRENT_CONTEXT与追加日志，清单R1_STAGING_MANIFEST；提交推送/远端精确号以实际Git回执为准，8实现不提交。无强推/回切/自动变基。
- next: 唯一建议另批RCO-5-MAINLINE-04-I1-R2，只调整一个checker的当前基线/审查/保护/输出绑定，独立审查后继续完整分层工程；不改7语义源码/测试，不重做契约、模型或数据。完整待授权提示词R1_NEXT_PROMPT，本轮停止不自动执行。
- boundary: 外部识别/模型网络/费用/密钥/剪贴板/真实库/浏览器/真人/真实材料/新数据集/盲测/B10/稳定接入/部署/RCO-6均0；只有必要Git交付网络。

## 104. MAINLINE-04-I1-R2 检查编排获准恢复 — 2026-09-06

- authority: 仅允许check-mainline-04-i1.mjs增加显式R2阶段/审核SHA/保护/报告/临时目录支持；7语义源码测试只读，旧默认与全部历史不变。新增R2_*报告、短交接、追加日志。
- baseline: 本机/远端6b3ccc2cf9cde95f29ca7e25e5cfc5859638d05d；8实现逐字匹配R1拒收/最终审查快照，845旧保护匹配。扣除获准checker保留844，再绑定21项R1静态证据与7语义源码去重，共870保护。无重叠修改，不回切/重装/套补丁。
- sequence: 编排内存正反验证→新无上下文审查并绑定8SHA→一次适用分层工程→保护与精确交付。工程要求额外源码/测试/依赖改变即停，仅审计保留现场；不绕类型/删门/改答案。
- boundary: 0外部识别/模型网络/费用/密钥/剪贴板/真实库/新数据/部署/稳定入口/RCO-6；只允许Git与公开依赖审计网络。新语义App/正式保存NOT_RUN，模型准确率本轮未测量。当前IN_PROGRESS，不预称通过。

## 105. MAINLINE-04-I1-R2 编排审查通过，开始一次分层工程 — 2026-09-06

- directed: 内存编排22/22，原R1定向72/72；原42字段真实V2内存断言通过。JSON reporter未保留独立console明细，只报告断言证据，不补造字段文件。
- independent: 新无上下文/root/mainline04_i1_r2_independent审查PASS；870保护/7源码/8当前SHA一致，14类错误审核/变更/越界/临时路径实际内存探针0写入0子进程拒绝，合法绑定进入full哨兵，未提前运行full。
- scope: 唯一checker新增显式R2绑定，完整工程函数除根报告路径外保持；原历史快照20文件只读SHA匹配。R2_REVIEW记录本轮真实审核，不使用self-check模拟PASS冒充授权。
- next: 仅启动full-01一次获准分层工程；任何工程失败保留现场、需要只读源码/测试/依赖修改立即停。未发生前不宣称工程通过；新语义App/正式保存NOT_RUN，模型准确率本轮未测量。

## 106. MAINLINE-04-I1-R2 分层工程通过，准备精确交付 — 2026-09-06

- outcome: PASS_ENGINEERING_WITH_DECLARED_LIVE_OCR_SKIP；只改一个checker，原7语义源码/测试匹配R1最终SHA，没有额外源码/依赖/语义修改。R1已修组件获得完整工程证据，不等于新语义App/产品/模型验收。
- directed: 内存编排22/22、原定向72/72，原49不弱化。42字段真实V2内存确认断言passed；未伪造JSON reporter未保留的独立console字段明细。
- independent: 新无上下文审查PASS，14类实际入口错误在0写/0子进程前置拒绝，8SHA绑定真实R2_REVIEW后才full。原fullEngineering除根报告路径外一致，不删工程门。
- engineering: full-01一次、18层通过；历史逐字完整性20/20，当前依赖兼容13/13，原封历史库4/4；当前前端1058通过/1既有live OCR跳过/0失败，其他功能62/62；lint/type/Schema与时间契约/build/18资源稳定隔离/安全/依赖全部通过，0漏洞，日志SHA一致。不把72重复计入全量，不合并历史环境与当前成绩。
- skipped: 原ocrLiveComponent.test.ts按既有RUN_LIVE_OCR_COMPONENT=0跳过，无测试改动或新skip；本轮不测真实OCR，不以组件工程通过宣称识别质量。旧R2环境3/1和旧I1/R1历史失败、40/42/17/B8 FAIL全部保留。
- protection: 原844+21项R1证据+7源码去重共870文件，原始SHA/日志前缀保持；审查8SHA与实现快照一致。Expected/freeze/dataset/checkpoint/cache、旧runner和稳定入口不动。
- delivery: 全部门通过后才按R2_STAGING_MANIFEST精确提交8实现/编排及R2报告、短交接、追加日志；提交推送/远端精确号以实际回执为准，不强推/自动变基。快照R2_IMPLEMENTATION_SNAPSHOT，审计R2_AUDIT，检查R2_CHECKS和R2_ENGINEERING_CHECKS。
- next: 唯一建议另批MAINLINE-05-SCOPE，只读确定新语义→真实App核对确认→隔离保存的最小产品接入白名单。理由是工程结构可承接不等于用户可用；不先换模型或新造数据。提示词R2_NEXT_PROMPT，本轮不自动执行。
- boundary: 0外部识别/verifier/Repair/retry/模型网络/识别费用/密钥/剪贴板/真实库/真实材料/真人/浏览器/新数据/盲测/B10/稳定接入/部署/RCO-6；仅Git和公开依赖审计网络。新语义App/正式保存NOT_RUN，模型准确率本轮未测量。

## 107. MAINLINE-05完整用户闭环范围交付 — 2026-09-06

- authority: 用户要求按完整用户闭环组织MAINLINE-05，先一次列清精确白名单与关键风险，确认后同包连续实现/修补/审查/工程/浏览器/Git；当前只做范围文档，不实施代码。
- baseline: 本机/远端07cbd4cf9d3f9797949ead0799965960f90b2727，工作区原本干净；870保护与8项MAINLINE04实现逐字SHA一致，无重叠修改。没有回切、重装、套补丁或重读完整历史。
- mainline: 主瓶颈是新语义到旧draft.result/V2确认和canonical关系的交接，而非缺少新关键词。计划复用MAINLINE04与真实App，以用户确认后刷新找回完整任务为一个交付目标。
- scope: 提议7已有文件显式增量+18新源码/测试/脚本，共25路径，唯一清单mainline-05/IMPLEMENTATION_WHITELIST.json。domainCommit新应用入口与v8容器下严格版本扩展必须由用户明确批准；全局Schema/repository/validator/confirmationV2/capture/MAINLINE04及历史仍只读。
- validation-design: PLAN的J01–J12覆盖来源先存、逐键保存、条件三值/修订/信息处置、事件/共享、部分批量、失败/过期/重复、刷新找回和实际下载对独立读库；旧42保留，新事实/关系100%、安全错误0与必要正例同时要求。不给测试数量当产品进度。
- review: /root/mainline05_scope_reader无历史上下文只读复核PASS_SCOPE_ONLY，未发现需扩大25文件的接口阻断；提醒纯信息从全部来源恢复/处置，不伪造任务。详见REVIEW.md。本次未运行产品/工程/浏览器或模型测试。
- delivery: 本次仅PLAN/白名单/REVIEW/CHECKS、64行CURRENT_CONTEXT及本追加记录，按精确6文件清单提交推送并核对远端；真实回执见Git，不强推/自动变基。白名单状态保持PROPOSED_REQUIRES_USER_CONFIRMATION。
- next: 用户确认PLAN第9节后才连续执行MAINLINE-05，普通范围内修补不再拆轮；只在超范围/保护变化/重大安全问题等边界停。旧R2_NEXT_PROMPT作为历史保留，不再作为当前优先事项。
- boundary: 本次产品源码/测试/依赖变化0，模型/模型网络/费用/密钥/剪贴板/真实库/浏览器/新数据/部署0；模型准确率本轮未测量。新语义App与正式保存依旧NOT_RUN，范围审查通过不代表功能完成。

## 108. MAINLINE-05完整工作包开始实施 — 2026-09-06

- authority: 用户已明确批准PLAN/25路径、domainCommit新入口、可选runtime及严格版本扩展；按J01–J12连续实现和验收，普通范围内修补不拆阶段。0模型/密钥/剪贴板/真实库/稳定入口/部署。
- baseline: 本机/远端8ffed8746e8b270168c5d1acb2629c631de946a7，干净工作区；870历史保护及8项MAINLINE04实现均匹配。扣除7获准例外并补绑旧checker后864保护路径，另绑4计划文件。IMPLEMENTATION_BASELINE.json记录SHA、日志前缀与独立临时目录。
- preflight: 本机Node v24.18.0，Edge安装存在；未重装依赖。浏览器连接/下载能力将在本机隔离入口建立后实测，不预称PASS。当前全部J为NOT_RUN。
- focus: 先实现来源→版本化语义记录→严格联合读取及确认事务，再真实App接线；源语义和旧V2只读复用。模型准确率本轮未测量。

## 109. MAINLINE-05现场与范围阻碍审计 — 2026-09-06

- implementation: 已在获准25路径内建立23个实现/测试/启动文件，未提交；来源先存、语义状态联合校验、真实仓储原子确认/编辑/处置、App可选接线及下游事实展示。两个checker路径尚未创建，不称功能完成。
- latest-checks: core-07为37过/1失败（38项/6文件），旧V2内存42/42；type-targeted-05存在CalendarPage.tsx:159 TS18047，属普通未修缺陷。启动器构建预检通过，不是真实页面验收；完整实现审查/分层工程/J01–J12/下载与浏览器独立读库均NOT_RUN。
- root-cause: 只读MAINLINE04沿任务依赖把前置任务私有截止带入当前任务，产生MULTIPLE_DEADLINES。新确认层不能忽略首次问题；不同截止依赖无法同批确认。当前失败断言、原数据与时间全部保留，未通过改答案/删关系放行。
- independent: /root/mainline05_dependency_scope_review无上下文只读复核同因，独立定向16过/1失败（不累加到38），确认当前白名单无法满足PLAN依赖承诺；最小需追加semanticComposer.ts一个保护例外，以05显式模式分离资产归属和依赖安全，旧默认不变。不是全包PASS。
- protection: 864保护路径、4计划和8 MAINLINE04实现SHA全匹配；日志原前缀不变。旧Expected/freeze/dataset/checkpoint/cache/历史FAIL/40/42/17和runner不改，无重装/回切/补丁恢复。
- delivery: 仅mainline-05获准审计文档/快照/检查结果、约80行CURRENT_CONTEXT和本追加日志按精确清单提交推送；23实现保留未提交。Git真实提交号与远端回执以交付核验为准，不强推/自动变基。
- next: 等待仅一文件范围扩展，再继续同一个MAINLINE05完整包；不重做PLAN，不自动进入模型/新数据/新包。提示词在AUDIT.md末尾。
- boundary: 外部识别模型/模型网络/费用/密钥/剪贴板/真实库/稳定入口/部署均0；浏览器只预检新Edge空白标签。模型准确率本轮未测量。

## 110. MAINLINE05原包继续，批准唯一归属例外 — 2026-09-06

- authority: 用户明确将semanticComposer.ts列为第26路径，仅允许MAINLINE05显式模式分离本任务资产与依赖安全传播，旧默认不变；其余原包范围和停止条件保持。
- recovery: 本机/远端e9b87e7dc4546e91d7f5559807b83465ba857cb0；23现场SHA、864原保护、4计划及日志前缀均匹配。没有回切/重复应用实现/重装。批准例外后保护863项，历史快照本身仍保护。
- evidence: 当前恢复记录和独立临时目录见mainline-05/runs/continue-20260906a/self-check.json。先复现已登记依赖失败，再修复、定向/独立/工程/真实浏览器，不拆新工作包。
- boundary: 模型/模型网络/费用/密钥/剪贴板/真实库/部署0；准确率本轮未测量。

## 111. MAINLINE05同包继续后重大安全停止 — 2026-09-06

- scope: 原26路径内修复composer显式资产归属/依赖安全分离与CalendarPage类型；旧默认、MAINLINE04其余7文件和历史保护不动。未新开阶段或申请额外文件。
- directed: 原依赖16过/1失败复现；targeted-01为116/116（05 44+旧04 72）；新增SSR接口错误45/46后纠正具名导入，最新05为46/46；不相加重复样本。旧V242/42，应用type通过；不是最终全量工程证据。
- independent: /root/mainline05_full_independent无上下文核心审查BLOCKED，实接口新内存复现S01前置拒绝后错误默认选（提交器拒绝、正式任务0）、S02未覆盖信息仍confirmed、S03共同任务owner补造材料截止并使已确认deadline从d0变null。新关系保真FAIL，不报告全字段100%或全安全0。
- stop: PLAN将错误默认选择列重大安全边界，已停止实现/测试/编排修改；不是普通范围内补丁再拆阶段。checker主文件未验收、node-test未创建；完整审查/分层工程/J01–J12实际Edge/真实下载/独立浏览器读库NOT_RUN。
- evidence: 新runs/selection-stop-20260906a记录审计、25现场SHA/1未创建、独立审查、5份日志SHA及保护；上轮原审计/快照/历史FAIL保持，原实现不回切或重套。
- protection: 863保护、4计划、2引用和234733字节旧日志前缀均一致，唯一composer例外记录当前完整SHA；旧Expected/freeze/dataset/checkpoint/cache/40/42/17/B8/环境3/1不改。
- delivery: 只按failure.json的8文档精确清单提交推送并核验远端；25个未通过实现留本机不提交。实际提交号以Git/交付回执核对，不预称成功、不强推/变基。
- next: 唯一建议明确授权同包修复登记S01–S03，仍26路径，先正常/失败对照再修当前选择、信息完整性与显式关系；随后补完编排/独立/工程/Edge/Git。提示词见failure.md，未自动实施。
- boundary: 模型/模型网络/费用/密钥/剪贴板/真实库/新数据/新依赖/稳定接入/部署0；模型识别准确率本轮未测量。

## 112. MAINLINE05同包S01–S03授权恢复 — 2026-09-06

- authority: 用户明确批准修复已登记S01–S03，保留26路径、原职责和composer唯一例外；范围内普通修补同包连续，新增未登记重大安全/保护/范围问题才停。
- recovery: 本机/远端f5410d6c88ab1dfa4b90ae4346ea0b257f13ca3b，25现场SHA及1未创建路径、863保护/4计划、日志前缀一致，无重叠修改。不回切/重装/重复应用实现。
- execution: 先登记反例/正常对照再修复选择状态、信息完整性、显式时间材料关系；完成编排后重新独立/分层工程/真实Edge/下载读库/Git。恢复记录与新临时目录见runs/safety-fix-20260906a/self-check.json。
- boundary: 模型/模型网络/费用/密钥/剪贴板/新数据/新依赖/真实库/稳定入口/部署0，模型准确率本轮未测量。

## 113. MAINLINE05暂停后同包恢复 — 2026-09-06

- authority: 用户要求继续执行，仍沿用26路径/S01–S03授权，不重做PLAN或重复应用实现。
- recovery: 本机/远端f5410d6c88ab1dfa4b90ae4346ea0b257f13ca3b；safety-fix-20260906a/targeted.json的26源码SHA、12日志SHA全匹配，863保护/4计划/20历史证据及原日志前缀通过。没有新增重叠修改。
- review: 暂停前没有落盘完整独立结论，不能把中途消息称PASS；重新无上下文/root/mainline05_final_review收口26文件完整审查。已通过且SHA未变的定向证据复用。
- next: 独立无阻断后完整分层工程，再真实Edge J01–J12、实际下载与独立读库/Git。当前这些仍NOT_RUN，0模型/密钥/真实库/部署。

## 114. MAINLINE05最终独立审查通过并进入工程门 — 2026-09-06

- review: /root/mainline05_final_review只读完整26文件，PASS无阻断；逐项SHA匹配targeted.json，数组摘要07906b12ce10eefc0811a99f211909c77f33f9640511ccc4a7d9265545dd1f53。实跑checker33/33、旧V242/42、启动器/diff/保护通过；128/128按12日志SHA复用，不当新样本。
- evidence: safety-fix-20260906a/review.md与review.json记录结论和26SHA。首次完整分层工程run=full-20260906a，旧历史环境/当前兼容分层，未改变原freeze。
- boundary: 此时实际Edge/J01–J12/下载读库仍NOT_RUN；仅通过实现审查，不宣称产品或模型正确率。无模型/密钥/真实库/部署。

## 115. MAINLINE05分层工程与真实Edge首轮 — 2026-09-06

- engineering: full-20260906a全部工程门通过；长日志目录rco-mainline05-check-full-20260906a-99XRAS，原历史环境FAIL保留。当前源码后有3项普通修补，旧工程PASS不冒充最终修补后通过。
- browser: 新Edge标签763114631/763114632、固定origin 127.0.0.1:6627、唯一空库mainline05-688bf3e0-6e60-449a-acec-01a11d1fdfc4，真实App录入/刷新草稿/部分批量/无日期找回/逐键编辑/条件三值/修订/纯信息/坏引用/有效兄弟/S01依赖/S03共享/事件/保存与确认故障/跨标签过期/重复均已执行。确认故障前后独立读库全对象相同；无日期关联时间/提醒/实际jobs0。
- ordinary-fixes: 收件箱两个来源批量一失败一成功的数据行为正常，但输出短ID同为: draft:1，App显式semantic结果改完整ID。工程浮层遮挡确认鼠标入口移到左上；读库清旧显示且完成摘要后发布snapshot；新增只下载独立load对象的工程证据按钮。serve仅新增显式回环--port恢复原origin，不换库或改默认。
- evidence: runs/browser-20260906a/failure.md保留真实复现；原26SHA中23未变，3修补在原职责内。128/128定向重验、lint0错误/1既有热更新warning、--check与保护通过，等待新独立审查后新全工程和实际下载。
- boundary: Edge工具无timezone覆盖/content.export，其他实际浏览器时区仍NOT_RUN，已非阻塞请用户手动Sensors切换，不用Node SSR代替。不新增数据集/依赖、不触及真实库/密钥/剪贴板；0模型网络/费用，准确率本轮未测量。未提交业务实现。

## 116. MAINLINE05最终工程与真实文件闭合，保留单项环境缺口 — 2026-09-06

- implementation: S01–S03修复保持；普通批量提示/工程读库与下载/同端口启动器经新独立审查。共享事件、取消无替代的既有关系菜单和3测试在原26路径内补齐，不新增产品语义或数据集。
- attempts: journey-coverage首次34通过2失败仅新增测试updatedAt毫秒差；固定既有NOW参数后36/36，完整对象和原128断言不变。最终05为59+04为72，共131/131，旧V2内存42/42；独立/root/mainline05_journey_review PASS，26SHA摘要2c9fb255df8b9baaf240ee7c443f10654a1e7b7b7560bca0a37669dd7ab5c3d5。
- engineering: full-b、最终full-c各19层PASS，不累计样本。最终Vitest1117通过/1既有live-OCR跳过；checker33/33、原历史库4/4；两类型/契约/build/安全/依赖0漏洞；16工程日志SHA一致。旧环境3/1、40/42/17及历史FAIL保持。
- browser: 同origin6627/同隔离库，31任务/27来源；共享事件先后确认刷新仅一份并有2owner；取消旧项、独立新项确认正常。J01/J02/J04–J12 PASS，J03另一实际浏览器时区NOT_RUN；工具无覆盖能力，已请用户手动Sensors，不改系统/不用Node代验收。
- download: 实际mainline-05-workspace (1).json为1260173字节，文件SHA e9fcf0f9481e9f1b70a2e6325448317fec3be78598ab3ac792870294a253dbc3。另一实际下载来自new repository独立load；全对象SHA03e308722c052a4e8e14b0bbe90382c851082664baaba78c8241d5a6b2ee8a9a，联合校验PASS。12:09:47.215Z真实刷新读回完全相同。7真无日期0关联时间/0提醒，实际jobs0；B8三条只读NOT_EXPRESSIBLE不改历史。
- boundary: 整包NOT_COMPLETE，必要时区证据尚未验收，只拟提交审计、26实现保留未提交，最终证据复核另记。唯一下一动作同包补J03与最终交付；0模型网络/费用/密钥/剪贴板/真实库/部署，模型准确率本轮未测量。

## 117. MAINLINE05最终证据复核与仅审计交付边界 — 2026-09-06

- independent-review: /root/mainline05_delivery_evidence_review只读PASS_FOR_AUDIT，26当前SHA、16工程日志、两份下载及临时独立副本逐字/全对象核对一致；明确未重跑浏览器。11旅程PASS/J03 PARTIAL/整包NOT_COMPLETE均分开，无阻断审计的过度宣称。
- protection: 原863保护、4计划、20静态历史证据、日志前缀通过，最终26实现仍在本机未提交；最终源码摘要2c9fb255df8b9baaf240ee7c443f10654a1e7b7b7560bca0a37669dd7ab5c3d5。
- delivery: 仅精确本轮审计报告+CURRENT_CONTEXT+追加日志暂存，业务源码不入本次提交。最终提交/推送以实际Git核对为准；不强推/变基。缺口只为另一个实际浏览器时区，保留原库和下载，模型准确率本轮未测量。

## 118. MAINLINE05原包J03实际跨时区恢复 — 2026-09-06

- authority: 沿用用户仅补J03、恢复设置和最终交付授权；产品源码只读，不再尝试受阻的原生电脑控制。用户手动从Sensors无替代切到America/Los_Angeles。
- preflight: 本机/远端fe064c19e2d5d2bc418adfcf7bb744ce4bdeb8ec；26实现、863保护、4计划、20静态证据、16工程日志SHA及244561字节日志前缀匹配，无重叠修改。
- recovery: 原服务停止，刷新显示ERR_CONNECTION_REFUSED；用未改启动器--port=6627恢复原origin，未访问新new=1地址或新建/清空库。原标签763114649刷新显示实际America/Los_Angeles、业务Asia/Shanghai。
- baseline-read: 13:23:21.924Z实际工程按钮new repository.load读回31任务，全对象03e308722c052a4e8e14b0bbe90382c851082664baaba78c8241d5a6b2ee8a9a与原证据一致。preflight见runs/j03-20260906a/preflight.json。
- status: 两种日期操作、刷新下载及恢复设置待完成；不提前称J03或整包PASS。模型/费用/密钥/剪贴板/真实库/部署0；模型准确率本轮未测量。

## 119. MAINLINE05原包J03验收和设置恢复通过，进入精确Git交付 — 2026-09-06

- browser: 原origin6627/原库/原标签实际America/Los_Angeles，已见无日期通知逐键补2026-09-15、普通截止逐键改2026-09-16T09:31，明确保存、单项/两项批量确认、刷新任务/日历通过；业务值按Asia/Shanghai保留。未保存不能确认；原文/首次/编辑分开，未增加产品规则。
- files: 产品实际下载mainline-05-workspace (2).json为1356636字节，SHA65bcd0628e294a9cbb3d3efbdaec8d1bfcea47f8cb6e0503f79c68d69a22a531；独立new repository.load下载909769字节，全对象SHA06cb9fbbb6a3fc0c889cdb73a0de934dbe8bba96f4901953e9f82c0b79209719。全对象一致、联合validator与下载检查通过；旧335实体不变。最终34任务/29来源/27时间/0提醒，7真无日期0时间/0提醒，实际jobs0。下载监听超时保留为工具观察限制，不判产品故障。
- restoration: 用户确认Sensors恢复无替代；原页刷新实际Asia/Shanghai。13:34:56.879Z再次独立读库全对象与测试结束完全相同，日历日期/时间不偏移；未改系统时区。
- independent-review: 无上下文/root/mainline05_j03_close_review PASS_FOR_FINAL_DELIVERY，亲验26SHA/16工程日志/两实际文件/旧实体/联合校验；浏览器操作与恢复明确复用主代理实际记录，不编造复跑。绑定preflight/browser/download三证据SHA，见runs/j03-20260906a/review.json。
- layers: J01–J12证据齐，11旧PASS与本次J03分开；复用同26SHA的full-c19层、131定向、旧V2内存42/42、1117通过/1既有跳过，不重复全跑或累计样本。原FAIL/PARTIAL、40/42、17与旧环境3/1不改。
- delivery: 最终保护/文档差异检查后，精确26实现及本次8报告、CURRENT_CONTEXT与追加日志随同一业务提交交付；checks.json记录暂存清单。Git提交与远端精确号由实际命令核验，不在生成提交前伪造。本次未改26实现；失败停止不强推/变基。
- boundary: 当前包交付后停止；模型识别准确率本轮未测量。0外部模型/模型网络/费用/密钥/剪贴板/新数据集/新依赖/真实库/稳定入口/部署；真实模型、真人和商业化验收另行授权。

## 120. MAINLINE05实际Git交付与存储换行回执 — 2026-09-06

- git: 精确36文件业务提交1ae10d8afef8c27fbf2f27ca44072a5ffa98612f推送原分支成功；live origin精确一致，工作区干净。未强推/变基/修改源码；提交后26本机SHA、863保护/4计划/20静态证据与三审查证据保持。
- storage: 额外Git blob逐字检查首遇EventDetailPanel差异；只读查明core.autocrlf=true。26项中24逐字同，EventDetailPanel与domainCommit仅CRLF转LF，分别移除49/723个CR，无其他字节差异。delivery.json分别保存原工作区与Git存储SHA，原冻结/保护仍逐字核验，不把换行差异默默忽略或称源码修补。
- receipt: 本次只追加实际交付和换行存储映射回执、短交接与审计；不amend业务提交、不重跑工程。最终远端以实际命令核验；模型识别准确率本轮未测量，完成后停止。

## 121. MAINLINE-REAL-INPUT-01完整范围准备 — 2026-09-06

- authority: 本轮仅5份方案文档、CURRENT_CONTEXT及追加日志；不改产品/测试/依赖/历史，不调模型、不建数据集、不部署。doc-coauthoring按已有明确需求直接共写主计划并做无上下文读者复核，不重复历史问答。
- baseline: 实际HEAD/live远端0eedbf7fc1523d6be476c704ed02b273bdb513bf，业务1ae10d8afef8c27fbf2f27ca44072a5ffa98612f。起点干净；26实现/863保护/4计划/20静态/3审查绑定匹配。954只读tracked文件逐字快照摘要7d5c4b5fd5f66e6a04616acdd48ba340da1505bf78214cc2f3abaa39b61b1e81；原日志248835字节/SHA435f7fcd8c4d44fcf6f542a27f54c6f0a203f232f74fdb2521d84786a5d7e20d。26工作区/Git blob沿旧delivery区分，2项既有CRLF映射不放宽freeze。
- mainline: 已追踪真实App/fileExtraction/Intake及人工capture/state/确认/仓储。拟一个41路径完整包（13已有显式增量+28新增），真实读取/校对→固定文本网关→来源绑定语义→逐项核对和有限事实纠错→原子隔离保存→下游找回/实际下载。不是新增41功能，也不新增同义语义图。
- scope-review-fixes: 文档已明确未改文字复用SourceVersion；仅首尾空白更改保存前拒绝留buffer；旧draft绑定自身版本、Source取最新Run；新profile在内存capture构造并联合校验后CAS，避免写后才发现坏图；所有有效事实消费者统一、manual补充不伪装证据。已有App按draft版本读原文保持，不将新profile风险误判为现有错引bug。源码全程未改。
- decisions: live模型初始不默认勾选、须逐项核对后主动选为待批准政策；自动选择NOT_ENABLED不能领取0误选质量信用，候选错漏/Forbidden仍计分且需非零真实确认正例。不能任意补建漏掉任务/编辑复杂共享时间，明确保留缺口。
- budget: 官方公开文档已核模型/Responses参数/人民币价格，账号/Secret未访问。待批准A8+B8+可选C8新候选已见复测，共不超24次/10元；token计费上界尚未证明，预算CONDITIONAL，首请求前证据不足PAID_BLOCKED。无隐式retry/verifier/Repair；格式载体复用旧8语义，不称新盲测。0本轮模型/模型网络/费用/密钥/剪贴板/真实库。
- pending: 方案独立范围复核、最终保护/文档检查及精确Git交付另记；模型识别准确率本轮未测量，不宣称方案等于实现或商业化通过。

## 122. MAINLINE-REAL-INPUT-01方案独立复核与文档交付 — 2026-09-06

- review: 无上下文/root/real_input_scope_review结论PASS_SCOPE_REVIEW，方案范围阻断0；亲验41路径/13已有SHA/28尚未创建，修订后未发现必需的额外公共文件。报告绑定三方案最终SHA，补核文件本体不保存意味着中途刷新需重新选择文件，不承诺自动续读。预算执行仍PAID_BLOCKED直至输入计费上界证明；方案通过不是产品通过。
- checks: 954旧tracked逐字摘要、863保护/26实现/4计划/20静态/3审查来源与248835字节日志前缀匹配；CURRENT_CONTEXT 77行，41路径唯一，逐文件职责/原因/验证/回滚齐。三方案与独立审查绑定、JSON/敏感串/UTF文本与git diff检查通过；既有工程和浏览器未重跑，不新增产品验收数字。
- delivery: 仅暂存mainline-real-input-01下PLAN/IMPLEMENTATION_WHITELIST/VALIDATION_AND_BUDGET/SCOPE_REVIEW/CHECKS五文件，加CURRENT_CONTEXT及本日志，共7文件。单独docs提交、推送原分支并live核对的精确号由Git及最终答复记录，不写循环自引用提交号；推送失败不强推/变基。提交后停止，不自动实施或付费。
- boundary: 产品/测试/依赖改动0；外部识别/模型网络/费用/密钥/剪贴板/真实库/新数据集/真人/真实材料/部署均0。公开官方API资料查询只为方案元数据，不是认证或识别调用；模型识别准确率本轮未测量。

## 123. MAINLINE-REAL-INPUT-01统一实施开始 — 2026-09-06

- authority: 用户明确批准41路径/限定职责与新隔离版本；同时条件批准A8+B8+可选C8最多24次/10元，预算证明前0调用。普通范围内修补同包连续；不自动部署或接真实库。
- preflight: HEAD/live远端56d0545fd8ffdd7b71f9feeed1ad9ac22a705dbe，起点干净；26旧实现/863保护/4计划及954旧tracked摘要匹配。13已有例外之外946tracked逐字保护摘要a06efdaf29b96b8da448e9caf87104f05e183bdf08465e037789d650c27a8ef5；日志前缀252816字节/SHA802b54b14890618345e44d4bae53c4cf8b14726bac925b1905e7b61bed8c9b26。完整身份与例外见runs/implementation-20260906a/BASELINE.json。
- focus: 先实现可恢复本机来源/真实响应身份/人工逐项核对确认的最小链路，同时独立只读复核公开计费上界。旧人工响应仅接线代理，不把模型候选标human，不重建同义契约、不读密钥/剪贴板。
- context: 日常编码清单先读后改/最小职责；独立代码审查聚焦安全与实际操作，不为格式偏好拆包。当前模型/OCR/浏览器均未运行，准确率本轮未测量；下一动作见STATE.json。

## 124. MAINLINE-REAL-INPUT-01局部实现／预算阻断审计 — 2026-09-06

- result: 整包NOT_COMPLETE，仅新增inputReceipt/modelWire/seenInputs及两测试，共5文件保留未提交；13已有源码均未改。还没有真实App/OCR/模型/确认存储链路，不能称可试用版。实施现场及23未创建路径见runs/implementation-20260906a/IMPLEMENTATION_SNAPSHOT.json。
- checks: 先17/17，独审发现字符串隐式转型及异步页码数组变化两P2；新增receipt反例5通过2失败，wire时钟同根因12通过1失败，先复现再入口复制/严格类型修复，最终20/20、当前App类型及新目录lint通过。独立复核PASS_PARTIAL_HELPER_REVIEW，原SHA绑定及失败attempt保留，不累计样本。草稿工程测试日志误绑lint已修正为targeted-attempt-2.log；完整工程/Edge/下载/存储/模型指标NOT_RUN。
- budget: 独立公开资料审查确认原0.40元固定不可逆预留缺完整计费输入100000上界证明，PAID_BLOCKED。另据官方1M上下文保守1048576输入+8192输出推单笔3.219456元，提出3.30元最坏预留、核验usage后按最高价结算的滚动方案供批准；总24/10不变，未知/失败不释放。未修改原方案或启用此替代，不让用户重复复制密钥。
- protection: 946只读tracked摘要与13已有例外SHA均匹配；旧26/863/4计划、历史42/42/40/42/17/FAIL及原252816字节日志前缀保留。工作区/存储换行身份不混同。首个12项试运行未显式禁用Vitest node_modules缓存，之后cache=false；旧受保护评测缓存及历史未变。
- delivery: 仅精确暂存本run八报告/八attempt日志及CURRENT_CONTEXT/本日志共18路径，提交推送审计；5源码不暂存，保留现场。最终SHA/live远端以Git回执及答复为准，不强推/自动变基。使用git-push技能的精确清单与远端核验，用户禁止自动变基的边界优先。
- boundary: 本轮外部识别/模型网络/费用/密钥/剪贴板/真实库/新语义数据/格式载体/依赖/真人/部署均0；公开官方资料与Git网络不是模型请求。模型识别准确率本轮未测量。下一步同一包预算规则精确批准后继续完整主线，不重做PLAN、不重复实现。

## 125. MAINLINE-REAL-INPUT-01同包滚动预算恢复 — 2026-09-06

- authority: 用户明确将单次0.40固定不可逆预留改为最坏3.30元、完整合法请求绑定usage按最高人民币价整数向上结算；未知/失败/超时/崩溃不释放、不重发。总24次/10元、原41路径/批次/模型参数及隔离不变；旧方案与证据不改。
- preflight: HEAD/live远端4ed0486d3137ac60b1b07c7ef276739cbc98350f；原5源码SHA、41路径存在状态、946保护摘要、原252816字节日志前缀匹配，无重叠修改。新的前缀256271字节/SHA d993b5f7b6061a238855b21488c77806ce11571e02003a501ca770227ac78c9c；前run16证据增补只读绑定，见runs/continuation-20260906a/BASELINE.json。
- sequence: 日常编码/独立审查技能仅用于读后最小修改、正常对照和风险复核，不拆普通修补。先新预算模块及故障测试；再完成输入/真实App/模型/确认/存储同一闭环。使用BASELINE预登记的新临时目录，不改旧缓存、不读剪贴板，首调用前安全门和真实发送输入必须绑定。
- start: 本轮模型/模型网络/费用/密钥/剪贴板0；官方价格/上下文/Responses公开元数据重新核验，非认证探针。主线尚未完成，模型识别准确率本轮未测量。

## 126. MAINLINE-REAL-INPUT-01滚动预算完成／新网关P1停止审计 — 2026-09-07

- result: 同包新增预算/网关两模块及两Node测试，未改13已有源码或原5新模块。预算最终28/28及独审PASS_SCOPE_ONLY；网关原17/17后，独立反例复现P1，整包NOT_COMPLETE。9实现保留未提交，41路径仍19未创建。
- budget: 按已批准3.30元预留、usage最高价整数结算；跨进程锁、重启未知、有效前缀截断、24/10、C输入/候选/评分绑定均有正反测试。独审先发现snapshot泄露内部manifest引用P2，两个新增回归修前失败，复制units后28/28且复核通过。初始语法失败及各attempt保留，不累计为更多样本。
- security-stop: 新gateway只检查raw.includes(secret)，模拟上游Unicode转义假凭据后被返回/记录且结算。独审真实接口复现200/true/true/settled，390微元仅模拟值，真实密钥访问/泄露/模型网络/费用均0。依据重大安全停止条件暂停源码/测试修改及发送，不在CLOSE或报告中偷偷修逻辑。
- evidence: runs/continuation-20260906a/REVIEW、AUDIT、ENGINEERING、IMPLEMENTATION_SNAPSHOT绑定九源码/五日志、独立复现来源及未完成项。完整工程、真实App/OCR/确认存储、Edge/下载读库NOT_RUN；模型识别准确率本轮未测量。原5模块20/20仅SHA复用旧证据。
- protection: 946摘要及13已有例外、原5源码、前run16证据、原252816与本轮256271字节日志前缀匹配；Expected/freeze/dataset/checkpoint/cache/旧FAIL/旧runner不变。未接真实库或稳定入口，无新语义数据/依赖/真人/部署。
- delivery: 使用git-push技能仅精确提交本run报告/日志和短交接/追加日志，九实现不暂存；核对实时远端，禁止强推/自动变基。最终Git精确号见交付答复；工作区与Git日志换行SHA分别核验。
- next: 唯一建议仍同包修复已登记P1，优先gateway及对应测试，检查解析后的JSON键值/模型文本再决定记录/返回/结算，正常成功必须保留。独审无阻断后继续原41路径实际输入→建议核对→确认保存主线；不重做PLAN/预算，不新建授权阶段。精确批准提示词见AUDIT。
- evidence-clarification: 独立文档复核确认数字和四SHA未变，另明确上述“记录命中”仅指测试内存recordRaw回调，未调用createRawRecorder验证原始响应落盘；只有预算账本写入预声明临时根。AUDIT/REVIEW已澄清，不能宣称磁盘实测泄露，P1停止结论不变。

## 127. MAINLINE-REAL-INPUT-01已登记P1恢复 — 2026-09-07

- authority: 当前用户明确解除continuation-20260906a转义凭据反射P1修复停止点，保持41路径/3.30滚动预留/24次10元/原参数，独审后同包继续闭环；不重做PLAN，不扩大职责。
- preflight: HEAD/实时远端4d11737bc0fa38f5c4f67a205237531ae3b254a5一致；9源码、946保护、最前run16证据、前continuation12报告日志及旧前缀均匹配，无重叠修改。本轮起始日志260128字节/SHA061f889301bc7ddabbd6123853657cb8b10b8189c900b453e28bc13611484b99。
- context: 日常编码/独立审查技能用于真实接口反例和最小修补；当前仅本机模拟假凭据，不读真实密钥/剪贴板。新run p1-resume-20260907a/BASELINE登记临时根，旧证据只读；模型调用/网络/费用0，准确率本轮未测量。

## 128. MAINLINE-REAL-INPUT-01登记P1闭合后主线推进与新确认P1停止 — 2026-09-07

- completed-scope: 网关先18通过/6真实反例失败，再解码JSON字符串token/嵌套文本检查，拒绝发生在recordRaw/返回/结算前；预算+网关52/52，独审另6内存探针通过。恶意假凭据经真实临时rawRecorder写入0字节、未知预留不释放；正常响应原文保真。旧登记P1 CLOSED_SCOPE_ONLY，不是整包PASS。
- mainline: 实施fileExtraction显式本机profile、inputAcquisition、可控事实修订/逐项核对、判别state/来源版本/内存capture+CAS/联合canonical校验、App与面板slots、InputReview/FactCorrectionEditor/modelClient草稿。41路径中32已存在（13获准已有增量、19新实现）、9待建；完整runtime/launcher尚未挂载，不能称可试用。
- tests: 提取新8+旧23为31/31（mock非真实OCR）；策略/纠错15/15为中途版本；存储第一次70/1（派生contentPreview交接）后71/71（新12+旧59），旧测试未弱化。类型两次未接完失败日志保留，最后attempt5通过。各attempt分开不累计；旧42/42、40/42、17及历史FAIL保持，新wire未冒称42/42。
- independent-stop: real_input_core_review发现新P1：公开saveReadingCorrection保存取消原文后isCurrentDraft仍true，复核/确认仍创建旧保存任务。正常对照1项，反例错误确认1项；主代理esbuild write:false+MemoryWorkspaceRecordStore独立复现并留日志，无浏览器或用户库写入。根因是已保存读取与发送/建议依据未进入时效判断。发现后停止源码/测试修改和派发，仅审计。
- other-finding: 独审另登记P2：动作对象已纠正但首次默认标题未更新或提示失效，title与nextAction不一致；主代理未另跑该反例。冻结composer全局unresolved处理不扩大修改。
- protection: HEAD/远端4d11737bc0fa38f5c4f67a205237531ae3b254a5；946原保护摘要、前16+12证据、三个旧日志前缀仍匹配。32现场SHA见本run IMPLEMENTATION_SNAPSHOT；不改全局受保护组件/Expected/freeze/dataset/checkpoint/cache/依赖/历史。0模型/网络/费用/密钥/剪贴板/真实材料/真人/真实库/稳定接入/部署。
- delivery: git-push技能仅精确提交本run失败审计/attempt日志、CURRENT_CONTEXT与追加日志；32业务实现不暂存、不强推或变基。最终提交与远端核对见交付答复。完整工程、Edge、实际OCR、下载读库NOT_RUN；模型准确率本轮未测量。
- next: 唯一建议同包明确授权闭合登记新P1/P2，先固定公开接口反例和正常对照，使保存后的输入变更让旧未确认建议过期，并明确标题/动作对象一致性、保护主动编辑标题。无需换模型/新数据/重做PLAN；原41路径普通缺陷连续推进。独审无阻断再剩余runtime/launcher、工程、Edge和模型安全门；详细授权提示词在本run AUDIT。

## 129. MAINLINE-REAL-INPUT-01登记输入时效P1与标题P2恢复 — 2026-09-07

- authority: 用户明确允许同包修复p1-resume-20260907a登记P1/P2；41路径和限定职责、3.30滚动预留/24次10元/原模型参数及安全门不变，不重做PLAN或重复实现。
- preflight: HEAD/live远端d6f9bdc56b8908583a25a49d122386d3126cc2be；32存在/9未创建路径逐字SHA、946保护摘要、前16+12及P1静态证据和四日志前缀匹配，无重叠修改。本轮起始日志263933字节/SHA2a692d5429116ac8bf7a4b1be9566422ee28d3017872e45b5b3a74f8b7dc94b4。
- sequence: 日常编码和代码审查清单用于公开接口反例、正常对照及独立安全复核，不拆普通修补。新run input-validity-resume-20260907a/BASELINE记录现场和独立临时根。先输入时效，再标题一致性，复核后继续主线。当前0模型/费用/密钥/剪贴板/真实库，模型准确率本轮未测量。

## 130. MAINLINE-REAL-INPUT-01登记确认问题闭合／首页范围停止 — 2026-09-07

- completed-scope: 保存原文相关页更正使旧未确认建议立即过期，未发送页/独立来源/已确认保留；迟到响应一致失败留证据。对象动作修订后未手改默认标题跟随，主动标题不覆盖；独审发现同根因203字标题P2后在包内补齐明确短标题保存门，不截断原文对象。登记P1/P2及长度P2最终独审PASS_SCOPE_ONLY，无新重大安全问题。
- evidence: 修前12/5；中途实现接口16失败、迟到状态1失败均留attempt；最终核心95/95（新21+9+6+旧59），旧V2内存42/42保持。独审75为修长度前，最终单项1/1分列；四次类型PASS不累加样本。新runtime/acceptance接线6通过1失败为测试品牌误写，真实事务管家不等于所写学生事务管家，未将其归为产品故障或删改过门。
- mainline: 新增真实runtime工厂和来源先存→执行→明确失败/确认→独立内存读回；当前34实现存在、7未创建。实际浏览器/本机OCR/真实下载/完整工程/模型质量仍NOT_RUN，不是可试用版。
- scope-stop: 真实DashboardPage.tsx仍按dateViews硬编码人工/不发送/不调用/工程建议，且quickText.trim后回调。该页不在41路径而在946保护内；不撤日期适配、不DOM改字、不复制首页。独立范围复核确认需唯一该页例外：可选real-input文案和原文保真props，默认不变。发现后停止源码，未改保护；AUDIT给出42路径继续同包提示词，不重做计划。
- protection: 946逐字摘要、前16+12、P1静态20、全部日志前缀匹配；完整34SHA/7缺失及11attempt日志身份见本run快照和ENGINEERING。旧Expected/freeze/dataset/checkpoint/cache/全局受保护组件/依赖/历史40/42/17/FAIL未改，无真实用户库/数据/部署。
- delivery: git-push技能仅精确提交审计报告/attempt日志、短交接和本日志；34实现保持未提交，不强推/自动变基。实际提交与远端核验见交付答复。0模型/模型网络/费用/密钥/剪贴板，模型识别准确率本轮未测量；预算与发送门未绕过。

## 131. MAINLINE-REAL-INPUT-01优先A组恢复 — 2026-09-07

- authority: 用户批准DashboardPage.tsx为唯一第42路径，仅新入口准确说明与原文保真，旧默认不变；发送安全/预算/原A+B输入及候选评分绑定后先A01，符合原条件再A组；完整工程和浏览器随后同包完成，不降低最终要求。
- preflight: HEAD与实时远端7a30e0989d514d1df11475f4860cc014db4ce09e；34现有SHA/7未创建路径、946保护与旧证据/日志前缀匹配。原日志267068字节，SHA e64d4d86df4ba50786b52743e508adb18e30df261e0c726d7121d014c26f2daa。保留旧清单，新增例外单列；模型仍0调用0元。
- execution: 同包a-first-resume-20260907a保留新attempt；daily-coding用于最小实现，code-review-excellence用于必要独立安全审查。先最小文字真实调用准备，不重复旧实现、不扩大数据或模型预算；原始/首次/编辑分开，稳定入口/用户库不接。

## 132. MAINLINE-REAL-INPUT-01首页增量与预算复核停止 — 2026-09-07

- implemented: Dashboard显式realInput准确说明、仅trim判空且传原文，App可选props接线；新旧首页对照和新SSR品牌断言纠正。修前7/1，修后8/8；未做逐键浏览器，不冒称原文实际验收。35实现存在/7待建，代码保持未提交。
- independent-stop: 无上下文独审发现P1_DUPLICATE_USAGE_RELEASE；冲突input_tokens重复键经JSON.parse后值覆盖，真实临时lease.complete从3300000预留结算390微元并持久化，正常对照也可结算。主代理独立复核函数与账本；假响应用于预算边界，不是真实模型或新语义数据。旧52项重跑全过仍不能覆盖此缺口。按预算停止条件暂停源码/派发，仅审计，未越权修复。
- protection: 原946仅Dashboard授权例外变化，945仍逐字匹配；旧原清单/静态16+12+20及上轮日志/全部前缀保持。新旧SHA分别列IMPLEMENTATION_SNAPSHOT，不修改历史保护清单。
- delivery: 仅本run报告与3份原始测试日志、约80行CURRENT和追加日志精确提交推送，35业务实现不暂存；不强推/自动变基。完整工程/OCR/Edge/下载未运行，A01及其余模型0次、费用0，密钥/剪贴板/用户库0；模型识别准确率本轮未测量。下一建议仅授权登记歧义用量在结算前拒绝（预算模块及Node测试），独审后恢复同包A01优先，不换模型或重做计划。

## 133. MAINLINE-REAL-INPUT-01登记用量歧义恢复 — 2026-09-07

- authority: 用户明确允许修P1_DUPLICATE_USAGE_RELEASE后继续同包A01优先；42路径和原24次/10元/3.30滚动预留/模型参数/零重试保持。“不用考虑模型预算问题”按同条明确后文理解为不重做预算方案，不解除硬上限或异常停发。
- preflight: HEAD/live远端24c80c02cf4e7b7d9e652caf935638cd2ad1f0ba；35源码/7缺失、945只读与Dashboard获准SHA、前证据及日志前缀匹配。起始日志269512字节/SHA3913d2202d2f0910e1c16b78c4f51991606203bb6cd4470cd3b4d24f43d9c12a。
- execution: daily-coding最小变更；先预算模块与Node测试的登记反例/正常对照及真实临时账本，独审后继续。新run usage-resume-20260907a仅追加记录，不是新产品阶段；模型当前0调用0元，不读剪贴板或用户库。

## 134. MAINLINE-REAL-INPUT-01用量修复通过与本机配置授权 — 2026-09-07

- repair: 原52断言保留；新增重复/转义同名属性的真实临时账本反例与正常对照。首次53/1，修后54/54；独立复核PASS（绑定REVIEW列明SHA），登记P1闭合，不等于整包通过。
- continuation: 旧8通知工程格式载体已在新临时目录生成，不是新语义数据/盲测；实际OCR、A/B绑定与真实App验收待做。
- credential-authority: 用户忘记旧配置位置后，明确批准从当前剪贴板建立新.env。仅创建仓库根.env，Git已有忽略规则、未跟踪；通过本机apply_patch进程写入，未把密钥正文送入工具输出/日志/聊天。限制文件ACL为当前用户和SYSTEM；Node服务端加载布尔检查通过。未发认证/模型探针，未修改系统环境或剪贴板，不承诺该Key已被服务商认证。
- boundary: .env为本次单独获准本机秘密配置，永不暂存/导出；产品42路径不变。24次/10元/滚动3.30及首调门不变；本段写入时模型0请求0元，用户库0。

## 135. MAINLINE-REAL-INPUT-01实际读取与校对接通 — 2026-09-07

- continuation: 同包完成真实App本机入口、最小检查编排与绑定器草稿，不改变方案/42职责。失联的长运行服务等待改为可核验隐藏进程，固定6631。自动化旧标签被Edge拦截与用户标签产品初始化失败分开记录。初始化根因是空记录write被无条件禁止，修为同事务仅允许空记录初始化、禁止覆盖；原隔离库与origin保留。
- independent: 首入口审查REJECT_CANDIDATE登记sourceContent拼接、工程工具绕开故障store、prepare重复consent冲突；范围内闭合。新无上下文real_input_browser_recheck最终PASS_SCOPE_ONLY，runtime23/23、Node入口6/6分列；不代表付费发送或完整浏览器验收。最终源码SHA见本run REVIEW补充。
- browser: 实际用户Edge标签763114724、原run real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862。B01/02图OCR有严重/局部错字，B03/04空；B05文本PDF/B06扫描PDF/B07混合PDF文字正确；B08文本层漏新要求、OCR另保留全文及警告。通过真实录入面板逐键校对B01/02/03/04/08并显式保存，原始读取不覆盖，不称OCR全对或真人省时。A8旧文字另保存；无新语义数据/Expected修改。
- storage: 真实故障注入后A来源保存失败，独立new repository读回全对象SHA f0ce130048e760e1395792a3ca2b9e741736543c7d4ae74ca9b58ab0ef2d1d06 前后相等；正常重试来源写入成功。校对后独立读回16来源/0任务/0jobs，SHA d25779b8e47532ea6f03bbbca949c1d80d1d578da2185f24bfa1bf089ab3016d。已触发真实下载，文件验证/16输入绑定继续进行。
- boundary: 945保护聚合、70旧静态证据及10日志前缀仍通过；42实现当前存在但部分未验收。模型0请求0费用，自动选择NOT_ENABLED；无真实库/稳定入口/部署。模型识别准确率本轮未测量，原历史失败不改。

## 136. MAINLINE-REAL-INPUT-01首个真实请求尝试与停发 — 2026-09-07

- pre-send: 真实App校对/准备/独立new repository读回形成3个实际下载；STATE固定16原顺序输入/请求及24评分依赖，SHA d478c58f7f44e68a852bc7712c5d3e7994f2390750f5915d65204963dff9e73b。评分与绑定普通漏洞在原白名单闭合，26/26及Node8/8，整包新定向87/87；首次误用completionCriteria类型单列，不冒充业务失败。无旧Expected/源码断言变更。
- review: 新无上下文real_input_first_send_review PASS_SCOPE_ONLY。88个定向检查及新临时账本16个正常模拟请求分列，均不算真实模型。42源码清单SHA f9b386d19f6e703576238c04e8d16085bbbb8786bd20243c51523d515b7302c1；billing SHA 8c227e48e58a525400a713b3127ecb83211c7d317497c94f0ed43b66719e896c。官方人民币价格/Responses文档直接HTTP200及正文核验后，REVIEW.json绑定完整SHA才派发。
- actual-attempt: 使用已获准本机.env仅由Node服务端加载，执行一次--paid=A01；无试连接/额外认证/重试。约10769ms后返回本地网关502/MODEL_CALL_STOPPED_NO_RETRY，raw为0字节，未取得可校验响应/usage；不能称上游返回502、Key无效、模型识别失败或未扣费。
- budget: 1 reserve/0 settle，TRANSPORT_OR_CRASH_UNKNOWN停发；3300000微元完整未知预留保留，实际账单NOT_OBSERVABLE，不报已花3.30元或0元。其余15单元未跑，没有A02/重发/新run重置。独立失败证据复核确认manifest/账本链一致、本地状态与上游观测分开。
- delivery: 整包NOT_COMPLETE，完整工程/最终模型确认和下游Edge未完成。当前仅精确提交失败审计/新证据、短交接和追加日志，42业务源码继续保留未提交，.env不暂存。下一优先是零调用安全错误分类与本机传输定位；恢复付费需保留A01未知预留/失败并明确批准，不能直接再次调用。

## 137. MAINLINE-REAL-INPUT-01零调用诊断续行 — 2026-09-07

- scope: 同包执行下一步，使用bug-detective证据定位；不重发A01、不恢复账本、不改识别语义或原计划。只在获准gateway/对应Node测试及runner报告职责内增加固定安全诊断，原42白名单不扩张。
- preflight: HEAD/live远端3c99268f3db53602aef4f416f729a47820a0119e一致；42源码、945保护、70旧静态证据、旧日志前缀匹配，上一run41文件另全量绑定。起始日志275356字节/SHA9e19998a108ff5869247d8b957ce1994f2a633ef626f3ce91d9add1eac4b8bcc。
- evidence: 新diagnostics-20260907a仅为本包诊断记录，不是新阶段/数据/预算；BASELINE含独立临时根。保留原A01失败与3300000微元未知预留；0新模型请求/费用/密钥/剪贴板/真实库/部署。原调用原因尚不能追认。

## 138. MAINLINE-REAL-INPUT-01安全诊断局部交付 — 2026-09-07

- implemented: 原42路径仅gateway/Node测试/runner3文件变化；固定阶段与允许原因、实际上游HTTP数值、本地HTTP、预留与uncertain追加尝试分开，不回显异常message/stack/头/body/Key。浏览器error body保持，runner未来报告lastDiagnostic；旧A01不回填。零调用模拟正常成功、异常保留全额预留并拒绝后续，未改预算源码。
- tests: 修前旧gateway24通过+新19失败；首次预算+gateway72/1为新测试误认complete已用租约还能再次uncertain，按只读真实接口明确uncertaintyAttempt及原RESPONSE_OR_USAGE_INVALID停机；最终73/73，旧54断言不弱化。原gateway测试内存去新增后逐字SHA还原匹配；各attempt留存不合并样本。无上下文独审73复跑+2附加模拟探针、两语法检查通过，3SHA绑定PASS_SCOPE_ONLY。
- engineering: secret scan1130文件PASS；完整lint2 errors/4 warnings，App1490及FactCorrectionEditor17的react-hooks/refs。两源码本轮SHA未变，不宣称其历史lint通过，不禁用规则或扩大诊断修UI。整包test/build/浏览器仍未完成，候选不晋级、业务源码不提交。
- transport: 当前Node24.18.0/undici7.28.0；系统用户代理启用、代理环境变量存在但当前Node未启用--use-env-proxy或NODE_USE_ENV_PROXY。只核存在性和本机help，不读代理地址/凭据、不改系统或TLS、不做网络探针；不能据此追认A01根因。
- integrity: 原A01及上一run41文件、70旧静态证据、945保护与原日志前缀保持；原1次尝试/0完整响应/3.30元未知预留不变，本轮0新模型/费用/凭据/真实库/部署。新源码使旧发送审核SHA失效，不改旧审核/checker/账本解锁；模型识别准确率本轮未测量。
- delivery: 使用git-push技能仅暂存新诊断报告/5原始日志、短交接和追加日志，42业务源码留本机未提交；精确Git/live远端核验，不强推/变基。下一主线是有界无凭据连接路线诊断，再经明确恢复授权继续未运行单元；不换模型、新数据或重发A01。详细边界/提示词见本run AUDIT，整包NOT_COMPLETE。

## 139. MAINLINE-REAL-INPUT-01获准TLS路线核验 — 2026-09-07

- authorization: 用户明确批准最多2次仅api.deepseek.com的无Key/无正文TLS诊断，原42路径/历史/预算不变。使用bug-detective先核证据；初查本机Clash Verge核心未签名，先暂停发连接；用户已明确确认主动安装并信任，允许本次诊断，不将未签名当恶意或配置存在当供应链证明。
- preflight: HEAD/live远端949e42415dc3bc4dd42a5aeb0697160e1f35fc7b；42源码、945保护、diagnostics11文件、原A01/usage41文件、70旧静态证据和日志前缀匹配。起始日志278436字节/SHA1489e6f76d0d1d4dd5430c8fee7295dcea88e4207cf8ce879dfb861e82ddf1cd。代理127.0.0.1:10081由已核SHA的verge-mihomo启动，父进程为同目录clash-verge并来自Explorer。
- execution: 新tls-route-20260907a仅审计记录，不是新阶段/数据/模型预算。RESULT先占用2个连接诊断名额，各路线仅1次，不重试；代理仅无认证CONNECT至固定目标后端到端TLS证书校验，0应用正文/模型/Key/代理凭据读取。系统/浏览器设置不变；不修改原账本，A01不重发，A02仍禁止。

## 140. MAINLINE-REAL-INPUT-01 TLS核验及零调用工程交付 — 2026-09-07

- transport: 获准两诊断完成，Node直连12012ms期限到未完成TLS验证；经用户信任的现有127.0.0.1:10081代理CONNECT200，293ms完成TLSv1.3证书和主机名验证。无API请求/Key/模型正文，仅固定无认证隧道控制头；次数2/2耗尽，不再探测。不是A01根因、Key认证或模型可用证明；系统/浏览器未改无需恢复。
- engineering: 原42内App/FactCorrectionEditor/acceptance.test仅3文件变更，React组件正式渲染、回调ref在effect更新、新2SSR正常对照，原8断言/确认守卫保持。无上下文独审PASS_SCOPE_ONLY，反向移除本轮增量恢复三旧SHA。定向33/33，lint0错误4警告，TypeScript通过，应用1206通过1既有跳过，Node层62/62，Schema/时间检查及1140文件安全扫描通过，临时构建通过并保留块大小警告。重叠检查不累计，SSR不当浏览器。
- remaining: 原完整npm test历史编排/历史环境/公开依赖审计未重跑，UI变化后Edge未验收；历史3/1 FAIL与旧失败保留。完整包NOT_COMPLETE，42业务源码继续未提交，本轮仅审计Git交付。旧A01/usage41、diagnostics11、70旧证据、945保护及日志前缀保持，模型识别准确率本轮未测量。
- next: AUDIT第5节提出单次A02原账本追加式恢复，未实现/未授权发送；独立复核要求保留A01失败/1次计数/3300000微元未知预留，grant先持久化再发，A02成功失败都停，不自动后续。原账本/STATE/manifest/raw/RESULT未改；0新模型请求/费用，不把原未知预留算已支出。本轮完成后停止，待明确恢复授权；不换模型、新数据或反复索Key。

## 141. MAINLINE-REAL-INPUT-01单次A02恢复授权与起点 — 2026-09-07

- authorization: 用户批准同包原42内7 scripts限定职责、原账本只追加/锁根新收据、固定可信代理/合法服务端凭据仅用于一次A02；零调用测试/独审/官方价格参数通过后才派发，成功失败均停。A01失败/1次计数/3300000微元未知预留及原STATE/manifest/raw/RESULT/收据保持。无试连接/重试/剪贴板/新依赖/真实库/稳定接入/部署。
- preflight: HEAD/live远端afd81ee4e8bac9285287c85f9ea389139bea12f6一致；42源码/945保护/122旧证据/14上轮证据/历史日志前缀核验通过，原944字节账本及3旧收据保持。recovery-a02-20260907a为本包新证据目录，不是新数据或新付费账本。首调用仍待安全门，不改原语义/候选/评分绑定。

## 142. MAINLINE-REAL-INPUT-01单次A02真实响应及停止交付 — 2026-09-07

- implemented: 仅原42内7 scripts，原账本追加式grant消费与预留同锁先落盘，固定可信无认证代理及完整TLS，最终源码/审核/输入/候选/评分/价格绑定，原默认与其他35实现保持。原A01失败/1次/3300000微元未知预留永久保留，原944字节及3收据不变，仅追加recoveryReserve/recoverySettle及2收据；原STATE/manifest/raw/RESULT不改。
- checks: 修前32/35、修后35/35；综合attempt1为91/93、attempt2为92/93、最终93/93，全部保留不累计样本。独立无上下文复跑93/93及另4对抗检查，三旧测试逆向SHA匹配；4语法/7脚本lint0警告/1155文件安全扫描通过。未变35源码按SHA复用1206应用通过1跳过与62Node等旧证据，不称完整门或浏览器完成。
- actual: 只发A02一次，HTTP200/5651ms，输入3781/输出561/reasoning0；费用上界16392微元=0.016392元。总2次、占用3316392微元；A01未知预留3.30元不是确认消费，实扣NOT_OBSERVABLE。公开官方价格/参数HTML与旧SHA一致；合法.env仅服务端通过TLS使用，0剪贴板/代理凭据/新试连接/重试/系统修改。A02完成即停止，无A03/B/C或浏览器竞用。
- quality: 已见匿名no-date单例，任务和requiresAction1/1匹配、无假日期；Complete Case=false、Major Correction=true原评分保持。材料实体、时态/效果、依据归属、描述/完成标准是精确差异，不一概判为理解错误或真人重大修改。独立重算与RESULT一致；总体模型准确率本轮未测量。自动选择NOT_ENABLED；未完成真实A02确认保存/Edge/省时，完整包NOT_COMPLETE。
- integrity-delivery: 945保护、121旧证据全SHA+原账本唯一追加、14上轮证据、3旧收据、日志前缀保持；发送后独审PASS_SCOPE_ONLY。仅新审计证据、原账本追加、短交接与日志Git交付，42实现留本机未提交；下一唯一主线为现有A02零调用回放和差异裁决，不先换模型/救分/买A03。精确授权提示见本run AUDIT；无真实库/稳定接入/部署，本轮交付后停止。

## 143. MAINLINE-REAL-INPUT-01 A02只读回放与差异裁决 — 2026-09-07

- authorization-preflight: 起点HEAD/live远端835ae162071b7181ea5bb325b475113e5108da5d；42最终SHA/945保护/旧静态证据/原账本5事件和5收据/日志前缀一致。本轮仅历史响应只读回放、差异裁决与审计交付，不改产品、Expected/candidate/scorer或原结果；0模型/paid/recover/A03/密钥/剪贴板/原库写入。
- replay: 按原STATE绑定preparation和真实独立repository下载，将原工作区副本载入MemoryWorkspaceRecordStore并走原联合校验；原A02请求SHA/raw/handle保持，来源仍live_model_candidate，不伪称human_engineering。现有completeInputRun/Review/Confirm链路模拟主动核对和选择后确认1条任务，新仓储实例/内存JSON一致，重复不增项，原始/首次保留，0时间0提醒0jobs。4类旧人工正常对照共5条确认，最终25/25检查，不累计重叠attempt，不称浏览器或模型25样本。
- findings: required=true在semanticState转missing，面板“必须提供”，实际排序函数增加缺材料18分（总33），原文仅要求保存，未说明缺少或提交，属于产品事实与展示偏移。present/local_change未改变本例任务与确认；无截止原句保留但摘要粗化为“未说明”。原Complete Case=false/Major标记保留，不等同全部语义错或真人重大修改；总体模型准确率本轮未测量。
- boundary: 实际SemanticFacts/CalendarPage仅SSR；现有launcher只生成seenWire，另一浏览器路径会真实发送，不能承接已付费A02历史响应。实际Edge/逐键/刷新/IndexedDB/下载NOT_RUN，未绕过身份/新建接口或改系统。探针初始化与JSX配置错误只修内存编排；输出截断不计验收，各attempt见新REPLAY。
- decision-delivery: NO_PROMOTION，内部诊断可交付但完整产品NOT_COMPLETE。下一唯一建议在原42内明确批准NEXT_SCOPE的12路径，连续完成历史A02真实App回放与材料必需性/用户准备状态解耦；全局Schema/旧默认/Expected与历史保持，不能承接则精确申请。只提交新4审计文件、短交接与追加日志，42源码仍未提交；A01未知预留和A02已消费grant不动，完成后停止。

## 144. MAINLINE-REAL-INPUT-01 历史A02实际接线与材料核对授权 — 2026-09-07

- authorization: 用户批准 replay-a02-20260907a/NEXT_SCOPE.json 的12路径限定职责；同包完成历史响应真实App回放与材料必需性/当前准备状态分离，0模型调用，不改原评分/账本/历史/旧默认。
- preflight: 本机及远端 c1a5446f0ec58646fbace9e6c460e2c438d89554，42源码逐字SHA、945保护、160旧静态证据、5账本事件及5收据、286643字节日志前缀一致；无重叠修改。基线见 replay-a02-implementation-20260907a/BASELINE.json。
- sequence: 先公共接口正反测试，显式隔离材料核对及原A02绑定入口；定向通过后独审、适用工程及原6631/原隔离库真实浏览器验收。所有未完成项保留NOT_RUN，不将工程结果冒充模型准确率。超范围/保护变化/重大安全问题停止。

## 145. 同包历史回放实现现场与电脑控制停止 — 2026-09-07

- implementation: 原12内修改11路径；显式历史A02哈希绑定接线、原capture内存暂存后原子接入；材料必需性与用户准备状态分离，旧默认/raw/first不变，未核实不能确认。其余31实现不变，acceptance新增覆盖尚未补齐。42当前SHA见本run快照，不重复应用实现。
- checks: 新API未实现时4失败/23通过（不是业务反例）；材料定向27/27；最终3文件60/60，不累计重叠attempt。两次类型退出0。历史A02内存公开入口确认1任务，身份/raw/first保留，0日期0提醒，正常材料状态/回滚/重复/共享及独立对照通过。独立审查/完整工程/新launcher/新版Edge与下载读库NOT_RUN，模型准确率本轮未测量。
- stop: 原6631标签可见，随后官方Windows电脑控制无法可靠确定当前浏览器URL而安全停止；未绕过，不改系统/浏览器设置、不操作原库，不称产品故障。保留现场，仅审计Git交付，业务NOT_COMPLETE。
- integrity: 945保护、160静态证据、5收据及原A01/A02账本保持，旧日志前缀保持；0模型/费用/密钥/剪贴板/真实库/部署。恢复后同包完成独审、工程、实际App闭环；不重做PLAN或调用新模型。

## 146. 同包A02完整用户闭环续作 — 2026-09-07

- authorization: 当前用户粘贴授权原12路径继续实现、定向修补、独立审查、工程、最后实际Edge及Git；普通范围内问题不拆阶段，0模型/密钥/剪贴板，不改历史与账本。
- preflight: HEAD/live远端9909b0c0102bf39eed21190165201922d3d2e529一致；42现场SHA、945保护、160旧静态证据、5收据及账本、288857字节日志前缀一致，保留前11路径实现。首次Git中文路径转义造成检查编排错误，用NUL分隔读取后核验通过，不是产品反例。
- sequence: 在原run追加CONTINUATION证据，不重做PLAN。先完成新acceptance及启动器检查，再独审/工程，最后可靠确认原6631/原库后才实际浏览器；未测项不宣称通过。

## 147. 同包A02接线定向证据与执行/存储边界停止 — 2026-09-07

- implemented: 本轮仅修改原12内acceptance.test.tsx，新增原A02真实App driver内存确认/独立读回、recorded模式缺库拒绝与启动器构建/HTTP处理器身份正反测试；前11实现保留，其他41实现SHA不变。
- targeted: attempt1为61/63，Source生命周期正确推进与bundle属性去引号导致新检查编排失败；attempt2为62/63，模拟HTTP流类型不符；修新测试后attempt3为63/63。旧断言不改、不累计attempt、不当模型63例。真实原回答内存确认1任务，原文/raw/first保留，材料ready与用户选择一致，0时间/提醒/jobs；不当浏览器证据。
- execution-stop: 主代理三次npx vitest未指定隔离envDir/cacheDir，本机Vite默认从根.env读取配置，违反本轮禁止配置访问。只以实际命令/框架源码/.env元数据定位，未重新读取密钥明文；没有模型请求或明文工具输出。此边界FAIL不因定向通过而消除；发现即停止工程/浏览器，仅审计交付。
- review: 无上下文独审12SHA匹配，BLOCKED；browser.tsx直接new IsolatedTestStore，原库缺失时依赖的升级事件会先创建空库，不能只用MemoryStore缺库拒绝证明原库恢复边界。静态可定位，未在真实浏览器触发；审查者0测试/密钥配置/浏览器访问。完整独审与工程、实际Edge/下载读库未完成。
- delivery-boundary: 945保护、160旧证据、5收据、A01/A02账本与旧日志前缀最终核验见CONTINUATION_CHECKS；42业务实现仍未提交，仅新增审计/短交接/日志Git交付。模型准确率本轮未测量，0新增模型/费用/真实库/部署。需恢复授权后同包先隔离测试执行与缺失原库守卫，再完成用户闭环，不换模型或重做PLAN。

## 148. 同包已登记环境与原库打开边界恢复 — 2026-09-07

- authorization: 用户明确恢复上轮两个已登记问题，保留原12范围，产品修复只在recorded browser.tsx及acceptance职责内，旧store/仓储只读；普通范围内问题修复后继续，新的重大安全/范围/保护问题停止。
- preflight: HEAD/live远端bccc453226d35ca50656d84add81921bbd3b768a一致；42源码、945保护、160旧证据、账本5收据与291513字节日志边界匹配。未读取实际.env，未改旧缓存/依赖/旧证据。临时目录与本轮身份见RECOVERY_BASELINE。
- sequence: 框架启动前显式禁用env读取并加读取守卫，新临时env/cache/build，先无密钥哨兵正反验证；再原库打开升级事件正反验证、独审/完整工程/原6631真实App与下载读库。0模型及费用。
- recovered: 仅browser recorded模式增加先于旧store的升级事务中止/非v1拒绝，acceptance新增事件反例与正常对照；定向64/64。新测试漏传必填initialText在获准路径补空值，旧断言未弱化；其余40源码匹配旧快照，42最终SHA见RECOVERY_IMPLEMENTATION_SNAPSHOT。
- engineering: lint0错误4警告、App类型第二次及Node类型PASS；全量第一次1230/1超时/1跳过，第二次1231/0/1跳过，worker2且旧断言/timeout不变。Core Node62/62、Schema/时间两门、历史逐字20文件及原封4/4、当前依赖兼容13、build/稳定14JS隔离、安全1194文件0发现、依赖0漏洞。预算/gateway首次编排缺fixture4/80，显式新test-temp后独立83/83；旧checker历史HEAD/fixture门未完成，不混作全PASS，各attempt保留。实际根.env本轮未读取，旧默认读取FAIL不改写。
- actual-edge: 原6631/原tab/原库，真实IndexedDB两次同名probe升级中止、oldVersion[0,0]/旧建表0；未提交probe库或清库/回退。独立new repository读原库16Source/0Task，SHA b7c08ed26349a7ad5e1a67236058aa9c91ed6b678a2cf210647f5d59473b758a。原A02真实回答回放进入同库待确认，刷新收件箱能找回并打开真实面板；非新的模型调用。
- scope-block: 实际面板将真实A02误标人工工程响应，DraftReviewPanel.tsx:148硬编码与App.tsx:1514接线缺口，当前12路径不授权改两公共文件。原文/raw/first及live_model_candidate保留，未以标签问题推断存储篡改。独审确认最小需App/Panel两例外，当前不修且不正式确认，后续逐键/材料保存/下游/真实下载NOT_RUN。
- delivery: 恢复差异独审PASS，最终交付BLOCKED；只RECOVERY报告/约80行交接/追加日志审计提交，42业务保留未提交。945/160/旧CONTINUATION证据/账本5收据/日志前缀按RECOVERY_CHECKS核验；0新增模型/费用/密钥/剪贴板/真实库/部署，模型准确率本轮未测量。下一步同包批准两文件来源说明接线，保留现有待确认现场，不重做PLAN或A02。

## 149. 同包真实模型来源说明与原库确认续作 — 2026-09-07

- authorization: 用户明确批准原42内App/Panel仅来源说明接线，原12路径及全部保护保持，普通范围内缺陷连续修复；0模型/密钥/剪贴板/新数据/真实库/稳定接入/部署。
- preflight: HEAD/live远端ef76d6e80b230398b30ef2a3b4cc490c96736b84一致；42实现、945保护、160旧证据、7 CONTINUATION及30 RECOVERY证据、账本5收据和294441字节日志前缀逐字核验通过。新临时env/cache/build目录见LABEL_BASELINE。
- sequence: 先真实面板来源标签反例/旧默认正例，再最小修复、独审、适用工程；保留旧历史HEAD门原结论，最后原6631/原库现有A02逐键核对保存确认/刷新/实际下载与独立读库，不重复模型或重做PLAN。
- implementation: 仅App/Panel来源说明接线及acceptance新增2回归；旧实现/断言通过独审内存逆去增量恢复SHA，其余39源码一致。Before14/2预期失败，After66/66；旧默认与能力限制不变。
- engineering: 独立代码审查PASS，lint0错误4警告、两类型PASS、功能1233/0/1跳过、Schema/时间两门、Core Node62/62、旧checker当前7/7；历史付费HEAD三测单列NOT_RUN，不修改旧脚本救门。新build稳定14JS隔离、安全1226文件0发现；未变预算83/历史20字节文件及4库测试/依赖兼容13/旧审计0漏洞按SHA复用，不当新运行。
- browser: 原6631/原库原A02建议恢复；真实标签正确，材料必需性和准备状态分别主动保存。两个注入故障分别在材料保存/正式确认时全对象回滚，已保存历史不丢。标题逐键追加-A02、明确保存/核对/主动选择后正常确认1Task，1用户观察ready材料，0时间/提醒/实际jobs；刷新首页/任务中心/详情/日历独立无日期列表找回。
- export: 实际下载mainline-real-input-01-workspace.json，218242字节，文件SHA049459c4d4dd6ac5ac18a3e2966a05cb7bea136cf7bd901a315738379fefa1bf；解析全对象SHA cf3aa420daee3f6c66a2d206440e8f5ef67fff92c5955f8f5aecefcdb1e38770与实际new repository读回一致，v8/联合校验通过。原始/首次/输入/来源版本六比较不变；重复A02回放后全对象不变。
- boundary: 本轮A02_REPLAY_LOOP_PASS，不宣称整个真实输入包或识别准确率已达标。详情旧历史占位仍未接新语义（上方完整记录可见），正式编辑/提醒/ICS未测；实际多任务/跨标签/中文IME/全格式及真人时间另列。0新增模型/费用/密钥/剪贴板/真实库/部署，A01/A02账本5收据/945保护/160旧证据保持。精确42业务及新LABEL报告交付须最终复核无阻断；若复核失败只交付审计。主线下一建议为其余已准备小批真实语义质量验证，不重测A02。

## 150. 同包 A03–A08/B01–B08 完整闭环续作 — 2026-09-07

- authorization: 用户批准原42路径当前批次编排与原限定职责；仅14未派发单元、总16次、3.30元滚动预留/10元，原A01/A02/评分/账本前缀保持。按原U01–U16补缺，不重做PLAN；一名独立审查者；普通范围内缺陷连续修复。
- preflight: HEAD/live远端ae78dfef255eb5344868d1b4319e486537ac6681，工作区干净；42实现/945保护/160旧证据/CONTINUATION/RECOVERY/LABEL、5收据与日志前缀核验。BATCH_BASELINE保留原尾hash/3515字节账本和297254字节日志；0新增请求。
- execution: 先接续派发最小安全验证与冻结输入/评分依赖核验，再A03及余项；真实OCR/文件与代表性浏览器验收随后。原24评分依赖中两个客户端模块已有合法修复，先核旧评分环境可恢复证据，不以新模块冒充旧评分；官方价格与参数核验进行中。框架禁根env，临时输出隔离。
- result (2026-09-08): 原授权14次全部完成并合法结算，累计16；A01未知3300000微元保留。新249084微元、含A02已结算265476微元，总占用3565476微元，非实扣账单；不再调用。原评分A完整1/8、B1/8，已见同源8通知，质量不接受，不改原答/Expected/评分。实际评分10文件闭包匹配原绑定，并未宣称原准备+评分24项全不变。
- implementation: 原42内9文件当前批次grant/runner/checker、原库recorded_batch回放和集成测试；旧默认保持。无效修订raw保留失败，12有效引用回答正常接入，不强转空结果。独审修正recorded_batch工程载体入口关闭，最终9源码PASS；模型安全和最终回放SHA分别保留。
- engineering: 功能1234通过/1旧skip，预算42、core34、multimodal23、类型/契约/build通过。首次lint新增cause错误修复后17影响测试及明确eslint命令exit0；4旧警告与各失败attempt保留。当前RCO旧库门3/1 package-lock哈希失败仍单列，历史快照4/4与兼容13及旧审计按SHA复用，不改旧freeze救门。
- browser: 原6631/原库真实Edge A05条件true、B02 JPEG校对后逐键编辑/显式保存/材料观察/主动选择成功，新增2任务。原A02七实体集合不变；3任务3材料0时间0提醒0jobs，刷新四下游找回。A04纯信息明确核对0任务，重复A05全对象不变。B01实际材料核对后COVERAGE_EVENT阻断，A08/B08失败raw保留。U全套未通过，不冒充商业/盲测/真人时间。
- export: 实际文件mainline-real-input-01-workspace (1).json 748141字节，文件SHA5417a3d5a185620972b73c6661a0b07b081df0f6e54218167857ee4ddb85b327；全对象6d6b57a98b1ec1a241aca2065c9076e2e58c0c404b37e530ae099297d0094919与先行独立new repository读回一致，联合validator通过。工程浮层遮挡引起下载监听超时，收起后文件成功，不把工具观察失败当产品故障。
- boundary: SCOPED_REPLAY_LOOP_PASS / WHOLE_PACKAGE_NOT_COMPLETE / MODEL_QUALITY_NOT_ACCEPTED；945保护/160旧证据及所有旧前缀保留。完成最终复核后仅交付明确验收增量与本轮证据，不承诺开放试用。下一唯一主线为来源约束的条件/事件/修订纠错到确认保存，不能自动改冻结契约、继续付费或部署。
- delivery: 2026-09-08最终独立复核PASS，80文件精确业务提交10b9effcbfb50dc5f1363ede1f39ec67bfe549d4已推送并核对远端一致（9源码、68本轮报告/原始日志、短交接/追加日志/账本）。提交后42工作树原SHA与Git归一化blob逐项核对、945保护及账本前缀保持。原始日志11个空白/EOF告警保留，不改原日志过格式门；源码和文档diff检查通过。只追加交付回执与短交接，不再调用模型/改产品，整包未完成结论保持。

## 151. 复杂通知纠错到确认保存 — 2026-09-08

- 用户授权同包42路径内来源约束的漏项、条件、事件和修订人工纠正；0新模型请求，不改原答/评分/账本或稳定入口。
- 起点本机与远端764358554953fb8ccf2b5e714f88584365ae26a5，工作区干净，42逐字SHA匹配；945保护聚合df68e4eda47f664f9f0fbf218a74687117ac3cc9d2c14f5ee6e9965cd2c28394一致。
- 本轮顺序：B01关系纠正与失败修订恢复→定向正反例→实际面板保存确认→适用工程与Git。只读原始结果，用户修正不算模型首次质量提升。状态IMPLEMENTING。
- result: 42内15实现/测试增量；B01分别/批量及A08/B08失败修订公开接口4/4通过，原答/失败Run/评分保持。新增条件/事件/漏项/修订的明确保存与来源留痕，未保存阻止确认，已确认不覆盖。不是模型首次质量提升。
- engineering: 定向83通过；全量1241通过/1旧skip/0失败，最终变化影响层44通过；Node57通过，类型/lint/build/Schema时间契约通过，4旧lint警告保留。根环境读取禁用，新临时输出，无新依赖。各层不累计冒充样本。
- browser: 用户打开原Edge后官方控制仍Emulation.setFocusEmulationEnabled超时；一次新同origin标签ERR_BLOCKED_BY_CLIENT，不证明产品故障。原6631/原库保留，最终recorded_batch服务upstreamEnabled=false。本轮真实旅程及新结构下载NOT_RUN，不以本机测试替代。
- boundary: 945保护及70旧静态/25旧工程日志核验一致，账本34条不变，原日志297254字节前缀逐字保持；0模型/费用/密钥/剪贴板。仅交付审计，15实现未提交。下一步同授权恢复官方浏览器后补组合旅程/独立读库/新结构下载，成功才业务提交，不重做计划或付费。
- browser-close (2026-09-08): 用户继续纠错→保存确认→刷新读库→实际下载。起点5b8f10b，42逐字SHA不变；官方Edge tab763114894恢复，原服务退出后同6631 recorded_batch恢复，未清/建/fallback库。B01两项逐键事件纠正、材料与事实核对，先保存1项；A08保留失败原答，补旧纸质要求与替代关系，旧项拒绝；明确选项后跨草稿批量再保存2项。只选来源未选任务的批量0新增负例保留。
- browser-result: 刷新真实任务中心6项、材料6、时间2、提醒0/实际jobs0；旧3任务和材料逐对象不变。日历9月10/11日18:00上海及A08无日期独立列表/详情正确；旧纸质要求无正式任务，原失败Run仍failed，raw/first/用户纠正分开。BROWSER_VALIDATION联合validator通过。实际文件925716字节SHA019eca29ab19fa96d4b303032d54e6d4fd5a7082a699768148f0769c6454909f，全对象a3ea9835a6fde772efb356ebf9bce6405b0ff978257e5fdd8cb5d5b55538b883与先行new repository读回完全一致。监听超时但文件真实取得，不称产品下载故障。
- delivery-scope: CORRECTION_REPLAY_LOOP_PASS，15实现可业务交付；旧审计NOT_RUN保留为历史，新增BROWSER_*补验。42实现与11工程日志未变，复用1241通过/1旧skip、最终影响44、Node57等，不重复全跑。945保护、70旧静态、原日志边界及账本不变，0模型/费用。整体产品/首次模型质量/真人时间未通过或未测；B01同面板2项批量仅本机测试，真实跨草稿批量不混报。旧兼容状态/历史文案列待办，不修改只读组件。下一主线集中首次建议错漏与文件读取完整性，付费另行授权。

## 2026-09-08 candidate02首次建议优化（审计交付，浏览器未闭合）
- 起点f5e2c54106b1d363eea41246a980a2f7822ff044；44路径、945保护、334旧包证据及原日志前缀核验。旧raw/Expected/scorer保持。
- 一个新候选C01–C08共8次成功，累计24次，0 verifier/Repair/retry；原账本34条前缀不变，追加后51条。新费用上界0.162228元，累计结算0.427704元+A01未知3.30元，占用3.727704元；实际扣款不可观测，不再派发。
- 原严格task8/9/9(P/R88.89%)，Complete1/8；C06 false与C08旧新修订改善，C03模糊时间仍漏实体。已见开发验证，不是盲测或商业成绩。
- 本机全量1250通过/1原skip，C05/C08独立回放核对确认通过；最终影响33项及修正编排断言1项通过。类型/lint/build/契约/安全通过；失败attempt与旧4lint警告保留，不累计尝试数。
- 本机实际OCR三图、PDF文本+栅格OCR四文件五页取得输出；混合扫描内容会被仅文本层漏掉。错误/警告和原输出保留，Node引擎不是Edge链路。
- 原Edge独立读库6任务/jobs0，C08新回答载入仍6任务；自动刷新被拦截、手动刷新后控制超时，未做新确认/新下载。无清库/fallback/防护绕过，不称产品故障。
- 仅本轮审计/追加账本/短交接提交推送；实现保留未提交。下一步恢复官方控制后补C08和混合PDF代表性旅程，复用未变工程，不重做计划/重调模型。FINAL_AUDIT与IMPLEMENTATION_SNAPSHOT为续接入口。

## 2026-09-08 read-close 本机读取校对接线（Edge待补，仅审计交付）
- 起点f3b1ed68604e3f95c25894ee4717b1eed2072ec9/远端一致；44现场、945保护、334旧证据加48前轮证据、完整51条账本及旧日志前缀核验。
- 当前recordedCandidate02开放真实InputReview localOnly：读取/OCR比较/明确保存可用，模型UI与处理器均禁止发送；local-review新来源与旧A/B/C输入、已确认任务分离，旧默认不变。仅5个获准实现文件在本轮变化。
- 受影响43/43；C03时间覆盖缺实体继续拒绝，C05/C08有效任务可确认并独立内存读回；旧内容保持。类型/lint/build通过，当前checker正反1组通过；遗漏manifest参数的失败attempt原样保留。旧1250/1skip按SHA复用，不混为本轮全跑或浏览器。
- 官方原Edge tab763114892选择/刷新成功后点击Runtime.evaluate超时，截图宽度0；已一次请求用户置前展开并手动刷新，不继续重复自动化。不称产品故障，未清库/fallback/改防护。
- B08混合PDF实际校对恢复和C08实际确认刷新独立读库仍NOT_RUN；没有新浏览器写库或下载证据。本轮0模型/费用/密钥/剪贴板，账本全文不变。
- READ_CLOSE_AUDIT/CHECKS/IMPLEMENTATION_SNAPSHOT记录现场；仅审计提交，未经验收实现保留未提交。唯一下一动作是原库补两条浏览器旅程，未变工程复用，不重做PLAN或加调用。

## 2026-09-08 delivery-browser：存量PDF校对与C08真实确认补验
- 起点12a8087ff82ca94eacafa749cdc883b576a1e5ed，44实现/945保护/382旧证据/51账本及日志前缀核验；本轮0源码修改、0模型/费用/密钥。
- 官方Edge原tab763114892恢复。原库已有B08真实文件读取Source，代理恢复→采用实际OCR→逐键整理→2次明确保存→刷新恢复；原始文本/OCR与历史保持，sendSnapshot=null。初次上传不属于本轮观察；追加重传尝试fileChooser Not allowed，未绕过、未新建Source，不计上传PASS。
- C08既有Run/Draft核对材料required=true/missing、事实后只选有效提交任务并确认1项；旧打印作废保持无正式绑定。刷新任务中心/日历无日期/详情找回，原6项逐对象不变，新共7项/时间2/提醒0/jobs0。
- 操作前后真实new repository按钮读回全对象，实际下载与独立读回一致；最终全对象e789d9a39a15d6f11b1d449444f7def1493dd23b51ae7802e768311289baf8fe，文件1002971字节SHA1711a6a7027aac8e17e6b31350b24780a4008ab0641592690b4fa1da325dbff2；联合validator通过。原raw/first/input/send不改。
- 文件审计初稿误将Source合法确认状态变化视为不变字段，最终精确验证status与确认时间转移，其余字段保持；不修改产品/旧断言。存量读取与C08补验通过，新上传自动化仍未验收。
- 未变43项/类型/lint/build与旧1250项按SHA复用；仅精确交付已有实现及DELIVERY_*补验。旧NOT_RUN/失败和模型评分不改，C03/首次材料错漏及商业化仍未解决，完成后停止。

## 2026-09-08 candidate03 首次时间材料优化开始
- 用户明确授权同包新增一个候选与8次请求、历史累计最多32次；原账本10元及A01未知预留保持。未满足结构/输入绑定/发送安全前0派发。
- 起点c39f7e814b85acd494dc9c161ee0d24fa4e1d03f，本机远端一致；44实现、945保护、382历史、51账本和日志前缀通过。新增两候选路径，其余原职责不扩展。
- 先验证现有wire/AST/composer能否承接正确模糊时间和材料，再决定候选；原评分和业务差异分列，规则在candidate03-20260908a/AUDIT.md记录。

## 2026-09-08 candidate03 D批结果与未完成交付
- 正确工程响应可表达模糊时间/明确截止/真无日期及材料归属；制作单一candidate03，不叠加同义警告。原8份同C文字固定后运行D01–D08，各一次成功；原账本51→68行，累计32次，0 verifier/Repair/retry。最初D01本地400无预留/模型请求，失败文件保留；真正派发为Dxx_DISPATCH。
- 新用量最高价结算上界0.153336元，全部已结算0.581040元，A01未知3.30元保留，总占用上界3.881040元。8次等待59024ms；不是账户实扣或真人编辑时间。
- 严格任务8/9→9/9、时间1/3→1/3、材料0/2→1/2（预测6→4）、Complete仍1/8。材料减少主要是任务对象冗余，PDF/A4等价文字与引用差异单列；D03仅保留另行通知，结构化仍漏近期。业务重大时间补正数量未降，不自动采用新候选，不加调用追分。
- 回放版本与原App零发送入口已接线，但D01被原A01 queued保护阻断；保留失败正例，不改A01、不削弱pending检查或全局capture。D02/D05内存确认独立读回成功，D03拒绝模糊错误确认。定向39/1、全量1261/1/1旧skip；类型/lint/build/稳定隔离/契约与安全检查通过。原attempt不覆盖。
- 官方Edge连接成功但新bundle刷新ERR_BLOCKED_BY_CLIENT；一次请求手动刷新，没有清库或替代库，没有新的浏览器确认写入。本轮真实旅程未完成，不将内存当Edge。
- 945保护、402旧证据、原51账本前缀、原候选/评分/回答和日志前缀通过。只提交审计/真实结果/账本和交接；源码保留未提交。最小下一授权为已结算历史回放非派发追加Run职责，runtime/semanticRepository/acceptance三文件，不改全局capture、不调用模型。

## 2026-09-08 D01非派发回放收尾（进行中）
- 起点f951348，原46实现/945保护/402旧证据/68行完整账本核对一致；只修改runtime、semanticRepository、acceptance三处获准职责。旧14未提交实现保留，不重复应用。
- 已结算回答在私有内存构造完整终态后，CAS单事务追加Run/Draft；旧A01运行、旧7任务及旧响应不变。回放凭据显式禁止派发；源/版本/请求/原答不一致在真实写入前拒绝。
- 原D01失败正例通过，D02/D05可确认、D03模糊待核对，新增身份篡改/回滚/重复/禁止派发共6项定向通过。全量1263通过1失败1旧skip，唯一失败为新增多次全图读库测试的默认5秒超时；只将新增用例超时与同组60秒一致，断言不弱化，受影响组另验。各attempt保留。
- 类型、lint及构建/稳定bundle隔离通过；一次针对性写入边界复核完成，不重复审核未变预算和密钥模块。框架禁用根.env并使用新临时输出。
- 原测试标签已关闭，用户恢复同origin原库tab763114931；官方控制持续Debugger unattached，停止工具重试。已提供一组最少手动确认及独立仓储证据下载步骤，真实D01验收尚待文件，未冒称通过。
- 本轮0新增模型/费用/密钥/剪贴板/账本修改；无候选、Expected、评分、全局仓储/校验器改动。远端核验两次TLS握手失败，未改证书或代理设置，收尾再核验。
- 收尾补充：最终定向6/0，去重合并1264通过/0未解决/1旧skip，类型/lint/build通过。945保护、402旧证据、起点40静态文件、完整68账本与日志前缀保持；检查首尝试字段名误用证据保留，实际仅本轮授权3源码变化。收尾ls-remote恢复并核验f951348一致。
- 用户要求自行处理浏览器连接：官方getTab/claimTab/DOM均报Debugger unattached，清单仍显示精确6631测试页；本机日志无具体脱开原因。已定位控制扩展调试通道，不能证明是某拦截器或产品故障。无浏览器D01确认/读库证据，不将内存通过写成真实旅程通过；仅审计提交，保留14实现。恢复建议为重启Codex后原库继续，不重做实现或付费测试。

## 2026-09-08 D01真实Edge恢复验收
- 用户继续授权，起点05546ae与远端一致；46实现逐字SHA不变，945保护/402旧证据/68账本保持，复用上轮定向与工程证据，不重复实现。
- 官方Edge控制已恢复原tab763114931；独立new repository读回原7任务且无D01新记录，下载real-input-local-evidence (6).json。页面读库SHA与实际文件workspace全对象SHA同为e789d9a39a15d6f11b1d449444f7def1493dd23b51ae7802e768311289baf8fe。
- 首次载入Failed to fetch：重启Codex后6631服务未存活，未写库；恢复同origin只读回放服务upstreamEnabled=false并刷新后载入D01成功，仍7正式任务，新待核对draft为source:72b67d35:recorded:recorded-candidate03-D01:draft。本轮0模型/密钥/账本修改；接着完成实际确认与读库。
- D01两项分别保存材料/事实核对并主动确认，刷新后原7→9任务、+2时间/+2材料；9月10/11日18:00的Asia/Shanghai值及各自材料归属、格式、数量保持。准备状态为代理匿名工程场景输入，不是真人观察。
- 官方真实App任务中心/日历/两详情与独立new repository读回通过；重复载入D01后全workspace相同，全部旧任务/Run/Draft/来源版本/时间/材料/历史不变，A01 queued/processing保持，0提醒/0实际jobs。
- 实际下载before(6)/after(7)，after workspace SHA a3cf54895f825e0e7d5874eeb1ed7bba135527f3f7194bb5908d57871f4e7b1d，文件与浏览器独立读库一致。另点产品导出按钮未观测新产品文件，不冒称其本轮再次PASS。
- 最终46源码不变，945保护/402历史/47静态证据/68账本与日志边界保持；复用6/0定向、按身份合并1264/0/1及类型/lint/build/安全证据。详见D01_BROWSER_AUDIT/CHECKS，精确14业务实现及报告交付，不宣称模型准确率提高。

## 2026-09-08 明确任务、日期待定确认（同一MAINLINE-REAL-INPUT-01）

- 用户新授权47路径，CalendarPage为原945保护中的唯一例外；起点3519b5760d6b795666d6502cf33c34c877142daf本机/远端一致、工作区干净，46源码逐字一致，945保护/402旧证据/当前53静态/68行账本核验不变，基线见PENDING_TIME_BASELINE.json。
- 公开接口复现：D03只有“具体截止时间另行通知”，补充遗漏的“近期”旧接口拒绝；旧确认仍拒绝模糊日期。新增人工时间依据追加与明确日期待定接受操作，原答/首次/时间needsConfirmation不变，正式任务仍须逐项核对并主动确认。
- 首轮新验收3通过：旧9任务保持、补充双原文/空规范化日期、明确接受/事实核对/确认、保存故障回滚/篡改拒绝及独立仓储读回。日期待定独立日历区域使用可选runtime参数，旧默认不变。针对性复核补充缺日期但多个时刻冲突的保守拒绝，不改唯一时间AST。
- 本机类型App/Node通过，lint0错4旧警告，契约/时间生成只读核验、安全扫描、稳定构建隔离通过。受影响21文件261测试首attempt260通过1失败：启动器测试缺少公开工程载体路径环境变量（不是密钥）；不改断言，将显式提供原载体路径重验失败层及最新日期待定检查。
- 官方Edge原标签763114931可控制；同origin只读回放服务恢复最终实现后导航被Edge拦截ERR_BLOCKED_BY_CLIENT，已一次请求用户手动恢复，不循环尝试或改防护。尚未浏览器载入/确认D03，仍9正式任务。0模型/密钥/账本/稳定/部署。
- 补充最终结果：用户打开了另一个同网址新标签，重绑后D03载入成功。自动goto/reload/错误页刷新仍ERR_BLOCKED_BY_CLIENT，未定位具体扩展或策略；用户恢复原标签，代理完成后续操作，不把自动刷新写为PASS。
- 真实App逐键补充近期→保存→明确接受日期仍待定→保存事实核对→主动选择确认；9→10任务。两条时间原文保留、normalizedValue均null、needsConfirmation均true；日历独立日期待定区、详情操作记录可找回，用户报告刷新后代理再查询与独立读库一致。
- 实际下载real-input-local-evidence (8).json共907297字节，文件SHA3db3fb699da45b6afaf66b194e49333413239de0d239cea4785493bf80877db8；全对象SHA c45f55d098e8f31e02ca2ca7cf7ef4d5f629eda38e1763c9fce72195cccfcc91，与事先UI独立new repository读回一致并通过联合validator。旧9任务/Run/Draft/版本/时间/材料/依据/历史不变，重复回放全对象不变，0提醒/0实际jobs。
- 原失败启动器配置与最终新3测试合计4/0；按独立身份合并受影响261通过0未解决。最终类型/受影响lint通过；一次针对性确认安全复核、契约/安全/稳定build隔离通过，未机械重跑全历史。旧断言未弱化。
- 47路径实际改11源码/测试；944只读保护、402旧证据、53原静态、68完整账本与日志旧前缀保持。旧8日志Git换行差异改用原READ_CLOSE_CHECKS逐字SHA核对全部一致，未改日志/旧保护。PENDING_TIME_AUDIT/CHECKS记录完整边界。模型准确率本轮未测量，0新增调用与费用；进入精确Git交付后停止。

## 2026-09-09 首次识别优化与新材料配对（同一 MAINLINE-REAL-INPUT-01）

- 起点22686cb2a04f08e26d913b97629d5ff1deb76286本机/远端一致、工作区干净。47源码、944只读保护、402旧证据及68行账本逐字核验不变；新BASELINE另绑定455既有报告文件及最新日志前缀。
- 本轮批准candidate04两新路径、12新匿名合成通知×03/04两臂24次，历史最多56次、原10元/3.30元预留不变。先固定候选再制作通知，参考只评分；产品与模型成绩分别报告。不重做PLAN。
- 完成24新请求（累计56），原账本追加grant与48请求收据，A01永久未知预留不变；本批usage结算上界0.675897元，总已结算1.256937元，加预留总占用4.556937元。N04-03非法枚举拒绝计分仍留分母；无重试或加调用。
- 严格任务15/23→23/23、时间4/18→11/18、材料7/15→7/15、修订0/3→3/3；业务无需重大纠正均7/12。模糊时间和旧新引用改善，但新N03/N12真正无日期表达退化，不自动采用candidate04。12新合成通知是首次开发验证，不是独立盲测。
- 已结算新来源回放经绑定核对、私有内存完整组装后一次CAS；同臂重复幂等、另臂重复来源拒绝、不可重派发、无确认权限。当前回放及发送边界自检通过，不称独立第三方复核。
- 原Edge/6631/原库完成N01-04两项批量确认及N06-04旧要求拒绝/新任务确认、刷新任务中心/日历/详情和独立读库。10→13任务、+3时间/+3材料；全部旧记录不变，0提醒作业。材料missing为代理匿名工程观察，不是真人研究或模型首次预测。
- 实际下载real-input-local-evidence (9).json为1101702字节，全对象SHA3525c9aeef2fb39b5936a4b143682142f8e612926b3aec9635215ecb463f1dc6，与先取得的独立new repository读回一致，联合validator通过。未影响的OCR/旧时区证据复用。
- 最终受影响216测试、预算/网关100测试、checker/launcher定向7项通过，类型/lint/构建/契约/安全与稳定bundle隔离通过；失败attempt分别保留，不累加冒充样本。944保护、455旧证据、旧68行账本和日志前缀不变。15实现/测试/脚本及本轮报告精确Git交付；不接稳定、不部署，交付后停止。

## 2026-09-12 同一包candidate05与DeepSeek-V4.1-Flash

- 用户明确批准53路径、03/05同新模型配对24请求、累计80及原10元上限；起点7a132355本机/远端一致。49原源码、944保护、455旧证据和117行完整账本逐字核对不变；BASELINE追加绑定上一轮67项最终证据。
- 首先实现新wire投影与反向引用组装，保留语义未知和缺失；旧候选/原评分器/全局组件只读。候选/组装器未冻结前不创建新通知，不派发模型。
- 当前测试/类型仍在进行，浏览器NOT_RUN，不预先宣布通过；完整报告集中于runs/candidate05-20260912a。
- 完成DeepSeek-V4.1-Flash（请求/返回deepseek-flash）24次新合成通知配对，原账本现80请求/166行，旧117行前缀与166收据一致。只发送文字及scope，无重试。usage本批结算上界0.508872元、历史结算1.765809元，A01未知3.30元保持，总占用5.065809元，实扣不可观测。
- candidate05不采用：03/05可组装12/12与2/12，05有9份null覆盖状态误用、1份取消引用悬空；代理逐例语义无需重大纠正11/12与9/12，原严格整份均0/12。原始模型理解、本机组装和用户确认分别报告，参考/原答/候选/评分不改，12份不是独立盲测或商业准确率。
- 38候选/组装/wire、102预算/网关、新5原答内存确认通过；全量1292项首次1290通过/1失败/1既有跳过，漏传carrier参数的失败层补参数后通过，最终1291通过+1跳过，未改旧断言。类型/lint/构建/契约/安全通过，失败attempt保留，不叠加定向数量。
- 内存P01-03两任务、P05-05成立条件、P03-03无日期共4任务人工核对确认并独立读回；官方Edge只发现id2，读取标签列表持续nodeRepl.fetch request failed，未能选标签或访问原库，不能替代两条真实旅程/旧13任务核对/下载。最终6631只读回放服务upstreamEnabled=false；待官方连接恢复后仅补该验收。
- 53最终源码、944保护、522旧静态证据及18候选闭包核验，历史及日志前缀未改。本轮只精确提交审计/原答结果/账本追加，业务源码保留未提交快照；整包未完成，不接稳定、不部署、不自动派发或改下一候选。

## 2026-09-13 同一包candidate06同材料配对收尾

- 用户批准55路径、candidate03/06同deepseek-flash配对24次，累计104及原10元上限；起点c419aea63a1f6595cb0140cde00eb89dcc092759，本机/远端一致。保留原17未提交文件；当前21业务文件未验收提交。
- 首先核对53现场SHA、944保护、607静态证据及旧166行账本；发送前固定候选、原12份已见通知、原参考/评分、请求及55源码审核。只复用原wire，无新组装器或数据集，种子20260913平衡6/6先后，不是盲测。
- 本批24/24 HTTP成功且可解析；原严格整份两臂均0/12，任务匹配19/19→18/19、材料10/17→10/17且误项7→12。代理重大语义纠正通知1/12→2/12，不等于零核对率或结构完整率。Q11两臂仍多拆袋子任务，06还漏真实归属；Q12-06漏旧发送实体形成悬空取消引用，candidate06明确不采用，禁止补调用追分。
- 原CALL_LEDGER现215行、215收据、104请求；旧166行前缀逐字保持，链/收据逐对象一致。本批usage结算上界0.530872元，历史2.296681元，A01永久未知3.30元，总占用5.596681元；实扣NOT_OBSERVABLE。本次恢复0新增请求，不读取密钥/剪贴板。
- 最终全量1310项：1309通过、1既有跳过、0失败。预算/网关107、候选11、paired06定向7及绑定检查通过，分层不叠加。3实际Q回答内存确认4任务并独立仓储读回，raw/first/修订保持；Q03 0时间/0提醒/jobs0。材料准备状态是显式测试用户选择，不冒充模型预测或真人操作。
- 类型、lint、构建、契约、安全通过，4既有lint警告和失败attempt保留。派发后仅acceptance.test.tsx增加实际回答测试；生产和发送依赖未变，已有工程日志按SHA复用。框架禁用根env文件读取，临时env/cache/out独立，无依赖变化。
- 官方浏览器恢复仍在标签清单时报nodeRepl.fetch request failed，未访问原6631库；此前官方Windows URL验证限制不绕过。两条真实Edge旅程、原13任务本轮核验、实际新下载/独立读库NOT_RUN。并非已证实产品故障，也不循环刷新。
- NO_PROMOTION：模型比较/工程完成，candidate06不采用；因浏览器缺证据本次只精确提交审计/原答结果/账本和短交接，21业务实现保持未提交快照。唯一剩余动作是恢复官方连接后完成原库Q01/Q07确认与下载收尾，不接稳定、不部署、不自动候选07或模型调用。
- 审计交付116a3d3e86cb427eb9e07d8cf430372d3cbde2f1已推送并精确核对远端，80个精确路径无业务源码。提交后55源码、944保护、607旧证据、账本全SHA及日志原前缀再次匹配。ENGINEERING_LINT.log原始末尾空行触发Git空白提示，保留原日志字节，不改工程结果。DELIVERY.json记录交付与Git文本规范化映射；本次继续0新增模型请求。

### 2026-09-13 原6631与官方连接收尾

- 起点本机/远端aa6f985042fbf3d2277fbcba251d969f4725bff1；55源码、944保护、607静态证据、冻结依赖及215行完整账本匹配。原日志326474字节前缀保留。
- 原6631无服务（ECONNREFUSED），恢复现有recorded-paired06回放服务后本机HTTP200，upstreamEnabled=false；无模型、密钥或数据库操作。启动会话跨Codex退出存活未验证。
- 一次官方cua.getState仍nodeRepl.fetch request failed，apps/browsers空；未获得标签，不再循环刷新/转Windows尝试。Q01/Q07真实确认、刷新、独立读库及下载NOT_RUN，不归因于已证实的产品故障。
- 仅新增CLOSE_AUDIT/CLOSE_CHECKS和短交接；其中集中列明可由用户一次完成的前后独立读库文件及确认步骤。复用未变1310项工程证据；21业务文件保留未提交，本次仅审计交付，不改候选/原答/评分/账本或部署。
