# Recognition Optimization Log

本文件是 RCO 的追加式事实账本。旧记录不得覆盖；指标订正追加到 Corrections，阶段状态只在有新证据时更新。完整原始输出留在受保护或 Git 忽略位置，日志只记录路径、哈希、计数、指标和安全错误类型。

## 1. 状态索引

| Entry | 阶段 | 唯一变量/目的 | 数据 | 调用 | 结果 | 决策 | 下一门 |
|---|---|---|---|---:|---|---|---|
| RCO-2-001 | RCO-2 | 统一中文时间 AST 与确定性归一化 | Mock / 匿名夹具 / 历史输出只读 | 0 | PASS (TECHNICAL) | NO_PROMOTION / DO_NOT_LAUNCH | RCO-3 未授权 |
| RCO-1-001 | RCO-1 | 统一 Worker、浏览器和评测器严格 Schema 契约 | Mock / 匿名夹具 | 0 | PASS (TECHNICAL) | NO_PROMOTION / DO_NOT_LAUNCH | RCO-2 未授权 |
| RCO-0-001 | RCO-0 | 评测有效性与客户端严格校验一致，并重分类历史证据 | V2/V3 受保护 checkpoint 只读重放 | 0 | PASS (INTEGRITY) | NO_PROMOTION / DO_NOT_LAUNCH | RCO-1 未授权 |
| RCO-DOC-001 | Docs | 冻结商业级识别主线、门槛、日志、上下文、提示词与验证契约 | 现有代码/报告 | 0 | PASS (DOCS) | WAIT_AUTHORIZATION | RCO-0 未授权 |
| MM-V2-001 | 历史诊断 | T/I/IT 正式配对 | Synthetic-Unseen-V2 | 108 计划，107 完成 | IT 因 1 次失败失效 | DO_NOT_LAUNCH | 保留为诊断 |
| MM-V3-I-001 | 历史复验 | 直接图片复现 | Synthetic-Unseen-V3 | 36 | I Task F1 71.29%，完整正确率 0 | DO_NOT_LAUNCH | 保留为诊断 |

## 2. 当前权威状态

- program: `Recognition Commercialization Optimization`
- status: `RCO-2 COMPLETE / RCO-G2 PASS / NO_PROMOTION / DO_NOT_LAUNCH`
- branch: `codex/e2-multimodal-recognition-exp`
- protected_release: `v2.0.0-beta.1-rc.4`
- production_status: `UNCHANGED`
- stable_default_path: `本机解析/OCR → 用户核对文字 → 只发送文字`
- image_path: `逐次显式授权；Preview-only；仅待确认建议`
- human_timing: `NOT_RUN`
- real_deidentified_holdout: `NOT_RUN`
- next_authorized_action: `NONE；等待当前用户单独授权 RCO-3`
- next_implementation_gate: `RCO-G3；尚未授权，不得开始`
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
| D-005 | 模型输出收敛为事实账本 | 大 Schema 造成事实与规划竞争 | PROPOSED；待 RCO-5 消融 |
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
| RCO-G3 | 多格式本机提取 | NOT_STARTED | DOCX/PDF/text/OCR fixtures | 未授权 |
| RCO-G4 | 分介质 OCR | NOT_STARTED | OCR ablation / quality routing | 未授权 |
| RCO-G5 | facts-first | NOT_STARTED | fact schema / task composer | 未授权 |
| RCO-G6 | 事实级融合 | NOT_STARTED | frozen T/I/IT result | 未授权 |
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
