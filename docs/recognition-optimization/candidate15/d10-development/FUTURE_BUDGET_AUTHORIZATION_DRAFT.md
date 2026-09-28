# D10 未来预算授权卡草案（零调用，未授权）

核价日期：2026-09-28。只读核对 [DeepSeek 官方模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)：`deepseek-flash` 当前路由 DeepSeek-V4.1-Flash；峰时缓存未命中输入 US$0.30/百万 token，输出 US$1.20/百万 token，官方公布上下文长度 1M token，费用按输入与输出 token 计。真正创建 grant 前须重查模型路由、价格和计费规则；本次未做任何模型连通性探测。

- D9 24 份请求正文逐字不变：12 份已见合成 Development 来源 × Candidate03/Candidate15 两臂，6 组 AB、6 组 BA。模型 `deepseek-flash`，`temperature=0`、`reasoning.effort=none`、`max_output_tokens=8192`、`stream=false`。
- 24 份请求 JSON 的 UTF-8 正文共 340,368 bytes，单份 13,720–14,854 bytes。字节数不是输入 token 数。实际 token usage 和实扣费用均 `NOT_OBSERVABLE`。
- 以官方每次最多 1M 上下文 token 作为极宽的输入封顶，并保守另加每次 8,192 输出 token：峰时 token 价理论上界 `24 × (1,000,000 × 0.30 + 8,192 × 1.20) / 1,000,000 = US$7.4359296`。这不是预测费用，也不表示请求一定接近此上界。
- 未来可供用户审议的专用硬上限建议为 **US$8.00**，仅在上述官方限制、价格、请求及计费规则均未变、且无未知附加费用时覆盖模型 token 费用。若这些前提无法由派发前只读检查证实，状态为 `BUDGET_UNRESOLVED`，在 grant 前停止；不能用 JSON bytes 粗估成低额保证。
- 一个新批次专用 grant、跨进程锁、逐单元 reserve/settle、一次发送、零自动重试。传输、raw 写入或结算状态不确定立即停止，不重发。24 个逻辑单元保留在分母。旧 314 次授权和历史 grant 不可复用。

本轮 `dispatchAuthorized=false`、24/24 `NOT_RUN`、模型调用 0、grant/reserve/settle 0、账本写入 0、Secret 明文读取 0。**此卡不是授权，也不允许执行请求。**
