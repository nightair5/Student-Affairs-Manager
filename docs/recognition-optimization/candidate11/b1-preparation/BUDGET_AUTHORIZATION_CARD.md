# Candidate11 B1 新模型调用预算授权卡（草案）

卡片版本：`candidate11-b1-budget-card-1.0.0`。检查时间：2026-09-21 17:09:42（Asia/Shanghai）。状态：`DRAFT_NOT_AUTHORIZED`。

本卡只供审查。它没有读取Secret，没有创建grant、预算预留或收据，没有打开writer，也没有发送请求。此前314次许可已全部耗尽，不能解释为本批24次的授权。

## 本批身份和调用上限

- 计划：6份Development来源 × V00/V10/V01/V11，共24个一次性身份。
- 模型与固定参数：`deepseek-flash`、temperature 0、reasoning none、`max_output_tokens=8192`、Responses API。
- repair、verifier、探活和自动重试：0。
- 任一不确定派发或结算：整批停止并对账，不重试。

## 官方计价依据

DeepSeek官方中文“模型 & 价格”页：<https://api-docs.deepseek.com/zh-cn/quick_start/pricing/>；V4.1 Flash发布说明：<https://api-docs.deepseek.com/zh-cn/news/news260910/>。核验时官方说明 `deepseek-flash` 对应 DeepSeek-V4.1-Flash，按每百万tokens计价：

| 时段 | 输入缓存命中 | 输入缓存未命中 | 输出 |
|---|---:|---:|---:|
| 空闲 | ¥0.02 | ¥1.00 | ¥4.00 |
| 高峰 | ¥0.04 | ¥2.00 | ¥8.00 |

北京时间工作日09:00–12:00、14:00–18:00为高峰，其余为空闲。预算一律按高峰、输入缓存未命中计算；发送前24小时内必须重新核验，价格或路由变化使本卡失效。

## 最坏预算

为避免把离线字符估算冒充服务商计量，授权上界使用既有安全策略的每请求输入上限1,048,576 tokens和候选输出上限8,192 tokens：

`每请求最坏 = 1,048,576 × ¥2/1M + 8,192 × ¥8/1M = ¥2.162688`

`24请求最坏 = ¥51.904512`

65,536字节请求上限下的较紧工程包络为每请求¥0.196608、全批¥4.718592，但官方文档说明离线token换算只是估计，实际计费以API usage为准，因此该较紧数字不能单独充当硬授权上限。未来授权若不接受¥51.904512最坏包络，必须先用官方tokenizer/正式计量方案另做一张可审计的紧预算卡；不得在本卡上口头缩小。

本次24个冻结请求的实测最大请求体为19,908字节；它用于审查Prompt体量，不替代服务商token计量，也不缩小上述最坏授权包络。

实际服务商扣费、赠送余额优先扣减、税费/账户结算和最终账单均为 `NOT_OBSERVABLE`，不能用本地上界冒充实扣。若官方价格无法复核、usage缺失/歧义、响应超过冻结token上限或费用状态不确定，立即停止且不释放该单元的最坏预留。

## 唯一账本与跨进程锁

历史唯一权威账本只读位置：

`C:\Users\Winner\student-affairs-multimodal-exp\docs\recognition-optimization\mainline-real-input-01\runs\usage-resume-20260907a\CALL_LEDGER.jsonl`

已核验644行、314个reserve、SHA-256 `dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597`。candidate11工作树中的同路径文件只是同哈希快照，不得作为第二个writer。旧manifest中的临时lockRoot与旧授权时窗均不得复用。

若未来取得新授权，grant必须绑定上述权威账本的前缀字节数、前缀SHA、父tail、父sequence、24个unitId、request/input/candidate/schema/scorer/adapter哈希、固定顺序、价格证据和新硬预算。锁根必须是同一主机上新建的持久绝对目录；以原子`mkdir ledger.lock`取得跨进程独占，owner文件用`wx`创建，未知或遗留锁不自动清理。每次reserve/settle/halt在锁内重放哈希链、写独立sequence记录、fsync后追加账本。

续跑时只在锁内读取权威账本并重建状态：settled与确定失败不重发，pending/uncertain整批停机对账，只能从首个明确未发送且仍匹配冻结manifest的单元继续。账本尾、grant、价格、保护哈希或请求身份任一漂移都拒绝派发。

## 需要的新授权

未来授权必须单独明确：这24个冻结身份、最坏费用上限、价格有效期和唯一账本writer。批准本卡不等于批准Holdout、真人试用、合并、部署或默认候选变更。当前停止状态为：`AWAITING_NEW_MODEL_CALL_AUTHORIZATION`。
