# 官方公开资料核验（2026-09-12）

核验方式为官方文档网页读取，不是API试连接，不读取凭据。

1. https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ 当日可读页面明确：deepseek-flash对应DeepSeek-V4.1-Flash，旧flash/vision-exp别名已指向此模型；上下文1M。高峰人民币每百万token输入未缓存2元、输出8元，采用最高价格结算上界，不依赖优惠缓存与时段。返回若仅为别名不能声称不可变权重版本。
2. https://api-docs.deepseek.com/zh-cn/guides/responses_api/ 当日可读兼容表支持model、stream、temperature[0,2]、max_output_tokens、reasoning.effort与text.format；目标https://api.deepseek.com。沿用effort=none、temperature=0、非流、8192输出和0重试。思考页本次单独读取超时；此前参数核验仍留痕，首个正式单元验证实际协议，不做免费或额外探针。
3. 按保守1,048,576输入+8,192输出，向上取整最坏2,162,688微元；旧3,300,000微元预留足够。A01未知预留永久保持，总10,000,000微元不变。价格是上界，实扣不可直接观测。

本轮只发送合成通知文字和来源scope/参考时刻，不发送图片、文件、工作区或参考答案。
