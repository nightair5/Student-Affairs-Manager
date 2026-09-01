# RCO-1 三端严格 Schema 契约

**状态**：`RCO-G1 PASS / ZERO MODEL CALLS / NO_PROMOTION / DO NOT LAUNCH`

**唯一变量**：Worker、浏览器与评测器对 `RecognitionResult 2.0` 的结构、引用与证据判定口径。

**不属于本阶段**：Prompt/模型/时间 AST/Expected/数据集/缓存/真实材料/部署。

## 1. 单一事实来源

- 权威源：`src/recognition/schema.ts`。
- 浏览器：直接导入并执行权威源。
- 评测器：`scripts/load-client-recognition-validator.mjs` 在内存中转译并执行同一权威源。
- Worker：`scripts/generate-recognition-contract.mjs` 从权威源生成 `cloudflare/recognition-contract.generated.mjs`；生成文件首部固定记录源 SHA-256。
- 漂移门：`npm run recognition:contract:check`；源与生成物不一致立即失败。

因此三端没有三份手写 Schema。生成物不可手工编辑，也不能用 Worker 的宽松归一化替代严格校验。

## 2. Worker 执行顺序

1. 解析上游 JSON。
2. 仅写入服务端可确定的执行信封字段：`promptVersion`、`modelName`、`createdAt`。
3. 在任何归一化前执行共享严格校验；失败则返回安全的 `failureCategory` 与最多 20 条 `{category, code, path}`，不返回正文、图片、quote 或 referenceId。
4. 只有候选已严格有效时才执行既有归一化。
5. 对归一化结果再次执行同一严格校验；归一化若制造悬空引用或非法值，同样失败关闭。
6. 两次都通过后才返回 `result`；结果仍只是待确认建议。

Worker 不再通过补 `requiresAction=false`、生成实体 ID、丢弃坏 evidence/reference、把非法日期改成 `null` 等方式把不合格候选伪装成合格结果。

## 3. 显式失败类别

| 类别 | 代表代码 | 含义 |
|---|---|---|
| `schema` | `REQUIRED_FIELD_MISSING`、`DUPLICATE_ENTITY_ID`、`DUPLICATE_EVIDENCE_ID`、`SCHEMA_INVALID` | 字段、类型、范围或唯一性不满足契约 |
| `reference` | `TASK_TIME_POINT_MISSING`、`TASK_EVIDENCE_MISSING`、`EVENT_TIME_POINT_MISSING` 等 | 跨实体或 evidence 引用悬空 |
| `semantic` | `TIME_POINT_NORMALIZED_VALUE_INVALID`、`EVIDENCE_QUOTE_NOT_IN_SOURCE` | 日期在日历上不成立，或证据逐字内容不在本次文字来源中 |

图片版没有可传给模型的 OCR 正文时，不在 Worker 内伪造证据逐字核验；其图片证据仍需由离线冻结真值评测。文字版和图片+文字版必须在 Worker 与评测器中使用实际发送的 OCR/本机提取文字核验证据。

## 4. 一次 Repair 的纯契约

RCO-1 只实现并测试 Repair 护栏，不发起 Repair 模型调用：

- 最多 `1` 次；第二次直接 `REPAIR_ATTEMPT_LIMIT_EXCEEDED`。
- Repair 后必须通过同一严格 Schema、引用、日期和来源证据校验。
- 不得新增任务、材料、时间、事件、里程碑、工作包或 evidence 语义；否则 `REPAIR_NEW_SEMANTIC_ENTITY_FORBIDDEN`。
- 不得删除既有 conflict/ambiguity；否则 `REPAIR_FAILURE_DELETION_FORBIDDEN`。
- Worker 本阶段明确返回 `attempted:false` 和 `NOT_AUTHORIZED_IN_RCO_1_ZERO_CALL_VALIDATION`。

未来若要真正调用 Repair，必须另获模型调用授权，并记录脱敏前后 hash、错误代码集合、结构 diff 与 harm；不得保存完整正文或图片。

## 5. RCO-G1 技术验收

- 共享契约生成漂移检查通过。
- 浏览器、Worker 生成契约和评测器对有效、缺字段、重复 ID、悬空引用、非法日期的完整报告逐项一致。
- Worker Mock 对上述故障及证据不在来源中全部失败关闭，错误响应不泄露正文或证据 quote。
- 一次结构 Repair 可通过；新增事实、删除失败和第二次 Repair 全部失败。
- 全量 lint、typecheck、test、build、security scan、audit 与 Cloudflare dry-run 通过。
- 受保护的 Expected/freeze/dataset/checkpoint/cache 哈希不变；模型调用、Secret、真实数据和部署均为 0/未使用。

通过只代表 RCO-G1 技术契约成立，不代表模型正确率提高、商业门通过或允许上线；完成后必须停下等待 RCO-2 单独授权。
