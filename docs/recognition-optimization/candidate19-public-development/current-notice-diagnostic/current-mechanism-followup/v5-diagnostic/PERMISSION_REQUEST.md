# 当前V5真实通知：唯一具体许可申请
2026-10-07T10:19:46.863Z。这是申请和只读费用证明，尚无本批用户授权；不创建AUTH/新grant，不发送。

目的：当前未改V5生成机制在四份既有官方节选上的单臂首次事实诊断。不是新候选比较、不是原封存ordinal3替代、不填原8未知。旧C19已见来源明确Development；参照single-author/model-assisted/provisional，七类事实及争议分母保留。

- 批：V5-CURRENT-REAL-NOTICE-DEVELOPMENT-R1；SingleAuthority生成契约5.0.0、候选single-authority-generation-1.0.0、Prompt recognition-single-authority-1.0.0，均未改输入。
- 仅原冻结4个deepseek-flash身份；Responses，temperature0/reasoning.effort none/stream false/max_output_tokens8192；请求不含Expected。
- 生成提交：99424e33ced530bffc2a6c80908a35417d475b28。190组件、5产物、4请求。
- Manifest SHA：e0d484a6945b659a35f784a5840f269eb6df77c9e5ffb42361ccb20f00debfb0。
- 身份SHA：66496ee7f395f9641667065fb199d398bb333305b3fec0bf45b3b193c9abe724。来源/参照/参数/公共转换/评价规则详见原冻结文件，不改字节。
- 拟授权整批硬上限 **US$1.30**，唯一本批新grant，逐单元reserve/settle，每身份最多一次；零额外样本/retry/repair/verifier。
- 实际旧批许可均不得复用。本批全4NOT_RUN，原答/首屏0正确0错4UNKNOWN；不据此计算成功率。

## 可证明费用上界
[官方价](https://api-docs.deepseek.com/quick_start/pricing/)当前deepseek-flash路由DeepSeek-V4.1-Flash，1M上下文，384K最大输出；峰时未命中输入每百万US$0.30、输出US$1.20。采用较大的二进制1M=1,048,576作保守输入上界，冻结输出8,192；不是字节估token，也不是实测费用。
每身份ceil(1,048,576×0.30+8,192×1.20)=324,404微美元；4身份1,297,616微美元，即 **US$1.297616≤1.30**。不依赖缓存/非峰时折扣。
[Responses规范](https://api-docs.deepseek.com/guides/responses_api)支持冻结参数，并把推理token列在output_tokens子项；[官方API输出界](https://api-docs.deepseek.com/api/create-chat-completion)明确384K为393216、none关闭思考。本批仅文本，无tools/images；公开表没有另列普通文本附加费。新增/不确定收费、路由或上限须在grant前停付费，不能靠此旧快照继续。
本机PROPOSED_PRICE_EVIDENCE SHA：3102c4b8b3157b5e5792d586f661203a9835c53aedcd81ab70e3cadb3bbe0c10；官方原页只留.data，公开文件不复制长篇原文。

## 授权后连续执行
grant前重核当前官方价/路由/上下文输出及附加费、同步HEAD、4身份/requestSHA与完整账本。许可原文和PRICE/AUTH仅本机.data，不进Git。绑定当前已提交已普通推送HEAD，不把生成提交当当前授权HEAD。
复用薄绑定和既有once-send执行器，严格ordinal1—4/跨进程锁/发送前持久状态。送达、raw、usage、计费或settle不确定立即封存并停发；没有raw不证明未送达。旧封存批不恢复、不补settle、不解锁、不重发。
同包接四份确定raw→普通App→ReviewSession→DomainCommitPlan→Repository，逐事实/逐层诊断，最多2实际根因；无输出不造回答。单臂不判相对赢家。

## 唯一需要用户回复的授权
“授权仅执行 V5-CURRENT-REAL-NOTICE-DEVELOPMENT-R1 原冻结4个deepseek-flash请求，整批硬上限US$1.30，仅一个新grant并逐单元reserve/settle；每身份一次，零额外样本/retry/repair/verifier，核价超限、漂移或不确定停发。旧封存批不恢复。”
不含真人、Holdout、默认替换、合并、部署；若已收到对应直接授权不重复询问。
