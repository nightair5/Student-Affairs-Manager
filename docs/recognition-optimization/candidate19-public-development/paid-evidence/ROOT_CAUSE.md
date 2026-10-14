# 实际录制的一条产品根因

范围仅PUB-C19-01，不追溯全仓，不变模型输入。原文是图书馆暂停服务的官方操作摘录，来源、日期与SHA沿原PROVENANCE/SOURCES；不是完整官网全文。

| 层 | 证据和当前行为 |
|---|---|
| 原文最小事实 | 安全升级，查收查引服务暂停/期间无法办理；2026-05-09 15:00→2026-05-11 08:30；无行动义务。 |
| Candidate19原答 | 0task、1event、2event_start/end；完整description、scope与实际端点依据。raw-01和response SHA不变。 |
| 原wire/冻结公共转换 | information附属引用已有event/time，真实契约SOURCE_CONTRACT_INFORMATION_ENTITY/产品PRODUCT_SUPPORT_UNSUPPORTED_CONTEXT_REFERENCE拒绝。不是事实遗漏，原契约仍判拒绝。 |
| 新公共1.1.0 | 仅支持真实主事件、原来源片段及其同owner端点附属引用；纯时间标签只能引用紧接且有实际值依据的端点。INDEPENDENT_EVENT_CONTEXT/EVENT_TIME_CONTEXT/EVENT_TIME_LABEL_CONTEXT转换留审计。 |
| 首次普通页面 | decodeCurrentSourceRecording→decodeProductSourceRecording→assembleCurrentFirstSuggestion→App/DraftReviewPanel，0任务1事件准确起止，不需用户补事件或时间。 |
| 正式保存 | ReviewSession/sourceReviewD26→DomainCommitPlan→CanonicalWorkspaceRepository单事务；独立Repository读回0T0P1E2Time。 |
| 安排影响 | 无任务不生成执行待办；精确事件端点保留。D27个人安排未覆盖原截止，模糊/未公布控制端点不编日期。 |

代码src/recognition/sourceAccountingSupportProduct.ts，新版本source-support-accounting-projection-1.1.0。只清除合格information次引用以适配已有compiler，同时sidecar保留originalWire、逐引用reason、projectedAccounting，inferredFacts=0。events/timePoints实体、值、证据与边不变；不修改冻结Schema/scorer，不偷把漏事件信息行转实体。

真实Schema正反例src/recognition/independentEventSupport.test.ts：实际raw原拒绝→新可读；另一对象、日期、标签、accounting顺序；11项最小错误引用/值/类型/owner/主事实变体及跨来源；原答全information且空实体不凭程序补出事件；capture/正式计划/读回及重复提交幂等。不是新模型表现测试。旧12两臂逐份首屏深比较不变。

只读现场脚本public-notice-recorded-readonly.mjs不包含发送、写账本、改锁或prepare API；核原快照、当前原产物字节、授权SHA、链前缀/完整链、唯一grant、receipts、每个identity/request、已结算raw/usage/metadata。只暴露确定ordinal1；不确定ordinal2和后两份不进入录制。serve-candidate19-recorded --public-paid-recordings复用原服务器与普通App，明确4分母/12历史控制区分，不建平行保存链。

下一生成缺口目前无法由这1份确定响应证明。未改Prompt或建立候选，未扩批；供应商现场未知是发送安全阻碍，不由产品程序修复掩盖。
