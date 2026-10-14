# 第2请求有限取证与恢复条件

2026-10-05。一次只读收口；本轮业务模型、grant、reserve、settle和权威账本写入均0。原执行现场及原冻结快照不改。[现场快照](FORENSIC_SNAPSHOT.json)。

| 已有证据 | 能证明 | 不能证明 / 最小补充 |
|---|---|---|
| 第2 STATE为UNCERTAIN、SEND_RAW_OR_STATE；唯一第2reserve receipt，无raw/settle | 已预留该身份，失败后停止封存 | 不能判断SENDING持久化、transport、响应头/体、raw或状态落盘哪一步失败；不能判断送达和扣费。 |
| HALT observedAt=2026-10-04T15:44:44.476Z（北京时间23:44:44.476） | 停止观测时间 | 不是供应商接收时间。reserve原记录无时间戳，不编造发送开始或精确检索窗口。 |
| 第1 HTTP/raw/usage/settle完整；第3/4 NOT_SENT | 第1确定；后两份停发 | 第1成功及总体余额变化不能证明第2结局。 |
| 锁目录/HALT、STATE/AUTH/PRICE/许可SHA、4receipt、原Manifest/4身份/requestSHA、1000行链一致 | 本轮未改原现场，原996前缀保持 | 本地request SHA不是供应商request ID，不能凭SHA断言送达。 |
| 代码先写SENDING，随后sendOnce→头/体→raw→状态→settle，宽泛catch覆盖这些阶段 | 可以列出可能阶段和停发路径 | 原现场缺分阶段记录，代码顺序不能反推哪行实际成功。 |

## 最少一项外部材料

需要**能关联第2请求的供应商请求记录**：request/response ID（若有）、接收或失败时间/状态、模型、usage或逐请求计费；能恢复的响应另附。检索围绕停止前实际运行时段，停止时间不能冒充发送时间。模型deepseek-flash、Responses；原identity `247ebd7efc75b3c0f5acfe42d908e799c7e8141ce1bdaf3828332f0640efecf1`，request SHA `0631fdb13dbaabeecb0c3ab8cbdb3df91b9cc88fe2fa61bf37d2e2f840245368`仅为本地关联校验。

2026-10-05追加[供应商只读取证](PROVIDER_LOOKUP.md)：已查看登录后的原日期用量、账单及官方反馈入口；可见为日汇总/充值账单，没有取得逐请求关联。导出一次超时，未取得文件，仍未证实导出内容是否逐请求。原件、账单、账号映射只放忽略的本机`.data`，不进Git，不提供密钥。没有特定关联的余额或总数不足以结案，当前仍未收到能结案的材料；可由用户向官方支持提交文内查询草稿。

## 恢复决定

现在第1 SETTLED、第2 UNCERTAIN、第3/4 NOT_SENT；继续封存。不删锁/prepare/dispatch/新grant/重发/补settle。第2 US$0.324404为reserve上界，第1内部US$0.002470也不是供应商实扣；原整批US$1.30不扩展。

材料齐备后先只读核关联、原包和账本。计费确定但回答不可恢复，该来源仍OUTPUT_UNAVAILABLE/UNKNOWN，不能造raw或计正确。证明没送达也不自动授权重发第2。第3/4需第2确定结局、未决暴露/预算核验，用户另行明确原未发送身份、唯一原grant及整批上限范围。本提示词没有恢复许可。

**当前执行器不支持外部对账结案或跳过UNCERTAIN ordinal。** HALT、nextOrdinal及raw/结算前缀校验阻止续发；删锁或改状态不能合法恢复。最小技术动作是后续在非冻结恢复层增加另版本的证据绑定、确定结局登记和恢复授权校验，保留原AUTH/PRICE/锁/STATE/Manifest/身份，不将新公共组件塞入原请求。核原d223698快照、identity/request SHA、唯一grant、结算/暴露、同步提交及有效核价绑定。本轮未实现或启用恢复层。

## 新诊断仅改善未来

活动工具附加`scoped-safe-phase-diagnostic-1`的小型fsync阶段记录，不重建派发逻辑。只有白名单phase、安全code、匿名identity/request SHA、ordinal、时间及版本/角色；不记录请求/响应正文、Secret、headers、任意错误对象/stack。构造和只读不创建日志，本轮原执行目录没有新增阶段记录，原冻结副本保持。

ENTER表示准备执行该阶段；COMPLETED表示本地步骤返回。TRANSPORT_ENTER不是供应商收到，响应头/体不是业务成功，SETTLE_COMPLETED不是实扣。诊断失败也停发。离线覆盖发送前、头/体、raw、状态、settle失败，以及raw/settle已完成后诊断失败；UNCERTAIN且不重复副作用。[验证](VALIDATION.md)。新日志不能反向证明本次第2没发送。
