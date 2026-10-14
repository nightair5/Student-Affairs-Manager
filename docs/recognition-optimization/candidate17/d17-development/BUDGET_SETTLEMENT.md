# D17 预算与账本结算

本批用户明确授权：D16 冻结身份 24 次 `deepseek-flash`，费用硬上限 US$8.00，仅一个新 grant，逐单元 reserve/settle；不含重试、repair、verifier、额外样本或真人试用。首次调用前重新只读核验 [DeepSeek 官方计价](https://api-docs.deepseek.com/quick_start/pricing/)与模型路由、冻结哈希、最终推送 HEAD、完整账本链。官方当时列出峰时缓存未命中输入 US$0.30/百万 token、峰时输出 US$1.20/百万 token；保守最坏上界 US$7.785696，低于授权硬上限。

- 新 grant ID `b5b1cb1f-a10b-4860-8046-bb4447148122`，绑定已推送的执行 HEAD `4d6f61de3f0e99246f0833785a31369860465aed`。D15 grant 未复用。
- 24 个逻辑单元各发送一次；24 个 `SETTLED`、0 不确定、0 重试、0 替代。24 份原样 raw 和 49 份账本收据保存在 Git 忽略的 `.data/candidate17/d17-execution/`，未提交 Secret 或原始响应到 Git。
- API 返回可观察 usage：输入 106,788 token、输出 29,066 token，其中缓存命中输入 88,320 token。按全部输入峰时未命中、全部输出峰时计价并逐单元向上取整，保守结算 **US$0.066927**。供应商实际扣款接口未直接观察，记 `NOT_OBSERVABLE`；不能把保守结算写成实扣。
- 权威账本从 889 行合法追加 49 行，现 938 行、SHA-256 `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`。本批专用 grant 已完成 24 单元，不再用于新请求。

最坏费用与已结算保守费用是不同概念；前者是调用前的安全门，后者由真实 usage 计算。原始响应、用量和账本完整链仍需与 [评分结果](SCORING_RESULTS.json)和只读审计同看。
