# D9 未来 24 次调用预算卡草案（未授权）

2026-09-27 只读查看 [DeepSeek 官方模型与价格](https://api-docs.deepseek.com/quick_start/pricing/) 及 [Token 用量说明](https://api-docs.deepseek.com/quick_start/token_usage/)。当前 `deepseek-flash` 对应 V4.1-Flash；按峰时、缓存未命中保守计价，输入 US$0.30/百万 token，输出 US$1.20/百万 token。价格可能变化，真正派发前必须重查官网和模型路由。

已准备 24 个逻辑单元，固定 `temperature=0`、`reasoning.effort=none`、`max_output_tokens=8192`、`stream=false`。24 个冻结请求 JSON 的 UTF-8 序列化正文共 340,368 bytes，单份 13,720–14,854 bytes；这**不是**精确输入 token 数。输出上限共 196,608 tokens，按峰时价格对应 US$0.2359296。输入 token 的官方实际用量要以响应 usage 为准；本轮未发请求，实际 usage 与费用均 `NOT_OBSERVABLE`。

官方给出的 1M context 上限可作为极端封顶分析：即使保守按每请求 1M 输入 token、输出各 8192 token，24 次峰时上界约 US$7.44；这过宽，不能据此批准低于该值的硬上限。若未来要以更低硬上限运行，需以官方 tokenizer 或服务端可靠请求边界逐份确定 reserve 上界，建立跨进程锁及不确定发送/结算停止策略，再由用户明确授权模型、24 次和费用上限。任何未知服务附加费、改价、路由、请求体或账户计费规则变化，均须在 grant 前停止。旧 314 次许可不能复用。

当前状态：没有新 grant，没有 reserve/settle，没有账本交易，没有读取 Secret、连通性探测或模型调用；所有请求 `dispatchAuthorized=false` 且 `NOT_RUN`。浏览器契约仍有阻碍，本卡不是调用申请。
