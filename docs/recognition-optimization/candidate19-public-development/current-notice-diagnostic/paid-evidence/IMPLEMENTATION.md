# 两个公共程序根因的实际修改

原4请求在d8fde20f94f98acbd1b730ae8534f0cd029ab1b7同步HEAD下完成，generation snapshot c4f5aedf7cb71f16d13dfcb93b626dd42ae3a155。原C19/Schema4.0.0、Manifest/176组件/5产物/4身份、raw及首次报告保持；这里只改变后验公共产品机制。

| 场景及发生层 | 实际代码路径 | 正反例及读回 | 失败保护 |
|---|---|---|---|
| 02已有登记应用/URL，公共渠道误清空 | src/recognition/materialChannelGrounding.ts，1.4.0，citedClauses/destinationRole | 真实Schema→转换→Capture→sourceReview→DomainCommitPlan→Repository；读回相同入口；7个不同对象登记角色检查 | 仅重接唯一字节相邻引用；URL字面相同、同对象登记；错误URL/对象、否定、条件、矛盾拒绝，不猜渠道 |
| 03已有唯一活动闭区间，合法年份补全被误拒；标题跨相邻引用被清空 | src/recognition/rangeEndpointSupport.ts、firstSuggestionD26.ts，1.2.0 | 原raw不变，7/6→7/10/date_only、title保留，正式读回owner/依据/刷新一致；6区间及错owner反例 | 同一既有事件共同引用、值与类型有效且唯一；倒序省略跨年、错日期、多区间、错owner不支持；不发现新实体 |

originalProse/generatedProse、rangeSupport、materialChannelAudit、原响应与firstSuggestion分开保存。没有改变评分接受缺事实的规则；03仍4事件，01/04仍原图冲突拒绝。普通App、ReviewSession、sourceReviewD26→DomainCommitPlan单事务及独立Repository复用；未确认不创建正式任务。D27不改变原deadline。

原付费host仍检查活动冻结组件，修后漂移会拒绝，没有放宽执行器。新scripts/current-notice-completed-readonly.mjs仅校验已完成录制：原Git blobs/Manifest/输入产物/身份/完整账本/raw/receipts；全SETTLED、无锁/halt/不确定才回放。append/sendOnce机械抛READ_ONLY，无恢复/派发入口。serve-candidate19-recorded.mjs新增显式--current-notice-completed；旧模式不变。Node隔离反例验证完成包、UNCERTAIN拒绝和请求漂移拒绝，不创建真实授权/账本。

普通事件按钮目前整体保存，缺逐个拒绝；本轮不新增第三条产品改造。03工程保存只检查新端点事务，额外事件仍错误。02重复title及条件拆分尚未完整裁决。

复现新转换：node scripts/diagnose-current-completed-recordings.mjs --verify。只读公开4raw及原冻结身份，核request/response SHA；写模式仅首次创建新AFTER，无网络/Secret/账本。旧13：node scripts/verify-current-notice-recordings.mjs --verify，firstSuggestion完全相同。
