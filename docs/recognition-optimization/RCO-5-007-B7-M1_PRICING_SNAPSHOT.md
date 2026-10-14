# RCO-5-007-B7-M1 费用包络快照

- 模型：`deepseek-v4-flash-vision-exp`
- 官方价格页：https://api-docs.deepseek.com/quick_start/pricing/
- 读取日期：`2026-09-04`
- 峰值 input cache miss：`0.44 USD / 1M tokens`
- 峰值 output：`1.32 USD / 1M tokens`
- 保守换算：`10 CNY/USD`，只用于不超预算判断，不代表实际汇率或账单。
- 上界算法：将 `12 × 32,768 request bytes` 全部按 input token 计，将 `12 × 3,000` 按 output token 计。
- 理论最坏上界：`2.2053504 CNY`，严格低于用户授权的 `10 CNY`。
- 服务商实际人民币账单：`NOT_OBSERVABLE`；运行后只报告接口返回的 token usage 和基于上述价格的代理值。
