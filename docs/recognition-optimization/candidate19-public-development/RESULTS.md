# 当前首次建议：已有事件被转换误拒，产品已修；付费批次封存

2026-10-05。状态：PUBLIC_KNOWN_RECORDING_PRODUCT_FIX_DELIVERED_PAID_BATCH_SEALED_INCOMPLETE。当前唯一内部入口 [http://127.0.0.1:6840/](http://127.0.0.1:6840/)，普通App、固定录制、全新隔离库；实时模型机械关闭。

## 实际改善与边界

PUB-C19-01原回答已经有服务暂停事件、准确开始和结束时间，但附属说明片段引用已有事件/时间，被冻结公共转换1.0.0拒绝：PRODUCT_SUPPORT_UNSUPPORTED_CONTEXT_REFERENCE，第一份建议为空。本轮只修一个确定性公共根因，source-support-accounting-projection-1.1.0把有同来源、同owner、真实主事实及实际时间依据的附属引用转为审计元数据。不创建事件、不猜端点、不改时间/关系，inferredFacts=0。

同一原回答现在首次就显示0任务、1事件、2准确时间，用户无需人工补录停机事件或起止。真实Schema、普通首屏、ReviewSession、DomainCommitPlan、Repository独立读回已验；假ID、缺主事实、错日期/类型、跨来源/scope、假owner和颠倒端点仍拒。不同对象、日期、标签和顺序反例也通过。[逐层根因](paid-evidence/ROOT_CAUSE.md)、[新诊断](paid-evidence/POST_CONVERSION_DIAGNOSTIC.json)。Candidate19的Prompt、wire与candidateVersion未改；没有Candidate20或新比较包。先前渠道1.3.0、资格、条件及D27最小安排复用。

这证明同一录制的程序兼容和首次可展示修复，不能称新版模型准确率提升。模型漏事实仍不补成首次正确。整个4来源不完整，不给总体正确率或相对赢家。

## 本批实际执行与完整分母

用户本批明确许可4身份、US$1.30硬限、唯一新grant及逐单元reserve/settle；没有复用旧C19的US$3.90许可。执行绑定同步HEAD e32462ef85c9911e704f8f4fecdd6e24ccf5d09f、原d223698冻结包。原Manifest、4身份及dispatchAuthorized=false原字节保持。官方核价保守4单元上界US$1.297616，不以字节估token；真实许可、PRICE和AUTH原件只留本机.data。[执行与链证据](paid-evidence/EXECUTION.json)。

| 原ordinal | 现场与结论 |
|---|---|
| 1 / PUB-C19-01 | HTTP200、raw/response/真实usage及结算确定，SETTLED。 |
| 2 / PUB-C19-02 | 一次reserve后SEND_RAW_OR_STATE不确定，无raw/settle；UNCERTAIN，不能判“没发送”。 |
| 3 / PUB-C19-03 | NOT_SENT，停发。 |
| 4 / PUB-C19-04 | NOT_SENT，停发。 |

第2单元触发UNIT_SEND_RAW_OR_SETTLEMENT_UNCERTAIN；HALT/锁/状态原样封存，未恢复或重发，后两份不继续发送。底层确切网络/发送/落盘原因无法从安全错误码证明。第一次grant前另有空锁/远端网络失败，零grant/state/raw/receipt/账本写入被证实后仅保留空锁并重建；它与当前不确定锁是不同现场，不能借此恢复当前锁。

| 证据层，固定4分母 | 正确 / 错误 / 未知 | 含义 |
|---|---|---|
| 原答业务事实暂定裁决 | 1 / 0 / 3 | 已读1份包含所需事件与准确端点；作者暂定、非独立真值。 |
| 冻结wire契约 | 0接受 / 1拒绝 / 3未知 | information附属引用不合原契约，不能冒称原wire正确。 |
| 原冻结转换后的首次建议 | 0 / 1 / 3 | 唯一已知回答无法形成建议。 |
| 本轮新转换后的人工前建议 | 1 / 0 / 3 | 同一原答的工程修复；不是新模型输出。 |
| 真人最终处置/四指标 | 0已裁决 / 0已裁决 / 4未知 | ENGINEERING_REPLAY，NOT_OBSERVABLE。 |

[原冻结诊断](paid-evidence/INITIAL_FROZEN_DIAGNOSTIC.json)、[逐事实暂定理由](paid-evidence/ADJUDICATION.json)及完整报告分开。标题、描述、额外义务、依据与图均检查；4分母不删。只知道1份，不能写100%或把1/4当总体估计。

原12全部仍确定结算，原v11 C17 2/6、C19 1/6、MIXED_PROGRESS不动；旧后验C17 4暂定/2错、C19 5暂定/1渠道争议不动。本轮全部12 raw SHA和人工前firstSuggestion与上轮深比较相等，S05“平台”仍推测/正式渠道null，完成标准/PDF/命名/截止/事件保留。

## 普通页面、保存与测量

新库rco-mainline-01-02-i1-d27-plan-recorded-publicpaid1004；构建e32462ef85c9 / source b6881247af86。实际验1份当前录制和3份明确标历史控制，没把13份录制混作本批模型分母。旧6836等库未访问。[浏览器操作和失败分支](paid-evidence/BROWSER_EVIDENCE.md)、[独立值与测量](paid-evidence/browser/CHECK.json)、[447份构建源与Git及raw原字节证明](paid-evidence/BUILD_PROOF.json)。代码比较仅规范化CRLF；raw和审计证据比较保持原字节，不把构建时起点HEAD当最终提交。

公开停机事件正式失败时0Task/0Project/0Event/0Time，输入/草稿仍在；关闭重开手动确认后0Task/0Project/1Event/2Time，May9 15:00→May11 08:30。原C19 S02已提交读回失败时按钮禁止重提，只重新读回后两事件四时间一致；“周五夜间”和“恢复尚未公布”保持null/vague。S03只确认填写/递交，前置todo、递交等待，资格未知领取项仍草稿。S05准确截止、PDF、命名及完成标准保留。最终3Task/0Project/1Material/4Event/9Time，3 confirmed、1 partially_confirmed；刷新前后正式全图相等，无控制台错误。

操作：展开下方录制区，选来源，复制只读原文到首页快速粘贴，智能拆分→核对摘要→一次接受；不需要重填这次已有事件。普通确认保留，原截止与个人安排分开。未测同口径旧页面步骤差，不估省时比例。

4份工程页面均无字段edit，没有造editId；4个commit有独立readback，2失败保留。S02和S05有闭合工程区间且主动编辑0；PUB1刷新时间断点、S03未闭合区间写null/缺失。canonical部分确认与旧计量终态分列，没有改历史算法或把保存等同正确。真人首次/最终正确率、低修改收益和时间仍NOT_OBSERVABLE。

## 费用、验证、保护与最小下一步

ordinal1真实usage：input4684、cached4096、output887、reasoning0、total5571；内部保守结算US$0.002470，非供应商实扣。ordinal2 US$0.324404为未结算reserve上界，实扣及是否送达不可观察；硬限仍US$1.30，不以余款加样本。价格来源：[官方定价](https://api-docs.deepseek.com/quick_start/pricing/)、[Responses](https://api-docs.deepseek.com/guides/responses_api/)；原核价快照不代表未来价格。

[本轮验证](paid-evidence/VALIDATION.md)：新5+原支持6定向通过；全量40组34PASS/6旧历史FAIL，当前产品1045PASS/1skip，server/worker/worker-d26/functions/carrier均执行到退出。lint0错误8旧警告、build/scan及新只读脚本lint通过。audit直连TLS失败，现有代理只读重核成功，仍5high/2moderate、production0；未改依赖/锁。

84保护/119冻结/7归档通过；原996行前缀SHA保持。本批许可产生4个合法追加：grant、reserve1、settle1、reserve2；现在1000行完整链SHA fe24750479d3a5229e386e8088199ae097f48a1f6872f0eaac016cfaeddbb48d。封存后本轮产品、浏览器、测试、报告均0模型/0账本写入。新诊断可只读复验：node scripts/report-public-notice-recorded.mjs --verify；不要求旧Manifest吸收新产品代码。

最少下一步是可信供应商侧第2请求的送达/响应/usage或账单证据，先只读对账。没有证据不能解除当前封存、重发第2或发送第3/4；不自动prepare/dispatch、新grant或重复申请整批。确定后才能按原身份、整批上限与对应明确恢复范围另行决策。安全本地产品已交付，完整陌生来源表现仍证据不足；真人/Holdout/default替换/合并/部署未做。
