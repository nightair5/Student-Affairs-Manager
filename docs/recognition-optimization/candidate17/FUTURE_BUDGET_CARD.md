# D16 下一批模型调用授权草案（未授权）

2026-09-28 11:40 UTC 只读核验 [DeepSeek 官方价格与路由](https://api-docs.deepseek.com/quick_start/pricing/)。`deepseek-flash` 当前路由 V4.1 Flash，官方表列上下文 1M、峰时输入缓存未命中 US$0.30/百万 token、峰时输出 US$1.20/百万 token，费用按输入和输出 token 计。冻结请求输出上限 8,192 token/次；保守按每请求输入 **1,048,576 token**（比页面 1M 标称更宽）、全部缓存未命中、全部峰时计价，24 次上界为 `24×(1,048,576×0.30 + 8,192×1.20)/1,000,000 = US$7.7856768`。这是基于官方现有计费项目及 API 执行输出上限的**预算预留上界**，不是实际 usage/实扣；若供应商改变路由、上限、收费项或收费单位，必须先停在 `BUDGET_UNRESOLVED` 并重新计算。建议未来申请硬上限 US$8.00，但本文件**不是授权**，不能沿用 D15 的 US$7.80/grant。

绑定候选：Candidate03 vs Candidate17；12 份 template-derived provisional Development×2，24 身份，6 AB / 6 BA；Manifest SHA-256 `6538b63f73b38b14992511e2e40cd4a1d3a334528ae1b2ca7cfdf86a8cd7e4a8`，身份文件 SHA-256 `b107900c6f31f4c02b45d54dcb3ae0693da6240ae12cac07a0411b0a1adf139b`；每份 requestSha256 和 unitIdentitySha256 在身份文件内。发送前还须绑定**最终已提交并推送的 HEAD**，重新验证每个字节、价格、权威账本和 24 个身份。请求字节数不用于 token 计费上界。D15 账本快照 889 行、SHA-256 `01d6670af09175475fcdfa5aec3594d2751cfd3b03050743fb79a04a578ad4c9`；本轮只读，合法后续追加必须先审查。供应商实际扣款若接口不可见应报 `NOT_OBSERVABLE`，与保守结算分开。

未来明确授权可写为：“仅授权 D16 Manifest SHA `6538...e4a8`、身份文件 SHA `b107...139b` 中的 24 次 `deepseek-flash` 配对请求，费用硬上限 US$8.00；允许一个新专用 grant 与逐单元 reserve/settle；不授权额外样本、重试、repair、verifier、真人、Holdout、默认替换或部署。”第一次调用前应使用完整 SHA 复核，不能凭本卡短写哈希执行。
