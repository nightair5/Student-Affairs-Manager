# candidate08 发送前公开资料核验

核验时间：2026-09-13 12:24 UTC。只读取 DeepSeek 官方公开文档，未调用模型或余额接口。

- 官方价格页（https://api-docs.deepseek.com/quick_start/pricing/）当前列出的 Flash 请求模型名为 `deepseek-v4-flash`，峰时未缓存输入价格为 3 元/百万 token、输出价格为 9 元/百万 token；缓存折扣不用于本批预算上界。
- 官方 Responses API 页（https://api-docs.deepseek.com/api/create-response/）说明 `POST /responses`、`temperature`、`reasoning.effort`、`stream`、`max_output_tokens` 和结构化输出参数。本批固定 `temperature=0`、`reasoning.effort=none`、`stream=false`、`max_output_tokens=8192`，不重试、不 Repair、不 verifier。
- 用户批准沿用项目此前已成功结算的请求别名 `deepseek-flash`。它与当前公开页面列出的名称不同，因此本批不声称取得不可变模型版本；每条响应仍必须返回与请求一致的 `deepseek-flash` 身份，否则预算网关立即拒绝结算并停止后续派发。
- 新批按更高的当前峰时价格 3/9 元计上界，单次仍保留 3.30 元滚动预留，总上限 20 元、累计最多 168 次。旧政策、旧结算、旧收据和 A01 未知预留不改价、不释放。
- 请求只包含获准匿名文字、参考时刻、时区及来源片段索引；图片、文件、参考答案和工作区不进入请求。密钥只由明确派发进程读取，完整 TLS 验证后才向 `api.deepseek.com` 发送。
