# 原请求有限取证与后续观察边界
2026-10-07。结论：**原批继续封存；没有足够证据提出恢复授权。** 本次不是新的准确率比较或准备批次。[现场与代码依据](TRANSPORT_FORENSICS.json)、[退出验证](TRANSPORT_VALIDATION.json)。

## 已证实与尚不能确定

原 ordinal1：identity `5226a924b92676866252e461b02e2c915a9dea8fdedca3ad77e689989bef62e1`，request SHA `206bfbcf29ba3f4938b809ee83ea70f249c13132364816c8567f6c4fcd15313f`。21:43:00.530—21:43:16.471（Asia/Shanghai），原记录 `TRANSPORT_ENTER → STOP_UNCERTAIN/OTHER_FAILURE`；没有 headers、response、raw 或 settle。0SETTLED/1UNCERTAIN/7NOT_SENT、唯一grant/1reserve/0settle不变。

核原73a8b923的Git blobs和活动文件：
1. core在调用host的transport wrapper前记录TRANSPORT_ENTER；
2. wrapper再次执行authorization：价格/身份/授权SHA等、`gitCheck`（含live `git ls-remote`）、账本reserve核对与before_send；
3. 才调用批次adapter，adapter又先检查配置，再进行CONNECT、TLS、HTTPS POST和body end；
4. headers/body/raw/state/settle各有旧阶段，但最后本地检查与POST边界没有标记。

用**同一原host/core**、临时匿名账本和fake transport分别注入最后一次Git失败与POST函数进入后失败：前者fake POST=0，后者fake POST=1，两者旧日志都是TRANSPORT_ENTER/OTHER_FAILURE。两者都UNCERTAIN、保留锁/HALT、拒绝后续发送。这里的fake grant/reserve/settle只在新临时目录，权威账本写0。

这是观察缺口的反例，不是原请求未发送证明。先前Git schannel间歇失败与后来一次TLS成功都不能倒推出原失败原因。现有特定材料不足：本地检查失败、配置失败、代理/TLS失败、POST后失败仍不能唯一确定。无raw不等于没发；POST API/end标记也不等于供应商收到或计费。

## 最小工具修复与接入方式

新 `scripts/scoped-transport-boundary-diagnostics.mjs`，版本 `scoped-transport-boundary-observation-1.0.0`，只提供可选观察包装：
- `withTransportBoundaryDiagnostics(options, journal)`装饰原createScopedHost的options，使用原engine.runOne、原授权/预算/锁/账本/写入协议，记录最终host核验、同步Git、adapter与响应边界；
- `createBoundaryPinnedProxyFetch(observation, deps)`利用原createPinnedProxyFetch的依赖注入观察CONNECT、TLS、HTTPS request API和body end；固定目的地、证书校验、一次发送和禁止redirect不变；
- `createBoundaryJournal(newRoot)`只写9个允许字段，不记录正文、密钥、headers、stderr、stack或任意错误文本。拒绝旧版本/错身份日志，写入失败不继续危险操作；Node异步回调里的观察失败经原route error listener拒绝，不成为未处理异常。

原v1日志继续记录raw/state/settle等保存阶段；新边界日志与它按identity/request SHA关联。ADAPTER_RETURNED之后的失败归为本地保存，不能称上游失败。两层都是观察，不能恢复状态、解除锁、修改账本或发放许可。

**原付费host没有导入此模块，原198组件/5产物/8身份和封存字节不改。** 新包装已在实际原host/core和原pinned route的fake依赖下运行，尚未经历真实付费派发。未来只有具体恢复方案获授权且代码/HEAD/身份安全绑定完成后才能选用，不能临时替换旧gate来恢复本批；模块没有dispatch CLI、环境读取或新执行链。

## 主线产品的真实边界

四旧raw用原referenceTime/timezone和实际公共decoder重新诊断：01仍AUTHORITY_ATTRIBUTE_ACCOUNTING_OWNER；02可解码但边界/条件/自由描述未决；03/04仍SINGLE_AUTHORITY_MISSING_PRESENT_FACT。原raw SHA、结果/拒绝理由与上一轮一致。未找到新的可确定程序缺口；不改Prompt、另造候选或用附注猜补义务/关系。

产品仍旧4原答0正确/3错/1UNKNOWN、同raw首屏0/3/1；各新臂0正确/0错/4UNKNOWN，EVIDENCE_INCOMPLETE_NO_WINNER，不算观测准确率0%或100%。V6机制工程已交付，生成收益没有新输出证明。

本次未改变产品运行时。复用6886普通页面最终首屏/部分/局部风险/三故障恢复/刷新及独立4Task4Event12Time1Material0Project（含3个人安排）证据；不读写旧浏览器数据库，不重跑矩阵。新raw浏览器NOT_RUN；工程测量6报告40trace/缺失null/四真人NOT_OBSERVABLE不变。

## 最少剩余动作

原8封存文件、旧16文件、84/119/7及账本1026完整链/历史前缀逐项同。新业务模型/grant/reserve/settle/权威账本写0，原请求usage/实扣NOT_OBSERVABLE，reserve上界US$0.324404不是实际扣费。

只缺**ordinal1特定响应/usage/送达材料，或可靠的该请求未发/未送达证据**。材料一致后才制定具体恢复方案并请求最小授权；原授权HEAD与当前HEAD已不同，必须说明安全绑定，不能回滚或改旧授权凑过。材料不足时继续封存，不循环供应商、不创建替代批次、不申请笼统更多预算。普通确认/保存/安排已可操作；此次工具修复可单独回退，但不能用revert抹去原外部请求。
