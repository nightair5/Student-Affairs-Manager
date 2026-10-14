# D5 24次调用预算授权卡草案

状态：`DRAFT_NOT_AUTHORIZED`。本文不是grant、预留、结算或派发授权。

- 目标模型：`deepseek-flash`，24次，非思考模式。
- 官方价格页：`https://api-docs.deepseek.com/quick_start/pricing/`。
- 核验日期：2026-09-22。
- 官方页面当日显示的Flash高峰价：cache-miss输入 US$0.30/百万token，输出 US$1.20/百万token。计算不依赖cache-hit或低峰折扣。
- 单次请求字节上限65,536；用“每个token的UTF-8表示至少占1字节”的保守字节包络计算，24次输入不超过1,572,864 token。这不是实测token数，真实用量以可审计API usage为准。
- 输出上限：24×8,192=196,608 token。
- 高峰cache-miss包络：1.572864×0.30 + 0.196608×1.20 = US$0.7077888。
- 建议的授权硬上限：US$1.00。不把汇率假定写成人民币实测费用。

真正派发前重新读取官方价格页；价格、模型路由、请求字节上限或账本任一变化都需新的预算计算。provider真实扣费只在有可审计返回或账单时报告，否则为`NOT_OBSERVABLE`。

权威账本只读基线：742行，SHA-256 `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`。真正执行需新grant、跨进程锁、每单元reserve/settle、不确定状态不重发和断点续跑检查。
