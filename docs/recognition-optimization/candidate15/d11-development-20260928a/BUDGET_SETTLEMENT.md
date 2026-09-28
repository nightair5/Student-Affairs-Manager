# D11 预算结算与计价边界

本批用户硬上限 US$8.00，仅针对 D10 冻结的 24 个 `deepseek-flash` 请求。2026-09-28 派发前按 DeepSeek 官方 [模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)、[模型元数据](https://api-docs.deepseek.com/api/list-models/)及 [Responses API](https://api-docs.deepseek.com/api/create-response/)只读复核：峰时 cache-miss 输入 US$0.30/百万 token、输出 US$1.20/百万 token、上下文 1,048,576 token、请求上限 8,192 输出 token。单元保守预留 US$0.324404，24 个共 **US$7.785696**。未拿请求字节数冒充 token 数。

唯一批次 grant 关联执行器提交 `b8a17aa88a7e7539e3edf883aeec9e10ada95ea6`、D10 Manifest `cf7a5186ce6588103502ec586ec33c63937c4716f997c32e3a4706999e2e5146`、请求身份文件 `c9fdaa56f9fe072fcb0d47e9a177c5111f265c8ee5aba293cbb578d5a584c721`。账本从 791 行追加 1 grant + 24 reserve + 24 settle 到 840 行；0 uncertain，0 retries。

响应 usage 汇总：输入 106,530 token、缓存输入 92,928、输出 25,040。逐单元以峰时 cache-miss 输入价和峰时输出价计算并向上取整，保守结算合计 **62,017 微美元 = US$0.062017**。这是本地可审计的费用上界，不是平台账单；平台实际扣款 **`NOT_OBSERVABLE`**。细目和 response ID 在 `AUDIT.json` 与 `STATE.json`，raw 在 `raw/`。账本完整链 SHA-256 为 `ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea`。
