# 独立复核：局部辅助层与预算

## 无上下文源码审查

审查者：/root/real_input_partial_review；范围仅新增5文件与直接依赖，SHA见REVIEW.json；非完整产品审查。

首次17/17测试通过仍发现两个P2：正则将非字符串ID/hash隐式转型；SHA等待中外部更改页码数组，导致发送快照正文与范围不一致。已分别加真实失败回归并保留日志，再修复字符串类型检查和入口参数副本。同一异步根因扩展到模型请求时钟，先复现后同步复制context。

最终结论PASS_PARTIAL_HELPER_REVIEW：5文件SHA匹配，独立20/20通过；独立重放原第二次SHA期间换页反例，正文/页码/范围一致且再次校验通过。冻结31只读依赖SHA匹配。类型/lint由主代理运行，不冒称独立重跑。

还修正了草稿ENGINEERING中测试日志误绑空lint日志；最终绑定targeted-attempt-2.log。此结论只支持局部审计，App、OCR、仓储、浏览器、模型质量及完整工程仍NOT_RUN；源码保留未提交，整包未完成。

## 公开预算独立复核

审查者：/root/real_input_budget_review。官方人民币价格和Responses参数可核，但请求65,536字节不能直接证明完整计费输入≤100,000 token。官方分词包未给出Responses JSON Schema的完整计费包装映射。故原0.40元固定不可逆预留方案仍PAID_BLOCKED；并非发现隐藏收费或证明模型不可用。

另行讨论的保守替代：依据官方1M上下文、超窗400和输入/输出按token收费，保守按1,048,576输入与8192输出推得单次≤3.219456元。3.30元最坏预留或滚动核验结算可避免字符估算；它改变原账本规则，当前仅待批准，不启用、不偷改原方案。

来源：[价格/上下文](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)、[Responses参数](https://api-docs.deepseek.com/api/create-response/)、[兼容/超窗](https://api-docs.deepseek.com/zh-cn/guides/responses_api/)、[token说明](https://api-docs.deepseek.com/quick_start/token_usage/)。后者为公开语义的保守推导，不是实测账单；真实账号与凭据未访问。

两位审查者未写文件、未访问密钥/剪贴板、未调用模型。此记录由主代理据返回结果整理。
