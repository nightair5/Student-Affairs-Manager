# D6预算结算

- 模型：`deepseek-flash`，固定temperature 0、reasoning none、输出上限8192。
- 请求：24/24一次发送并settled；0重试、0 repair、0 verifier。
- 专用grant：`7bcbd608-ba1b-4121-be2f-49c23d8d7029`。
- 硬上限：US$1.00。
- 24份冻结请求最坏预算：US$0.351580。
- 实际usage按官方峰值价计算的本地可审计上界：US$0.067607。
- 服务商实际扣费：`NOT_OBSERVABLE`，没有把本地上界冒充账单。
- usage：输入116,262 tokens、缓存输入98,176 tokens、输出27,266 tokens。
- 账本：742→791行；1 grant、24 reserve、24 settle；0 uncertain、0 halt。
- 最终账本SHA-256：`efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`。
- 最终tail：`0d7d84ba0816cb89cc8e54a2dac02d0413f6608431ce7593c23914bfbb5be3b3`。

价格依据在派发前从DeepSeek官方价格页只读核验；任何未来调用都需重新核价和重新授权。
