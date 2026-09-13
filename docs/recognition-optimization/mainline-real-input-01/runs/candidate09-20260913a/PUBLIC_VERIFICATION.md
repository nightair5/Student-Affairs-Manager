# candidate09 首调前官方资料核验

2026-09-13，公开文档只读；未调用模型或余额接口。

- [官方模型与人民币价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)当前明确deepseek-flash对应DeepSeek-V4.1-Flash。峰时缓存未命中输入2元/百万token、输出8元/百万token；空闲时1元/4元。旧别名不作为旧模型对照。
- [官方Responses API](https://api-docs.deepseek.com/zh-cn/api/create-response/)支持POST /responses、deepseek-flash、reasoning.effort=none、temperature=0、stream=false、max_output_tokens及text.format.json_schema。本批输出上限8192，retry/Repair/verifier均0。
- 本批继续使用现行更保守的3/9元峰价预算上界，不回改任何历史结算。单次最坏上界3.219456元，小于3.30元滚动预留；项目总限20元，累计208次。实际provider账单金额不可观测，token观测值和保守上界分别报告，不能把上界称实际扣费。
- 起点原168次累计上界7.197982元（含A01未知3.30元）；距20元上限12.802018元。每次派发前核原账本完整收据和余量，不另开账本。无额外模型试连接。
- 官方没有提供可锁定的不可变版本ID；记录调用日期、请求及返回模型标识，不把别名当不可变版本。
- 仅发送已获准匿名文字、时刻、时区和scope索引；只在正式派发进程读取获准服务端配置。固定127.0.0.1:10081 CONNECT至api.deepseek.com:443，完整端到端TLS验证后发送凭据。不读取代理凭据、剪贴板、参考答案或其他工作区数据。
