# Recognition Optimization Log

本文件是 RCO 的追加式事实账本。旧记录不得覆盖；指标订正追加到 Corrections，阶段状态只在有新证据时更新。完整原始输出留在受保护或 Git 忽略位置，日志只记录路径、哈希、计数、指标和安全错误类型。

## 1. 状态索引

| Entry | 阶段 | 唯一变量/目的 | 数据 | 调用 | 结果 | 决策 | 下一门 |
|---|---|---|---|---:|---|---|---|
| RCO-DOC-001 | Docs | 冻结商业级识别主线、门槛、日志、上下文、提示词与验证契约 | 现有代码/报告 | 0 | PASS (DOCS) | WAIT_AUTHORIZATION | RCO-0 未授权 |
| MM-V2-001 | 历史诊断 | T/I/IT 正式配对 | Synthetic-Unseen-V2 | 108 计划，107 完成 | IT 因 1 次失败失效 | DO_NOT_LAUNCH | 保留为诊断 |
| MM-V3-I-001 | 历史复验 | 直接图片复现 | Synthetic-Unseen-V3 | 36 | I Task F1 71.29%，完整正确率 0 | DO_NOT_LAUNCH | 保留为诊断 |

## 2. 当前权威状态

- program: `Recognition Commercialization Optimization`
- status: `PLANNED / RCO-DOCS PASS / WAIT_AUTHORIZATION / DO_NOT_LAUNCH`
- branch: `codex/e2-multimodal-recognition-exp`
- protected_release: `v2.0.0-beta.1-rc.4`
- production_status: `UNCHANGED`
- stable_default_path: `本机解析/OCR → 用户核对文字 → 只发送文字`
- image_path: `逐次显式授权；Preview-only；仅待确认建议`
- human_timing: `NOT_RUN`
- real_deidentified_holdout: `NOT_RUN`
- next_authorized_action: `NONE；等待用户明确授权 RCO-0`
- next_implementation_gate: `RCO-0；尚未授权实施`
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
| RCO-G0 | 评测与产品链路一致 | NOT_STARTED | shared validation/reclassification | 未授权 |
| RCO-G1 | 严格 Schema | NOT_STARTED | schema/validator/repair | 未授权 |
| RCO-G2 | 唯一时间 AST | NOT_STARTED | AST/tests/migration note | 未授权 |
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
