# E2.9-R2 Benchmark Harness Integrity Repair — Screening Report

## 结论

**EXPERIMENT BLOCKED**

R2 Harness 修复已通过本地、Worker 和 Preview Smoke 验证，但正式 Screening 在第 4/16 个 observation 收到 `UPSTREAM_JSON_INVALID`。该失败已由服务端 immutable ledger 终结，未重试、未覆盖；阶段状态停留在 `SCREENING_OPEN`，checkpoint 为 `INTEGRITY_FAILURE`。因此本轮没有读取 Expected、没有执行 Scorer、没有创建 fresh adjudication labels，也没有比较 Pro 与 Flash 的模型质量。

## 协议执行

| 阶段 | 计划 | 实际 | 状态 |
|---|---:|---:|---|
| Readiness | 2 | 2 complete | `GENERATION_COMPLETE` |
| Smoke | 5 case × 2 = 10 | 10 complete | `GENERATION_COMPLETE` |
| Screening | 8 case × 2 = 16 | 3 complete + 1 immutable failure 后停止 | `INTEGRITY_FAILURE` |
| Scoring | 完整 Screening 后 | 0 | `NOT RUN` |
| Selection | Screening Gate PASS 后 | 0 | `NOT RUN` |
| Blind | Selection Freeze 后 | 0 | `NOT CREATED` |

失败 observation：`e29r2-8c2a5bf193747fb266f1aa042b904b48`，case `e2-holdout-25`，Flash arm，HTTP 502，错误 `UPSTREAM_JSON_INVALID`。它不能选择性补跑；若未来重启实验，必须另建协议授权、全新 run label 与全新 observation IDs，从 Readiness 开始完整重跑。

## Harness 修复验证

- `pure_information` role 已进入 source manifest、phase manifest、observation plan、请求、benchmark normalizer、result/checkpoint 与 Gate 校验；Smoke 的 Flash/Pro 均正确接受 `requiresAction=false` 且 0 业务实体。
- 所有 13 个 complete generation observations 均满足 `requestedModel = returnedModel = executionModel = result.modelName`；服务端以实际 returned model 覆盖 Prompt 中的默认 Flash 字段。2 个 Readiness 请求没有 RecognitionResult，只验证 `requestedModel = returnedModel = executionModel`，不把 ledger 中由 returned model 填充的 `resultModelName` 冒充真实生成结果。
- checkpoint 状态由 observation 完整性派生；任一 `integrity_failure` 必然得到 `INTEGRITY_FAILURE`，无法得到 COMPLETE。
- Durable Object ledger 在上游调用前占位 observationId；失败只能终结一次，重复 observation 在上游前拒绝。
- Readiness→Smoke→Screening→Scoring→Selection→Blind 为服务端机器状态机。此次 Screening 未完成，所以 Scoring/Selection/Blind 均不可达。
- Scorer 的 Manifest、Prompt/Pipeline、Schema、Scoring semantics、Protocol/Deployment、Activation 与 Checkpoint hash 校验已通过单元测试；因 Screening 不完整，真实 Scorer 按协议没有执行。
- protocol bundle `e2a1a90db3aad7f4055b01a760d400a3649366712f51ecc6f4d040116146bfeb` 覆盖 Worker route、Preview feature flag/service binding、benchmark wrapper、ledger Worker/Wrangler deployment chain、package lock、runner 与 scorer。

## 运行观测（不构成质量比较）

Smoke 完整的 5 对中，Flash 共 20,222 tokens、平均 8,448.4 ms；Pro 共 20,357 tokens、平均 13,873.2 ms。Screening 仅有不平衡的 1 个 Flash 与 2 个 Pro complete observation，相关 latency/token 只保留在聚合 JSON 中，不作比较或外推。

R1 observation 未评分、未复用；本轮 partial Screening 也未评分。任何“Pro 优于或劣于 Flash”的结论均为 `NOT AVAILABLE`。

## 哈希与原始证据

- Readiness checkpoint SHA-256：`3e890722bf0da6774e05916a07c8c2080390a0453ece196620e2a9bc1a2aaf0e`
- Smoke checkpoint SHA-256：`118d49f2109d92d017d8af2136289dc87f83f4374412a8d020cf5c1b4a09db6f`
- Screening checkpoint SHA-256：`c692c4ac4e88f46c5e9ebb14cc3a039e4aedfa635b568cac469d85774f207998`
- Final ledger snapshot SHA-256：`9f03c67e9e57a1742fd8b234fafbddc33da09fe77bc030b2e01be7ea29c7316d`

原始请求/响应、checkpoints 与 ledger snapshot 仅保存在 Git ignored `.evaluation-cache/e2-9-r2/protocol-3.0.0/`；Git 只提交匿名聚合和审计文件。

## 安全收尾

本轮执行期间的 Cloudflare 只读核验记录显示：Preview feature flag 已恢复为 `false`，短期 `E2_R2_BENCHMARK_TOKEN` 已删除；无授权探测恢复 404，Preview secrets 仅剩既有 `DEEPSEEK_API_KEY`。当时读取到的 Production 最新部署仍为 2026-08-08 的 `3b6d6ba2-e21f-495c-80e4-c4bac62366be`，本轮未调用或部署 Production，未修改 `student-affairs.site`。独立审计按只读离线边界没有再次联网，因此将这些外部状态标为“受本地执行记录支持”，而非第二次实时云端确认。

本轮在此 STOP：不补跑 Screening，不进入 Selection/Blind，不进入 E3/E4。
