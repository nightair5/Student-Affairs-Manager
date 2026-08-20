# E2.9 R6 Screening Regression Diagnosis

日期：2026-08-21

状态：`REPAIR_READY_FOR_FRESH_SCREENING`
边界：不修改 Prompt、Schema、评分语义、Expected、Workspace v8 或 Production 默认路径；仅加强 Scorer 输入完整性校验。

## 结论

R6 Screening 中两条 `Flash preferred` 不是同一类问题：

1. `e2-gen-08-2`：Pro 原始结果将“中午”规范化为 `12:00` 且不要求确认；冻结 Development 契约本身接受这一确定性映射。因此旧盲评将其判为重大错误属于评审契约缺失，而不是可确认的模型质量退化。
2. `e2-gen-07-1`：Pro 原始结果把明确的参加、集合、签到义务判为 `requiresAction=false`，没有 Task，也没有资格歧义；这是可确认的模型退化。Flash 原始结果生成了两条 Task，但通用 normalizer 又因同时存在 Event 而删除这些 Task，放大了两臂的规划错误。

此外，旧 R1 benchmark 端点把规范化结果的 `modelName` 固定继承为 Flash；Pro observation 的 requested/returned model 虽正确，`result.modelName` 错误。这是 lineage 完整性缺陷，旧 R6 Screening 不得作为最终替代决策依据。

## 最小泛化修复

- 明示、带逐字证据且来源声明 `requiresAction=true` 的参加、集合、到场、上岗、参会或出席 Task，与 Event 同时保留；仅无明示行动或纯信息事件继续去重。
- Benchmark 请求与响应保留 `semanticRole`，但不把该标签发送进模型 Prompt。
- `requestedModel`、`returnedModel`、`executionModel` 与 `result.modelName` 由服务端实际返回模型统一注入并强制一致。
- Benchmark normalizer 从伪标记 `DISABLED` 改为显式版本 `e2-v4-pro-benchmark-normalizer-2.1.0`。
- Path-masked 盲评契约声明冻结中文时间等价规则：单独“中午”规范化为当地 `12:00` 或保守待确认均可接受，不能仅凭这一差异判重大错误或路径优劣。
- 协议升级为 `e2-9-v4-pro-protocol-3.5.0`，Harness 升级为 `e2-9-r6-preview-harness-1.4.0`；qualification bundle 扩展覆盖 Prompt、normalizer、validator、benchmark Worker route、runner、Gate、path masking、ledger 及部署契约。

## 重跑规则

- 旧 Screening label 与 review label 全部冻结，不覆盖、不补跑。
- 使用全新 Preview deployment、全新 Readiness label 和全新 Screening label。
- 生成期间不读取 Expected；完整 16 个 observation 结束后统一评分。
- Screening Gate 任一条件失败，Selection 保持 `NOT_RUN`。
- Screening Gate 全部通过后，才允许执行 Selection 剩余最多 32 次调用；Blind 与 Production 始终禁止。
