# V5真实四份诊断后的两处程序修复
2026-10-07。当前生成契约、Prompt及候选均未改变。此包先按原冻结发送4次，再用取得的4份原始回答定位；公共转换变化不能回写原成绩。

## 1. 已有主动作的附属支持被误认为新实体
真实02的URL被不可变scope索引拆在https:后，完成标准、个人条件及“视同离校管理”均引用已有任务。原V5编译器要求information.primaryEntityIds为空，因此SOURCE_CONTRACT_INFORMATION_ENTITY使整份没有首次建议。

authority-support-context-1.0.0只在真实主任务和动作/对象已存在、同源逐字依据和任务proposition均包含该片段、该片段不是动作/对象主scope时，投影附属支持到旧information空索引。原声明整份留在audit，task、condition、criteria及原回答保持。URL必须接紧邻https:且同一主动作；完成标准须有真实引用；个人条件须unknown且有原文条件引用；管理分类须同一条件的相邻说明。假ID、跨源、主动作改信息、另需缴费等新增义务仍错误，不能从scope猜业务实体。该投影inferredFacts=0。

普通首屏真实02现在显示主登记和两个待核对子项、原文日期精度及完成标准；主项可接受，条件未知子项不自动入库。没有用户补录。反例使用返校/设备借用两个不同对象，通过真实Schema、公共转换、capture、DomainCommitPlan及Repository独立读回；不计模型样本。

## 2. 同事件的日期与时段是互补事实，不是冲突起点
真实04原答分别提供日期起点、clock range起点、同range结束，原编译器DUPLICATE_ENDPOINT。authority-endpoint-composition-1.0.0只组合一个明确事件的2start(date_only+clock range)/1end，日期与clock为相邻且事件引用的原scope，时段正序合法、owner单一正确，没有引用该clock的冲突。保留date ID、end ID、原字面clock及日期/时段依据，冗余clock ID仅在新投影退休并记审计；不新建事件/结束/报名关系。

浏览器又发现普通App二次组装将合法裸clock读成日期/unknown。grounded-first-suggestion-1.4.0在同事件/同endpoint、已引用唯一相邻中文日期标题的严格条件下，用原日期与对应clock解释，再保留原rawText/精度/审计。没有复制另一套时间解析器或改source-time-semantics-2.1.0。未引用日期、非相邻标题、其他owner、倒序、坏证据不能借日期。

真实04的互补表示已能被此投影处理，但报名task声明event present、事件relatedTaskTempIds空的真实关系缺口仍阻断，不能因此算整份正确。独立匿名设计讨论/材料说明会证明精确两端与普通二次组装一致；最终6880实际确认及刷新读回09:30/11:00。工程夹具不补真实04关系，不计4份模型分母。

## 接入、保存与仍未解决
复用普通App→ReviewSession→DomainCommitPlan→Repository。解码链为支持投影→互补端点投影→既有属性反向索引→原契约校验→普通公共组装；原响应/投影审计/首次展示/用户选择分别持久化。新增两份匿名夹具只在录制服务定向验收模式；浏览器实时模型路由403。

原01仍缺激活登录时间owner且活动属性与主动作scope冲突；原03把准备终端义务放入location_note，且报名活动关联缺失；原04关联缺失；程序没有补动作或关系来制造正确。真实02完整子项边界、日前含日及标题/自由描述仍UNKNOWN。详情见[逐断言](FACT_ADJUDICATION.json)、[原事实](MODEL_FACTS.json)、[新转换](PRODUCT_DIAGNOSTIC.json)。

下一轮最多一个生成假设：先明确原文最小动作/对象及其适用/前置，再从一份主实体声明生成时间与关系覆盖，可减少义务被附属说明吞掉及present无owner。它需要独立版本、反例和新输出验证，尚未实现/冻结/授权；不默认新候选或固定16/24次，不用本批余款。当前只交付上述两处有证据的程序修复。
