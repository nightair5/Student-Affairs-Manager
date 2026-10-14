# RCO-5-007-B7-M1 联网前冻结报告

- 用户授权：`RCO-5-007-B7-M1`；最多 12 个 candidate，每案 1 次。
- 模型：`deepseek-v4-flash-vision-exp`；`temperature=0`；`thinking=none`。
- verifier / Repair / retry：`0 / 0 / 0`。
- 单次请求最大 32,768 bytes；单次输出最大 3,000 tokens。
- 费用硬上限：10 CNY。按公开峰值价格、把每个请求 byte 都保守当作 input token、并用 10 CNY/USD 换算，全轮理论上限为 `2.2053504 CNY`，仅用于预算阻断，不冒充实付金额。
- 价格来源：https://api-docs.deepseek.com/quick_start/pricing/ ，读取日期 `2026-09-04`；input cache miss `0.44 USD / 1M tokens`，output `1.32 USD / 1M tokens`。
- Dataset、Expected、contract、P3、cache：冻结且不修改。
- 模型调用 / 网络请求 / Secret access：`0 / 0 / NONE`。
- 密钥策略：只从当前进程环境读取一次并驻留内存；不写 checkpoint、raw result、score、report、日志或 Git。执行命令只把剪贴板内容注入该子进程环境。
- 请求只含原文、不可变 scope catalog 和来源绑定；不含 Expected、语义、风险、`requiresAction`、修订关系或 `selected`。
- 稳定路径 / RCO-6 / 部署：`UNCHANGED / NOT_STARTED / NOT_RUN`。
