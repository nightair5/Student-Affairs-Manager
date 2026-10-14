# Candidate12 Holdout 预算授权卡草案

状态：`DRAFT_NOT_AUTHORIZED / PRICE_RECHECK_REQUIRED / NO_GRANT / NO_RESERVE`。

未来计划在独立人工包通过后执行 candidate03 与 Candidate12 的 12×2 配对，共 24 个一次性请求；repair、verifier、探活和自动重试均为 0。模型暂定 `deepseek-flash`，temperature 0、reasoning none、max output 8192。

本草案只沿用 B2 于 2026-09-21 核验过的计费结构作预算占位：峰值未缓存输入 ¥2/M tokens、输出 ¥8/M tokens。按既有安全策略的每请求输入上限 1,048,576 tokens 和输出上限 8,192 tokens，旧公式得到每请求 ¥2.162688、24 次 ¥51.904512。该数字不是本批有效授权、实际扣费或当前官方价格声明。

真正派发前必须：

1. 在 24 小时内重新核验 DeepSeek 官方模型映射、时段和价格。
2. 用完成后的 24 个 requestSha、input/source/reference/candidate/schema/scorer/adapter hash、固定顺序、最新账本前缀和新价格证据制作新卡。
3. 取得用户对调用数和最坏人民币上限的明确授权，再创建独立 grant 和持久跨进程锁。
4. 任何价格、路由、usage、余额或税费不可观察项写 `NOT_OBSERVABLE`；不得用本地上界冒充实扣。

唯一权威账本当前只读基线为 693 行、572913 字节、SHA-256 `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`、tail `13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd`。本阶段不创建 grant、reserve、settle、receipt 或 writer。
