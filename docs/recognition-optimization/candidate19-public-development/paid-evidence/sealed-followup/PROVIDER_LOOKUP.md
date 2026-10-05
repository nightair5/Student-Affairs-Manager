# 原批第2请求：供应商控制台只读取证接续

2026-10-05。起点HEAD `1c2cca3791dd06bb55a36e87158bea6a65c6a8e1`、upstream及远端一致，工作区干净。本次没有新输出或确定产品缺口，没有改产品代码、Prompt、候选、执行器或冻结文件。状态：PROVIDER_LOOKUP_COMPLETED_REQUEST_ASSOCIATION_UNRESOLVED。

## 实际检查及限度

通过官方Computer Use控制已登录Edge中的DeepSeek控制台。原标签连接报 `Timed out after 10000ms waiting for CDP command Emulation.setFocusEmulationEnabled.`；按官方browser-troubleshooting说明，在同一浏览器建立新标签后成功。不用其他控制机制，不读取凭证。

| 入口 | 实际观察 | 对第2请求的证明力 |
|---|---|---|
| [用量信息](https://platform.deepseek.com/usage) | 选择“昨天”（2026-10-04）；页面说明GMT+8、可能5分钟延迟，按日期/模型/API Key汇总。实际账号数字只在本机私有原件。 | 无逐请求ID、接收/完成状态、对应usage/计费或回答，未建立原ordinal2关联。不能把账号总数减去本地已知请求就认定剩余是第2。 |
| 用量“导出” | 点击一次；官方download事件等待15秒超时：`Timed out after 15000ms waiting for download.`。没有取得可核验文件，未声称导出成功。 | 导出内容/粒度未证实；不能据此断言供应商完全不提供明细。 |
| [账单](https://platform.deepseek.com/transactions) | 可见“充值账单”“赠送账单”；列为订单编号、状态、金额、支付方式、创建时间。没有操作退款、发票或支付。 | 充值订单不是模型调用记录。没有取得第2的逐请求实扣。 |
| [官方帮助](https://static.deepseek.com/faq/index.html?lang=zh#/category/4)→意见反馈 | 打开“用户工单填写表 User Ticket Portal”；仅查看空白表单，未填写身份、通知、API Key，未提交。 | 已核验可由用户查询的渠道；不是支持答复或请求结案证据。 |

这些结论只覆盖本次可见页面，不宣布后台不存在逐请求记录。账号余额、用量数字、原件、截图和账号映射仅放忽略的 `.data/public-notice-development/provider-lookup-20261005/`，不进Git。公开的[校验摘要](PROVIDER_LOOKUP_VERIFY.json)仅保留状态、匿名SHA和校验结果。

## 四个结论分别保留

| 判断 | ordinal2本次结论 |
|---|---|
| 送达/执行 | UNCERTAIN；本地HALT时间不是供应商接收时间。 |
| 计费 | UNKNOWN；reserve US$0.324404是暴露上界，不是实扣。 |
| 回答恢复 | UNKNOWN；没有取得原响应或支持确认。 |
| 输出评价 | UNKNOWN；无可验证回答，不补raw、不计正确、不删4分母。 |

第1仍SETTLED且绝不重发，第3/4仍NOT_SENT。HALT、锁、STATE、AUTH、PRICE、receipt及唯一原grant保持。恢复能力的证据条件未满足，故不新建空白恢复层、不给出付费续发申请；现执行器仍不支持外部结案/跳过UNCERTAIN。新阶段日志不能倒推历史送达。没有新模型证据，原答/当前首屏仍1暂定正确、3未知；不新增模型准确率结论。

## 用户可自行提交的最小查询文字

在上述官方帮助进入“意见反馈”，选择中文，按表单要求自行提供联系方式及账号识别信息。以下文字仅为草稿，Codex未代发；不要粘贴API Key、密码、付款凭证或整份通知正文：

> 我需要核对DeepSeek API一次丢失响应的调用。接口为POST /responses，模型字段deepseek-flash。2026-10-04北京时间23:44:44.476（UTC15:44:44.476）客户端记录停止；这只是本机停止观测时间，不是请求开始或供应商接收时间。该批先有一份成功响应，下一次调用失败后缺少响应和供应商request/response ID，目前不能判断请求是否送达、执行完成或计费。请协助查询与该账号、当天停止前实际调用对应的逐请求记录，提供ID、接收/完成时间、状态、usage和对应计费，并说明原回答是否能恢复。若无法唯一关联，请说明还需要什么非密钥材料。请勿代发或重试模型请求。已成功前一请求的response ID可按需在私有渠道补充；不能只凭时间相近或日用量结案。

本地identity/request SHA只能校验本地身份，不是供应商请求ID；不要声称支持能用这两个SHA直接检索。只提供能证明关联的材料即可，不要求一次提交所有字段。支持答复与原件继续仅留本机忽略目录。

## 本次验证与最小后续

三项要求的只读命令均exit0：public-notice-recorded-readonly、report-public-notice-recorded --verify、verify-recognition-history --verify。84保护/119冻结/7归档、原Manifest/4身份/请求、旧12raw及首次展示不变，原996前缀保持。权威链1000行，SHA `fe24750479d3a5229e386e8088199ae097f48a1f6872f0eaac016cfaeddbb48d`，完整链与现场状态一致，model/grant/reserve/settle/ledgerWrites全部0。

本次只同步查证与交接文档；产品/工具/构建/数据库均未改变，明确复用[上一验证](VALIDATION.md)和[浏览器](BROWSER_EVIDENCE.md)，不重跑无影响的全量或冒称新点击。基线41组35PASS/6旧FAIL、1048PASS/1skip、lint8旧warning及audit5H2M/production0保持为此前观测。

下一步只缺**能把供应商结局关联到原ordinal2的记录或支持答复**。有材料再只读核验；充分后才实现并离线验证最小恢复，另取精确结算/原3、4身份范围许可。未满足时封存保持，不循环查控制台、不用新请求测试连接、不另开批绕过未知。唯一产品入口仍[6841](http://127.0.0.1:6841/)，固定录制、实时派发关闭；无新产品缺口不制造候选或工程阶段。
