# 必要新输出：当前C19单臂4来源

目的：测当前Candidate19在4份此前未用于项目输出的官网操作摘录上的首次事实及首次展示。没有新输入机制，因此不造新候选或付费对照。不证明相对提升、模型泛化或真人收益。

批次C19-PUBLIC-DEVELOPMENT-R1，4来源×1臂=4个deepseek-flash/Responses身份，Candidate19原字节、temperature0/reasoning.effort none/stream false/max_output_tokens8192；每来源按发布日期09:00+08:00/Asia固定基准。SOURCE/参照/身份/组件/评分/规则在任何新输出前冻结；身份dispatchAuthorized=false、NOT_RUN，实际未来授权独立执行层绑定本批新grant。

2026-10-04只读[官方价格](https://api-docs.deepseek.com/quick_start/pricing/)与[Responses](https://api-docs.deepseek.com/guides/responses_api/)核验：deepseek-flash当前路由DeepSeek-V4.1-Flash，旧v4-flash名称对应模型已退役。这四份属于当前路由表现，不声称复现原批模型版本。价格缓存未命中峰时input US$0.30/M、output US$1.20/M；非高峰更低，但预算不用缓存/低谷优惠。reasoning关闭，usage有input/output及其中reasoning，非额外模型请求。

保守边界采用现成执行器全官方1M上下文桶1,048,576输入token上界，不扣去输出，再加8192输出上界；即使1M按十进制或共享上下文解释，此边界更保守。单元ceil(1,048,576×0.30+8192×1.20)=324404 microUSD；4单元US$1.297616，建议本批硬上限US$1.30。没有用请求字节估token。当前调用/usage/实扣为NOT_RUN/NOT_OBSERVABLE；该金额是最坏保守预算，不是供应商实扣。

价格不是永久许可。新grant前需再只读核官方路由/价格/上下文输出/额外收费、同步已提交HEAD、四个identity/request SHA及完整账本；12小时有效核价文件和真实用户授权原件仅本机.data。超上限、漂移、未明附加费或不确定状态停止。一次发送、零retry/repair/verifier/额外样本；没有raw不能断言没送达；缺usage保守结算上界并停后续。唯一新grant，原US$3.90许可不复用。

此文不构成授权；本轮模型/grant/reserve/settle=0。冻结后可用如下具体授权文字：

> 授权仅执行C19-PUBLIC-DEVELOPMENT-R1原冻结的4个deepseek-flash身份，费用硬上限US$1.30，仅为本批创建一个新grant并逐单元reserve/settle；每身份最多一次发送，不增加样本、重试、repair或verifier。重新核价超上限、身份漂移或状态不一致即停止。不授权真人、Holdout、默认替换、合并或部署。
