# RCO-0 Experiment Audit

- date: `2026-09-02`
- auditor: `GPT-5.6-Sol ultra fresh read-only reviewer`
- review_independence: `same-family`
- acceptance_status: `provisional`
- overall_verdict: `PASS`
- integrity_status: `pass`
- RCO-G0 recommendation: `PASS for evaluation integrity only`

本报告只审查 RCO-0 的评测一致性、离线历史重分类和证据保护。它不证明模型质量、真实材料泛化、真人修改时间、浏览器验收、Preview 或 Production 资格。

## A. Ground Truth Provenance — PASS

- V2/V3 的 Expected 来自作者确定性模板，不是模型输出；两份 freeze 明确标记为 `synthetic_proxy`。
- freeze 记录逐例 source、image、Expected 和 OCR 哈希，并发生在对应模型调用之前。
- 重分类脚本固定两轮 dataset、OCR、checkpoint、summary 和 freeze 共 10 个输入哈希；输入只能读取。
- 证据分类保持为合成代理，未冒充真实学生材料 ground truth。

## B. Score Normalization — PASS

- `src/recognition/evaluation.ts` 与 `scripts/multimodal-evaluation-lib.mjs` 的空分母返回 `null`，不再产生真空满分。
- 只有全部计划单元均为客户端有效 `completed` 时才计算正式质量指标；部分、失败或无效运行返回 `INVALID_RUN` 和空质量指标。
- 指标不按模型自身最大值或成功子集归一化；配对只报告原始差值和 semantic-family cluster bootstrap。
- 技术可评分状态命名为 `VALID_RUN` / `SCOREABLE`，不冒充质量门或发布 `PASS`。

## C. Result Existence and Numerical Matching — PASS

独立只读复算与报告一致：

| Run | Arm | Planned | Model return | Client-valid | Other | Reclassification |
|---|---:|---:|---:|---:|---|---|
| V2 | T | 36 | 36 | 0 | 36 invalid | `INVALID_RUN` |
| V2 | I | 36 | 36 | 1 | 35 invalid | `INVALID_RUN` |
| V2 | IT | 36 | 35 | 2 | 33 invalid + 1 transport | `INVALID_RUN` |
| V3 | I | 36 | 36 | 0 | 36 invalid | `INVALID_RUN` |
| V3 | T / IT | 0 | 0 | 0 | not executed | `NOT_RUN` |

- 原 scorer 的 core summary 必须先逐字段精确复现；不一致时脚本直接失败。
- V2 107 个、V3 36 个 truthy 历史结果的旧/新 Boolean 客户端判断 mismatch 均为 0。
- Tracker 与 `RCO-0_RECLASSIFICATION.json` 的状态和计数一致。

## D. Dead Code and Contract Alignment — PASS

- Node 评测器直接读取并内存转译浏览器实际使用的 `src/recognition/schema.ts`；没有写出第二份漂移 Schema。
- Runner 对每个 truthy 结果调用完整客户端校验；续跑中原先 `completed` 的结果也重新校验。
- `scoreCase` 默认 fail-closed；只有调用者明确标记 `completed` 才能进入质量评分。
- HTTP、auth、billing、rate-limit、model、JSON、schema、reference、semantic、scoring 和 transport 分开；非 2xx 的非 JSON 错误体仍按 HTTP 状态归类。
- 新 summary contract 已升至 `multimodal-evaluation-summary-1.2.0`。

## E. Scope Assessment — PASS

- 每轮只有 12 个独立 semantic families，各渲染为 screenshot、photo 和 scan，共 36 份材料。
- V2/V3 共享有限语义模板，不能解释成 72 个独立真实案例。
- 新报告明确拒绝外推商业正确率、视觉优越性、真实材料、Preview 或 Production 结论。

## F. Evaluation Type — PASS

- V2/V3 与本次重分类：`synthetic_proxy`。
- Node 单元和契约测试：`simulation_only`。
- `real_gt`: `NOT_RUN`。
- `human_eval`: `NOT_RUN`。
- `self_supervised_proxy`: `NOT_APPLICABLE`。

## G. RCO-0 Integrity — PASS

- `NOT_RUN` 与 `INVALID_RUN` 区分正确；未测试臂若携带 observation 会 fail-closed。
- 受保护的 10 个输入既有固定 SHA，也在运行前后重新计算；审计复核时全部匹配且未变化。
- Forbidden 不读取 description；`selected:false` 的 task/material/time/event 均不评分。
- Evidence Validity 与 Evidence Coverage 分开。
- 重分类脚本没有网络调用，拒绝 endpoint/model 参数，只能在显式 `--write` 时写两份新 RCO-0 报告。
- 未发现 Secret、部署、模型调用、受保护输入写入或 RCO-1 范围扩张。

## Reviewer-driven Corrections

审计过程中发现并修复：非 JSON HTTP 错误分类、truthy 默认完成、续跑结果未重校验、untested observation、保护哈希覆盖不足、summary 版本漂移、固定生成时间，以及技术状态误用 `PASS`。修复后 Node 专项测试为 21/21 PASS，审计重新读取最新工作树后给出本结论。

## Claim Impact

- “RCO-0 评测器会阻止客户端拒绝结果进入质量分数”：`supported`。
- “历史 V2/V3 原始 scorer 可精确复现后追加重分类”：`supported`。
- “历史图片直识别正确率约 71%”：`unsupported`；那只是旧 scorer 诊断。
- “多模态优于文字版或值得上线”：`unsupported`。
- “真实材料泛化、真人提效、浏览器验收或商业候选门通过”：`not_run`。

## Final Boundary

RCO-G0 可从评测完整性角度通过，但审查独立性仍是 `same-family / provisional`。阶段结论保持 `NO_PROMOTION / DO_NOT_LAUNCH`，不得自动进入 RCO-1。
