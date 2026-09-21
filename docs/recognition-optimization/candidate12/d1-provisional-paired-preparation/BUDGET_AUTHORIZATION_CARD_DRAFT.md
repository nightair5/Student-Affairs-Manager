# D1 未来 24 次模型调用预算授权卡草案

状态：`DRAFT_NOT_AUTHORIZED`。适用对象：D1 Manifest 中固定的 24 个请求身份。当前模型调用、Secret 读取、grant、reserve、settle、receipt 和账本写入均为 0。

## 调用边界

- 12 份 `SEEN_SYNTHETIC_DEVELOPMENT` 来源 × candidate03/Candidate12 两臂，共 24 次。
- 固定 `deepseek-flash`、temperature 0、reasoning none、`max_output_tokens=8192`。
- repair、verifier、探活和自动重试均为 0。
- 任何派发、raw 保存、usage 或结算不确定都停止整批，不重试。

## 价格证据与最坏包络

B1 在 2026-09-21 只读核验过 DeepSeek 官方 V4.1 Flash 价格：高峰输入缓存未命中 ¥2/百万 tokens、输出 ¥8/百万 tokens。D1 没有再次联网核价；真正授权和派发前 24 小时内必须重新核验官方价格及模型路由，任一变化都会使本草案失效。

为避免把离线字符估算冒充服务商计量，继续采用既有安全策略的每请求输入上限 1,048,576 tokens 和候选输出上限 8,192 tokens：

`每请求最坏 = 1,048,576 × ¥2/1M + 8,192 × ¥8/1M = ¥2.162688`

`24 请求最坏 = ¥51.904512`

本包冻结请求体为 13,614—16,165 字节，仅用于工程审查，不能缩小授权硬上限。实际服务商扣费、赠送余额、税费和账户结算均为 `NOT_OBSERVABLE`。若用户不接受 ¥51.904512 上限，必须先基于正式 tokenizer 或服务商可审计计量另做紧预算卡，不能口头降低。

## 唯一权威账本和续跑

只读核验的唯一权威账本：

`C:\Users\Winner\student-affairs-multimodal-exp\docs\recognition-optimization\mainline-real-input-01\runs\usage-resume-20260907a\CALL_LEDGER.jsonl`

当前为 693 行、572,913 字节、SHA-256 `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`、tail `13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd`。D1 只读打开，没有 writer。

未来 grant 必须绑定权威账本前缀、tail、24 个 unitId、request/input/candidate/schema/scorer/adapter 哈希、固定顺序、价格证据和硬预算。锁必须位于同一主机持久绝对目录，通过原子目录创建取得跨进程独占；未知或遗留锁不得自动清理。

续跑时只在锁内重放账本：settled 与确定失败不重发，pending/uncertain 停止对账，只从首个明确未发送且仍匹配冻结 Manifest 的单元继续。账本、价格、grant、保护哈希或请求身份任何漂移都拒绝派发。

## 所需授权

未来授权需明确批准：本 Manifest 的 24 个一次性请求、¥51.904512 最坏费用上限、价格有效期和唯一账本 writer。授权不包含独立 Holdout、真人试用、默认候选修改、合并、部署或 Production。
