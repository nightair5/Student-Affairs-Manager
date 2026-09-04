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
