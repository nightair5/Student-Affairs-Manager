# E2-H Retry 与失败分离

`recognition-retry-1.0.0` 将传输失败与识别质量失败分开：

- 429、502、503、网络错误与超时最多重试一次，等待 `250ms × 2^n + 0..99ms jitter`。
- HTTP 400、请求字段错误、输入过大、JSON 解析失败、RecognitionResult schema 失败、证据或语义质量问题绝不重试。
- recognize、repair、extractFacts 各自作为独立 operation 记录；Repair 仍只执行一个语义修复 operation，但瞬时传输失败可重发一次。
- 每个 operation 记录 attempts、最终 transportStatus、status、errorCode、durationMs 与真实或 null 的 tokenUsage。
- 重试后仍失败时返回明确的 transport 错误；首轮识别有效而 Repair 失败时仍保留首轮结果，并记录 Repair errorCode。

该策略不读取或记录密钥与用户正文，不改变 Domain、确认提交或本地 fallback。
