# E2.9-R2 Transport Failure Diagnosis

## 结论

R2 Screening 的阻断 observation `e29r2-8c2a5bf193747fb266f1aa042b904b48` 不是 RecognitionResult Schema 错误，而是 DeepSeek 上游 HTTP 成功响应的 JSON 正文被截断：

- HTTP Content-Type：`application/json`
- 响应字符数：7,339
- UTF-8 字节数：8,179
- JSON 错误：未终止字符串，位置 7,339
- 首字符：JSON object 起始 `{`
- 末字符：不是 `}` 或 `]`
- 上游响应 SHA-256：`88f088dc902060a903f43dd36b5b79473c9d858c4b565e9f989e896e560e97be`
- 分类：`TRUNCATED_JSON_BODY`

正文仍只存在于 Git ignored R2 cache，本诊断不提交正文片段、用户内容或 Secret。

## 发现的审计缺口

冻结 R2 调用实现会在解析 provider response 失败时提前返回，因而内部 `attempts` 尚未写入，形成“上游已经调用一次，但 attempts 数组为 0”的证据缺口。这不表示没有发出请求；现有 Cloudflare 响应头、持续时间、响应字节及哈希证明收到了 provider response，但冻结失败对象没有把这一事实结构化。后续 Harness 已将 attempt 登记提前到“收到 HTTP 响应”时点，成功解析后才把状态更新为 `ok`。

## 后续 Harness 增量

本分支增加 hash-only transport evidence：

- `wrapperUpstreamInvocationCount`：R2 wrapper 对冻结上游实现的调用次数；
- `providerAttemptRecords`：底层实现实际写入的 attempt 记录数，避免把 0 冒充“未调用”；
- `providerResponseBytes` 与 `providerResponseSha256`；
- `providerContentType` 与 provider request-id 是否存在；
- `TRUNCATED_JSON_BODY`、`MALFORMED_JSON_BODY`、`NON_JSON_HTML_BODY`、`EMPTY_RESPONSE_BODY`、HTTP/timeout/network 等有限分类。

这些字段随失败写入 immutable Durable Object ledger。它们不包含原始正文，且不会改变 no-rerun 规则、Prompt、Schema、Expected 或评分器语义。

## 边界

- R2 protocol 3.0.0、既有 checkpoints、结果与结论保持冻结，不回填新字段。
- 新增 transport-integrity 模块不追溯加入 protocol 3.0.0 bundle；未来获批的新协议必须显式把该模块与修改后的 Worker 调用链纳入新 bundle hash。
- 本增量未部署 Preview，未调用模型，未触碰 Production。
- 当前 R2 仍为 `EXPERIMENT_BLOCKED / quality NOT_AVAILABLE`。
- 未来若要再次评测，必须另行授权新协议、全新 run label 与 observation IDs，并从 Readiness 完整重跑；不得补跑当前失败 observation。
