# 本批已授权费用与关闭状态

2026-10-03。**CLOSED_PERMISSION_CONSUMED**。用户在同一任务明确授权原16个deepseek-flash请求、硬上限US$5.30、仅一个新grant、逐单元reserve/settle。本批16个身份已各发送一次并结算；余额不是新许可，不能再次派发。授权原件及核价原件只在本机.data保存。

| 绑定项目 | 实际值 |
|---|---|
| 批次 | D26-C17-C18-DEVELOPMENT-R1 |
| 比较/固定分母 | Candidate17 vs Candidate18；8已见D25来源×2=16，4AB/4BA |
| 原比较快照 | 4699d5cfdd6211299d9ab82ef7000d99fc8fe8f8 |
| 本次授权执行HEAD | 7ce9fa204a5b86a0facf99b26672d47a1a34ccde；派发前已提交并推送。后续产品/文档提交不回写授权 |
| Manifest SHA-256 | c41185c3831d35db610e5a4a563b7471b0bd60d1d92a373edd6a5c10d28f7ac2 |
| 身份文件 SHA-256 | 89f33327eabd2ec90f9d383ac922d56b56ca4654cfee0be47aac083eea411e89 |
| 单元request/response SHA | [16单元摘要](authorized-20261003/COMPACT_RESULTS.json)，依原身份 |
| 路由/模型 | https://api.deepseek.com/responses；deepseek-flash |
| 固定参数 | temperature=0，reasoning.effort=none，stream=false，max_output_tokens=8192；其他依原冻结 |
| grant | D26-20261003-a5b5e71b-2ccd-436b-9299-be954c640540；仅1个 |
| 实际发送/响应/结算 | 16 / 16 HTTP200 / 16 SETTLED；不确定0；零自动重试/repair/verifier/额外探测 |
| 本次有效核价 | 2026-10-03T09:32:28.893Z，即17:32:28.893 Asia/Shanghai；12小时窗口至21:32:28.893Z |
| 最坏预算/用户硬上限 | US$5.190464 / US$5.30 |
| 实际usage | input 70,678；output 18,375；reasoning 0，均取原响应 |
| 内部保守结算 | 43,261 microUSD = US$0.043261 |
| 供应商实际扣费 | NOT_OBSERVABLE；没有读取账户账单或用usage冒充实扣 |

第一次grant前只读重核官方 [价格](https://api-docs.deepseek.com/quick_start/pricing/) 与 [Responses API](https://api-docs.deepseek.com/guides/responses_api/)，核峰时、缓存、推理及文本请求收费；核全部身份、同步HEAD和权威账本。官方上下文1M按更大1,048,576输入token界，冻结输出8192；峰时未命中缓存输入US$0.30/百万token、输出US$1.20/百万token，不依赖缓存或折扣：

每单元 ceil(1,048,576×0.30 + 8,192×1.20) = 324,404 microUSD，即US$0.324404。16单元US$5.190464。请求字节数没有当token硬界；固定输入输出上限的保守证明覆盖失败单元。本批文本，无图片或外部工具附加消费。当前完成后的价格证据不是下一批永久价格。

内部settle按响应usage逐单元以峰时未命中缓存上取整；汇总US$0.043261不是供应商实扣。首次发送前reserve按每单元最坏界；一次原样响应、usage及SHA落盘后settle，无修改历史raw。第14单元reserve前远端Git TLS失败，先停发、只读确认13 SETTLED/余3 NOT_SENT；连接恢复后只发送14—16，没有重发13或自动重试模型。

账本938→971，追加仅33个本批授权事件；完整链及本地状态一致。[只读核验](authorized-20261003/HOST_READ_ONLY.json)。SHA-256 7b1d1935254a7d7830e1d03892d12895707b71107dfc1bfb611f3459e839367d。原冻结身份文件的dispatchAuthorized=false及NOT_RUN仍逐字保留，它们不是本次执行现场。

旧零许可申请和旧核价记录保存在Git历史及evidence/，不将它们篡改为本次授权。今后只读resume/report可以继续核本批；prepare/dispatch不得用本批许可开始第二批。下一轮只有确定新的模型输入机制并另冻结具体模型、身份、次数、预算后，才申请新的明确授权。无需再授权这已耗尽的16次。
