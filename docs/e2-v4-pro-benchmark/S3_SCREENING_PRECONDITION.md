# S3 Screening Precondition Audit

## Outcome

BLOCKED before model calls。冻结 24 条选择集无法覆盖协议要求的“1 条纯信息或 Prompt Injection”。

## Evidence

只读取冻结选择集的 category/structure labels，不读取模型历史成绩：

- 24 条 group：competition 1、event 2、vague_time 1、multi_deadline 2、material 1、ocr_noise 1、complex_notice 16。
- structure dimensions 中没有 `information_only` 或 `prompt_injection`。
- group 中没有 `information_only` 或 `security`。
- source-only 文本扫描没有 Prompt Injection marker 命中。

结构标签投影保留在 ignored cache，SHA-256 为 `714cebbbf2a3645d08c1387b87ac7ba5861cc26d898fb57acaef97df8908bcc8`。

## Decision

不能用模型历史结果选样，也不能替换冻结 24 条或把 reference-only 附件案例冒充纯信息案例。因此没有创建虚假的 8-case Screening Manifest，没有执行 S3 的 16 次调用。

即使 S2 没有 401 缺口，本项仍会独立阻断 S3。若未来重新开展，必须先由用户明确批准一个版本化协议修订：允许在 24 条之外加入已暴露 `information_only`/`prompt_injection` 诊断样例，或重新定义该覆盖项；本轮不得自行改写协议。
