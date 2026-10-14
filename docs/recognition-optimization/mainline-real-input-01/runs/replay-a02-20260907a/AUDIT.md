# A02只读回放与差异裁决

日期：2026-09-07；同一MAINLINE-REAL-INPUT-01。
起点Git/live远端：835ae162071b7181ea5bb325b475113e5108da5d。
结论：内部承接与内存确认读回可运行；发现材料状态误推；真实App历史回放入口不足。**产品完整验收未通过，不修改源码，停止申请精确范围。**

## 1. 本轮究竟推进了什么

不是再问模型一遍，而是把已经取得的A02原始响应，交给现有产品函数，观察它最终会变成什么任务。
确认“保存活动手册”能从真实模型建议进入待核对，再经模拟主动核对/选择/确认形成任务；独立新仓储实例读回一致。
但同时实证：模型材料required=true被本机直接转换为missing，面板显示“必须提供”，首页增加缺材料风险。不是只差JSON写法。

没有改Expected、candidate、scorer、模型响应、原输入或任何产品源码。A01/A02原账本及5份收据全SHA保持。0模型、0paid/recover/A03、0密钥/剪贴板/用户库访问。

## 2. 回放方式与严格边界

- 依据原STATE绑定的真实工程下载：preparation SHA c38ed5f5c6974ee49c4b8f2f94d78eb3b243acebd17174b24633d89461ebe22f；独立仓储下载 SHA 7cc9433e30c574932615e99ee1456acb68e42ba1d02d3c6c520156faf7586e84；全工作区对象 SHA b7c08ed26349a7ad5e1a67236058aa9c91ed6b678a2cf210647f5d59473b758a。
- 逐字读取这些既有匿名工程文件，复制到MemoryWorkspaceRecordStore；通过既有canonical.save载入内存副本，再由SemanticRepository全图验证。没有导入或写回原浏览器库。
- 使用原A02 handle、scope、consent时间与原始rawHttpText；重建请求SHA必须等于原清单和raw记录，未重造来源或新RecognitionRun。
- 复用completeInputRun → semanticReview → reviewSemanticFact → confirmSemantic →新SemanticRepository实例load/export；不是另写一套任务保存器。
- 保留execution=live、authority=live_model_candidate，表示原响应来自实际模型；**本轮仅历史响应回放**，不是新live调用，也未伪称human_engineering。
- 实际SemanticFacts与CalendarPage通过SSR渲染；未访问Edge，未验证浏览器逐键/点击、刷新、实际下载或真实IndexedDB持久性。内存新实例读回不冒充浏览器刷新。
- 探针入口/全过程保存在REPLAY.json的probeSource。探针仅以内存构建既有源码；没有新增产品脚本或修改测试断言。

## 3. 有效结果，不用测试数替代产品结论

| 验证 | 实测 |
| --- | --- |
| 原A02来源/请求/响应绑定 | 一致 |
| 建议数量 | 1条，动作对象正确 |
| 未核对直接确认 | 拒绝；内存正式工作区不变 |
| 核对并主动选择后确认 | 1条任务保存成功 |
| 原始响应/首次建议/来源文字 | 保留 |
| 新仓储实例读回 / 内存JSON导出对比 | 全对象一致 |
| 重复确认 | 不增加或覆盖 |
| 时间点/提醒/实际jobs函数 | 0 / 0 / 0 |
| 实际CalendarPage的SSR | 无截止日期列表包含任务 |
| 旧人工正常对照 | no-date 1条、multi 2条、condition-true 1条、revision 1条，共5条成功 |
| 本轮检查 | 最终25/25，仅内部工程/SSR，不是25个模型样本 |
| 实际Edge/真人主动时间/真实下载 | NOT_RUN |

原4类人工对照用seen_engineering_replay，和A02真实模型原始响应分开。条件真、新要求、多任务非零成功；没有靠全部不选/全部拒绝过检查。

探针首轮误用“只允许空库初始化”的接口载入非空历史副本，第二轮缺jsx:automatic；修正的是内存检查编排，不是产品源码。第三轮长输出截断不计验收；第四轮24项，第五轮加入日历/排序后25项。不同尝试和重叠检查不累加。原输出/评分失败保持。

## 4. 逐项裁决

| 差异 | 实际影响 | 裁决与定位 |
| --- | --- | --- |
| 新增“活动手册”材料实体 | 不新增任务，但canonical生成required=true/status=missing，页面称“必须提供”，首页风险“缺材料” | 原文确有该对象，所以不是凭空造名词；但未说要“提供”、也未说用户缺材料。**确有产品含义和排序偏移**。semanticState.ts:233、SemanticFacts.tsx:27、taskLogic.ts:82。 |
| present/local_change 对 future/physical_action | 动作对象、行动性、核对和确认均正常；本例没有因标签变化阻断 | 现有证据仅证明标签不同，不能判重大理解错误；原精确分数不改。 |
| 第一条scope归任务、第二条归information | 原文和两个scope仍保存，未造日期；任务主要依据入口只列第一句。无日期视图统一写“原文未说明” | 没有原文丢失，但“明确没有截止要求”被粗略显示为“没说明”。属于粒度/展示不足，不能说已丢失全文或已造日期。 |
| 描述“请保存…”和完成标准“活动手册已保存” | 描述保存；完成标准在原始/语义明细保留，旧任务投影completionCriteria为空 | 礼貌词差异不改变动作。任务明细与兼容视图能力分开，不能用空投影认定原始事实被覆盖。 |
| coverage材料present而参考not_stated | 材料实体随任务确认，成为缺材料风险 | 真正优先修的是“材料被提到/被要求”与“当前是否准备好”混为一谈，不是删除材料或改答案救分。 |

实际calculateTaskPriority传入隔离dateViews后：score=33，风险仅“缺材料”；其中普通中优先级15，额外材料风险18。无日期本身未增加待确认分。这里没有实际运行Dashboard交互，但确实调用了它使用的排序函数。

这是本轮的分析裁决，不是独立人类标注研究，也不修改原RESULT。原Complete Case=false、Major Correction=true等精确诊断全部保持；Major标记不能冒充真人重大修改。**总体模型识别准确率本轮未测量。**

## 5. 为什么没有直接做实际Edge确认

当前serve-mainline-real-input-01.mjs:47固定编译seen_engineering_replay；:89仅生成旧人工seenWire。browser.tsx中的另一分支是实时模型client，不是历史A02读取入口。
不能把A02响应冒充人工seenWire，也不能重新发送同一请求。现有浏览器启动器不会将这份已付费原始响应交给原待处理handle。

因此本轮停止于“已有公共函数的只读内存回放 + 精确差异证据”，没有自行增加端点、替换浏览器执行器、改真实库、改模型来源标签或打开paid入口。

## 6. 唯一下一实施包（待批准，不自动实施）

在原42内一次批准NEXT_SCOPE.json所列**12路径**，同包完成两件相连的事：
1. 将现有A02响应安全接入真实App历史回放，让用户在原隔离库核对、确认、刷新找回；
2. 把材料必需性和准备状态分开。只有用户明确核验后才形成相应canonical状态；未核验不得默认为缺失，也不能默认为已具备。保存对象不自动翻译为必须提供。

12路径涵盖本机启动器、browser/runtime、材料状态/确认/显示/编辑及3测试，全部逐字SHA与职责见NEXT_SCOPE.json。
需要明确批准显式隔离材料核对增量；不改全局Schema或既有模型契约，不凭空发明材料状态。若现有MaterialStatus域无法承接，停止提出精确数据范围，不能拿preparing或missing冒充unknown。
已确认任务和原响应/首次建议不得重算覆盖；共享材料只影响真实关联项，独立兄弟仍能确认。
这是有证据的最小完整工作范围建议，不保证实施中绝无新缺口；范围外变更仍需申请。

可复制授权：

> 继续同一MAINLINE-REAL-INPUT-01，按replay-a02-20260907a/NEXT_SCOPE.json的12路径与限定职责，实施A02历史响应真实App回放及显式隔离材料核对增量，0次模型调用。先核最新审计Git/远端、42最终SHA、945保护、原账本5事件/5收据与日志前缀。不改Expected/candidate/scorer、旧raw/RESULT/STATE或原模型契约；不运行paid/recover/A03，不读.env/密钥。历史响应保持真实模型来源，另外明确本轮是回放。只用原6631与已核隔离测试库，A02 handle或来源不符即停，不清库/换库掩盖恢复。required、作为准备材料与当前准备状态必须分开，经用户主动核验后才形成合法canonical状态；未核验不推missing/ready，不把保存对象说成必须提供。保留原始/首次/编辑历史、独立兄弟及已确认内容；原默认不变。对照、定向修补、独立审查、适用工程、真实Edge逐键保存/确认/刷新/真实下载与独立读库在同包连续完成；不能以本轮25项内存检查代替浏览器。任何超出12路径、保护变化、重叠修改或需要全局Schema/repository范围即停止申请。成功精确业务Git提交推送；未通过只交审计保留现场，完成后停止。

## 7. 本轮交付与保护

仅新增本目录AUDIT.md、REPLAY.json、NEXT_SCOPE.json、CHECKS.json；更新短CURRENT_CONTEXT、OPTIMIZATION_LOG仅追加。所有42源码/测试逐字不变，945保护不变；A01永久未知预留及A02已消费grant不动。费用上限的新口头调整未在本轮修改账本代码；本轮0调用不受费用影响。

本轮只读诊断交付可完成，产品仍NOT_COMPLETE。按6文件精确清单提交推送审计，不提交42未完成实现。完整历史工程不机械重跑；文档/JSON/敏感模式扫描、差异和保护核验完成后才交付。具体Git号以最终远端回执为准。完成后停止。
