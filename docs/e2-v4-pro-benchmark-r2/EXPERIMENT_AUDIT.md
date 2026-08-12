# E2.9-R2 Experiment Integrity Audit

**Date:** 2026-08-13

**Auditor:** fresh Codex same-family reviewer（独立只读、provisional）

**Scope:** Protocol 3.0.0 R2 harness、限定缓存证据、提交 `da49a85755ba2f40221ff86ba87efb0309b4040e` 与 `a3f4fb6`

**Overall verdict:** **WARN**
**Acceptance status:** **PROVISIONAL**

## 结论

现有证据支持：

- 实验状态为 **`EXPERIMENT_BLOCKED`**。
- 模型质量结论为 **`NOT_AVAILABLE`**。
- 不得根据本轮数据推断 Pro 优于或劣于 Flash。

核心完整性控制通过。`WARN` 来自两处需要收窄的证据表述：Readiness 并不存在真实生成结果的 `result.modelName`；Preview cleanup 与 Production 未触碰只能在现有本地记录范围内成立。本次审计没有发现会推翻上述阻断结论的完整性缺陷。

## Blocking findings

### B1. Screening 完整性失败阻断所有质量阶段

正式 Screening 的第 4/16 个 observation `e29r2-8c2a5bf193747fb266f1aa042b904b48`（`e2-holdout-25`，Flash）以 HTTP 502 / `UPSTREAM_JSON_INVALID` 终结。实际执行为：

- Readiness：2/2 complete，`GENERATION_COMPLETE`；
- Smoke：10/10 complete，`GENERATION_COMPLETE`；
- Screening：3 complete + 1 immutable failure 后停止，`INTEGRITY_FAILURE`；
- Scoring：`NOT_RUN`；
- Selection：`NOT_RUN`；
- Blind：`NOT_CREATED`。

最终 ledger 停留在 `SCREENING_OPEN`，因此完整 Screening checkpoint 不存在，Scorer、Selection 和 Blind 均不可达。证据见 `.evaluation-cache/e2-9-r2/protocol-3.0.0/checkpoints/e29r2-screening-20260813-a.json`、`.evaluation-cache/e2-9-r2/protocol-3.0.0/ledger-final.json:1`、`docs/e2-v4-pro-benchmark-r2/screening-result.json:10` 和 `docs/e2-v4-pro-benchmark-r2/SCREENING_REPORT.md:7`。

### B2. 质量比较没有可评分证据

Scorer 在读取 Expected 前要求完整 paired Screening checkpoint，并会对不完整 checkpoint 抛出 `INCOMPLETE_CHECKPOINT_NOT_SCORABLE`（`scripts/score-e2-9-r2.mjs:55`、`scripts/score-e2-9-r2.mjs:69`、`scripts/score-e2-9-r2.mjs:79`、`scripts/score-e2-9-r2.mjs:90`）。限定缓存中没有 scoring 目录，文档目录中没有 `screening-aggregate.json`，而结果明确记录 `scoring: NOT_RUN`（`docs/e2-v4-pro-benchmark-r2/screening-result.json:70`）。因此任何 Pro/Flash 质量优劣结论均不受支持。

## Integrity checks

| 检查 | 状态 | 证据与判断 |
|---|---|---|
| R1 不复用 | PASS | Protocol 明确禁止评分、复用或选择性补跑 R1（`docs/e2-v4-pro-benchmark-r2/EXPERIMENT_PLAN.md:5`）；source-only manifest 明确排除 Expected、scores、prior outputs 和 R1 observations；R2 计划使用 28 个唯一 `e29r2-*` observation IDs（`scripts/prepare-e2-9-r2-manifests.mjs:83`、`scripts/prepare-e2-9-r2-manifests.mjs:113`、`scripts/prepare-e2-9-r2-manifests.mjs:117`）。|
| Protocol、labels 调用前冻结 | PASS | preparer 拒绝覆盖既有冻结产物（`scripts/prepare-e2-9-r2-manifests.mjs:61`）；run labels、bindings 和完整 observation plan 在调用前生成（`scripts/prepare-e2-9-r2-manifests.mjs:119`）。冻结产物、activation 与首次 Readiness checkpoint 的时间顺序一致。|
| Pure information 全链 | PASS | normalizer 保留 semantic role，`information_only` 要求 `requiresAction=false` 且 0 业务实体（`cloudflare/e2-r2-benchmark.mjs:72`、`cloudflare/e2-r2-benchmark.mjs:77`）；Smoke 两个 arm 的实际结果均满足该约束，role 在 plan、请求、execution 与 result 中一致。|
| 四路模型身份 | WARN | 13 个 generation complete observations 的 `requestedModel = returnedModel = executionModel = result.modelName`；ledger 对全部 15 个 complete records 也保存四个一致字段（`cloudflare/e2-r2-benchmark.mjs:86`、`cloudflare/e2-r2-benchmark.mjs:173`、`cloudflare/e2-r2-ledger-worker.mjs:93`）。但 Readiness 没有真实 `result`，其 ledger `resultModelName` 由 returned model 填充（`cloudflare/e2-r2-benchmark.mjs:146`、`cloudflare/e2-r2-benchmark.mjs:148`），故“全部 15 个都有真实四路生成身份”应收窄。|
| 失败 checkpoint 不可 COMPLETE | PASS | gate 仅在数量完整且全部 `status=complete` 时返回 `GENERATION_COMPLETE`，否则为 `INTEGRITY_FAILURE`（`scripts/e2-9-r2-integrity.mjs:3`）；runner 遇到首个错误即停止并保留失败 gate（`scripts/run-e2-9-r2.mjs:146`、`scripts/run-e2-9-r2.mjs:150`、`scripts/run-e2-9-r2.mjs:152`）。|
| 机器阶段前置 | PASS | DO 仅允许规定的单向阶段转换；生成阶段必须全部 preregistered observations complete，Scoring 与 Selection 另有机器 gate（`cloudflare/e2-r2-ledger-worker.mjs:67`、`cloudflare/e2-r2-ledger-worker.mjs:112`、`cloudflare/e2-r2-ledger-worker.mjs:122`、`cloudflare/e2-r2-ledger-worker.mjs:127`）。实际 stage history 只到 `SCREENING_OPEN`。|
| Scorer hash 绑定且未执行 | PASS | Scorer 复算全部 bundle、manifest、activation、checkpoint、Prompt/Pipeline、Schema、scorer semantics 与 observation hashes，并 fail closed（`scripts/score-e2-9-r2.mjs:48`、`scripts/score-e2-9-r2.mjs:69`、`scripts/score-e2-9-r2.mjs:74`、`scripts/score-e2-9-r2.mjs:77`、`scripts/score-e2-9-r2.mjs:79`、`scripts/score-e2-9-r2.mjs:86`）。实际证据支持未执行。|
| DO 幂等与失败不可覆盖 | PASS | observation 在上游调用前 reserve；重复 ID 返回 409；finalize 只允许一次 reserved token，终结后不能覆盖（`cloudflare/e2-r2-ledger-worker.mjs:67`、`cloudflare/e2-r2-ledger-worker.mjs:75`、`cloudflare/e2-r2-ledger-worker.mjs:90`、`cloudflare/e2-r2-ledger-worker.mjs:92`）。实际失败为 final、0 retry、未覆盖。|
| Bundle 覆盖部署链 | PASS | `protocolAndDeployment` 覆盖主 Worker route、R2 wrapper、冻结 R1 调用实现、DO ledger、Preview flag/service binding、ledger Wrangler、package/lock、preparer、runner 与 scorer（`scripts/prepare-e2-9-r2-manifests.mjs:100`、`scripts/prepare-e2-9-r2-manifests.mjs:105`；`docs/e2-v4-pro-benchmark-r2/bundle-hash-manifest.json`）。Activation 绑定 protocol bundle 与两次部署 version。|
| 实际执行与停止规则 | PASS | 三份 checkpoint 与 final ledger 一致证明 2 readiness、10 smoke、3 screening complete、1 immutable failure，且失败后没有后续 observation。|
| Cache ignored | PASS | `.evaluation-cache/e2-9-r2/protocol-3.0.0/` 由 Git ignore 规则排除，原始响应、checkpoints 和 ledger 不受 Git 跟踪。|
| Preview cleanup / Production 边界 | WARN | 当前 Preview flag 为 false（`wrangler.jsonc:37`），`preview-deactivation.json` 记录 bearer Secret 删除、未授权请求 404 与既有 Production version。但这些是本地记录；本次禁止联网，不能独立确认 Cloudflare 当前状态或排除仓库外操作。|
| 报告 hash 与 token/latency 算术 | PASS | 三份 checkpoint SHA-256 与 ledger SHA-256 均逐文件一致；Readiness、Smoke 与 partial Screening 的 completed 数、token 总数和 latency mean 均可由缓存 observations 复算并与 `screening-result.json`、`SCREENING_REPORT.md` 一致。|

## Limitations

1. 本审计为 fresh same-family review，结论仅为 provisional，不是 cross-family accepted audit。
2. 按任务约束未调用模型、未联网、未部署；因此无法实时验证 Preview Secret、远端 feature flag、Cloudflare deployment history 或 Production 当前状态。
3. Git-ignored 缓存可证明当前快照内部一致，但不是远端不可篡改审计日志；本审计不能排除审计范围外文件、删除过的本地文件或仓库外操作。
4. Readiness 是最小真实请求，不产生 RecognitionResult；其四路身份只能按 ledger lineage 理解，不能等同于 generation observation 的真实 `result.modelName`。
5. Screening 未完成且 Expected 未读取，因此本审计不评价模型准确率、泛化能力或成本效益。

## Claim impact

- `EXPERIMENT_BLOCKED`：**SUPPORTED**。
- `qualityConclusion = NOT_AVAILABLE`：**SUPPORTED**，且是本轮唯一合规质量结论。
- “Pro 优于 Flash”或“Flash 优于 Pro”：**UNSUPPORTED / PROHIBITED**。
- “15 个 complete records 的 ledger 四字段一致”：**SUPPORTED**；若称“15 个真实生成结果均具备四路身份”，则 **NEEDS QUALIFIER**。
- “Preview 已清理且 Production 未触碰”：**SUPPORTED WITH LOCAL-EVIDENCE QUALIFIER**，不构成实时云端确认。

## Final disposition

保持 `EXPERIMENT_BLOCKED`，保持质量 `NOT_AVAILABLE`；不得补评分 partial Screening、不得复用 R1、不得进入 Selection、Blind、E3/E4 或 Production。未来如重启，必须使用新协议授权、新 run label、新 observation IDs，并从 Readiness 完整重跑。
