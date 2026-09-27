# 下一批 Development 预算卡草案（未授权）

- 状态：`DRAFT_ONLY`。本轮 0 次业务模型调用，0 grant、0 reserve、0 settle，权威账本只读；旧 D6/此前许可不能沿用。
- 计划：12 份已见合成来源 × Candidate03/Candidate15 两臂 = 24 个逻辑单元；6 组 AB、6 组 BA。固定 `deepseek-flash`、temperature 0、reasoning none、输出上限 8,192、公共 JSON Schema/adapter。当前实际请求身份 **0**，参照缺失，不能派发。
- 2026-09-27 只读核验 DeepSeek [官方模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)：`deepseek-flash` 高峰缓存未命中输入 **US$0.30/百万 token**，输出 **US$1.20/百万 token**；缓存命中更低，离峰约半价。价格和路由可能变化，真正冻结请求和申请授权前必须重新核验。
- 粗略规划：若每请求输入最多 65,536 token、输出最多 8,192 token，24 次按上述高峰价约 **US$0.708**。这里把当前 65,536 **请求字节**上限粗用作 token 上限，未计服务端隐藏 token/计费调整；因此它**不是可执行的最坏预算或费用硬上限**。实际请求生成后须逐项计算保守 token 预算、额外开销和价格漂移；未知费用或无法界定硬上限时停止，不能创建授权 grant。
- 新授权前置：12 份完整 v6 参照与正反例、冻结 Manifest/24 身份/哈希、唯一账本只读核验、跨进程锁和一次发送/断点续跑执行器、独立审查。任何发出与计费/结算不确定均停止且不得自动重发。用户须另行明确指定本批调用数和硬上限。
