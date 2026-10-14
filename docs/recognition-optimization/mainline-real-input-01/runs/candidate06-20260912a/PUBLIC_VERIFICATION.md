# 本批公开模型与参数核验

2026-09-12在首次本批派发前读取官方页面（非模型请求）：

- https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
- https://api-docs.deepseek.com/zh-cn/guides/responses_api/

官方将 deepseek-flash 映射到 DeepSeek-V4.1-Flash；旧别名不能构成旧模型对照。1M上下文，Responses支持temperature、max_output_tokens、reasoning.effort、stream和text.format。本批仍为0/none/false/8192，独立请求、零verifier/Repair/retry。没有不可变权重版本，逐请求另记实际返回model。

最高人民币单价：未命中输入每百万2元、输出每百万8元。以1048576输入和8192输出的保守上限，最坏2162688微元，小于现有3300000微元预留；价格低峰折扣不用于提前释放。只用绑定合法usage按最高价计算费用上界，账户实扣不可观测。原A01未知3300000永久占用、10元总上限不变。

本批只增加24个新单元Q01–Q12各03/06，累计最多104。服务端使用既有可信代理和完整TLS，不增加试连接；这里只核验公开资料，不读取密钥。

比较沿用candidate05-20260912a/COMPARISON_RULES.md的实质差异口径。本次为同一12份已见材料的同期重复测量。新Q来源索引用于避免改写旧P来源；通知文字、参考时刻与时区逐字不变，两臂新索引相同。参考事实只做局部ID机械重绑定后交给原评分器，不进入请求或产品。自动选择仍NOT_ENABLED。
