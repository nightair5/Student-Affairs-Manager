# 唯一本批付费申请：8次，US$2.60硬上限

2026-10-06。本地机制、普通产品A—J和冻结已交付；**本文件不是许可，全部8身份NOT_RUN**。付费前还需用户明确授权本批；旧1.30/3.90/5.30许可均不能复用。

批次 `C19-SINGLE-AUTHORITY-DEVELOPMENT-R1`；Candidate19与SingleAuthority各4次，4个新措辞匿名Development来源，2AB/2BA。最近基线C19；没有第三臂。来源是作者构建的开发通知，不称实际外部通知、真人样本或Holdout。选择覆盖单活动及未公布结束、不同事件/共享时间、材料渠道/办结/窗口/unknown资格、纯信息。概念重合如实标明，旧来源逐字重合0。请求不含Expected。

冻结目录 `comparison/`：182组件、5产物、8请求；生成提交 `c780ebea52b91ef32f5861608f722b23e624799a`。Manifest SHA `b3f49a424ccd7b3c740c4009f30d1708e3bf4b5399ded3c0a4c768a0c65c9b29`；身份SHA `1651fe39ada86fbcecb298b93c72574f2b4401956f4124be0b3dc79a5b3f8459`。Schema/说明/候选编译器是改变组件，公共时间、渠道、资格、禁止、首屏和保存规则相同；不能将整包收益独立归因一句Prompt。

## 官方核价与可证明上界

官方[价格页](https://api-docs.deepseek.com/quick_start/pricing/)实读：`deepseek-flash`当前对应DeepSeek-V4.1-Flash，官方上下文1M，输出上限384K；峰时未缓存输入US$0.30/百万token，输出US$1.20/百万token。按峰时且不计缓存优惠。官方[Responses说明](https://api-docs.deepseek.com/guides/responses_api/)支持max_output_tokens，真实usage分别报告input/output及reasoning。冻结请求是文本、无收费工具/图像；max_output_tokens=8192、reasoning.effort=none、temperature=0、stream=false。

用官方完整上下文的保守上界1,048,576输入token，而非字节估token：

`1,048,576 × 0.30 / 1,000,000 + 8,192 × 1.20 / 1,000,000 = US$0.3244032/单元`。

逐单元向上取整到微美元US$0.324404；8单元合计US$2.595232，因此申请**US$2.60整批硬上限**。这是预算上界，不是预计实际消费或实测账单。服务商实扣当前NOT_OBSERVABLE，新批发送/usage/结算均0。

获取路径：smart-crawl native遇302，官方Firecrawl桥返回HTTP200及真实价格表。路由的区分大小写“Price”字段检查仍标CONTENT_INCOMPLETE；没有伪称路由自动合格。人工按模型路由/上下文/峰时输入输出/说明逐项核对实际markdown/html，另用官方浏览器实读Responses页。本机`.data/single-authority-price-firecrawl.json`及`single-authority-browser/official-responses-api.txt`留原获取证据；不包含凭证。

首次grant前必须重核有效价格、路由、上下文/输出/附加费、同步HEAD、8个identity/requestSHA和完整账本。任何漂移、费用超2.60或状态未知在grant前停止；核价证据绑定有效期和当前提交，不能用本卡当永久价格或当前授权。

## 本批需要的唯一许可

仅这8个原冻结deepseek-flash身份、整批US$2.60硬上限、唯一新grant及逐单元reserve/settle；每身份最多发送一次，严格ordinal，零额外样本、retry、repair、verifier。状态/计费/raw/settle不确定立即封存，不以无raw推断未发。没有本批许可不生成AUTHORIZATION/USER_AUTHORIZATION、grant或发送。

真实许可及PRICE_EVIDENCE/AUTHORIZATION只保存在本机`.data/single-authority/execution/`，不进Git；已完成4次和旧封存公开批均不恢复。授权后直接同工作包执行、逐原文/raw/转换/首次页面裁决及产品回放，不另建准备阶段。预注册参照single-author/model-assisted/provisional；未知、争议、失败保留每臂4分母，标题/自由描述未裁决不满分。没有发送/计费未知才可作结论，不从预算或夹具推算准确率。
