# 已有录制的事实诊断与条件性禁止收口

## 当前增量：材料渠道与办结回执分开（2026-10-04）

本轮只选择两个根因：独立事件/时间完整性做现有 C19 不同表达回归；材料渠道/完成回执修公共首次显示。没有生成输入变化：C19 的 nullable submissionChannel 已能表达未知，不建立新候选、不冻结新付费身份。

- `material-channel-role-grounding-1.0.0` 从材料及真实 owner 的同来源证据检查渠道角色。明确同对象的提交目的地正常保留；仅办结回执中的平台成为尚未确认的渠道，不冒充原文明示；无依据/错对象只阻断关联任务。原值、引用、处置状态写入草稿审计。
- 普通 `App.handleIntake` 接入公共首次建议组装，RecognitionRun 保留程序输入，Draft 分别保存首次显示、原摘要审计和渠道审计。正式保存复用 ReviewSession、DomainCommitPlan 和 Repository，无 v8 迁移或平行存储链。
- `OrdinarySourceFacts` 展示材料渠道与完成标准，回执争议不追加整页人工复核门槛。S05 不要求用户清空“平台”才能保存；后验诊断仍 UNKNOWN，未知字段转换不会获得正确分。
- 录制入口调用现成 scoped host 的只读续跑审计；原组件校验在既有 C19 冻结工作树运行，当前包的 Manifest/身份/7产物仍逐字核对。旧验证器/断言未修改，活动 App 改动不能回写旧冻结快照。只读包装不导出 prepare/dispatch，append/transport/gitCheck 均机械拒绝。
- 14 个新增行为测试含不同时间表达的真实 Schema、公用转换、字段语义反例及正式事务/独立读回；旧契约和条件性禁止回归一并通过（38）。只读适配器正反例 2 个。原 v11 2/6、1/6 与后验 4+2、5+1 保留。

最终普通浏览器、完整证据与测试状态在 RESULTS、BROWSER_EVIDENCE、VALIDATION 的当前入口记录；过程入口不作为最终推荐。


2026-10-04后续本地包。模型/grant/reserve/settle/账本写入均0。原C17/C19候选、v11、参照、12身份和raw不改。本次只有两类根因，没有新Prompt或Candidate20。

| 原文→原答→发生层 | 新版本和实际代码路径 | 首次展示、正式保存与反例 |
|---|---|---|
| S02两事件四时间；C19原答含“11:40结束”、未公布恢复；v11部分截取差异判错。S05材料命名、办结标点另有表示差异 | `src/recognition/recordedFactDiagnostic.ts` / recorded-source-fact-diagnostic-1.0.0；`scripts/diagnose-candidate19-facts.mjs` | 新的事后provisional最小义务参照，按对象、时间值/类型/精度、实体端点、依据和信息覆盖检查；允许同对象无损截取、明确定义别名/命名同义、顺序变化。错日期/类型/对象/依据/关系/漏项仍FACT_ERROR，争议UNKNOWN。原v11不修改，不用于决定采用候选。 |
| S04原文“仅限获准社团；你的社团尚未获准，不能提交展位申请”，两臂原答已有negative/false及真实资格依据，旧桥仍多显示一张申请核对卡 | `src/recognition/conditionalNonActionProduct.ts` / source-grounded-conditional-nonaction-1.0.0 → sourceContractV4 → firstSuggestionD26 → 普通App | 同对象资格规则、当前未获准事实、紧邻禁止动作、否定/当前状态一致、无关系风险才转信息。原任务和全部依据留审计，inferredFacts=0。首屏只剩“保存活动联系编号”，一次确认；未知资格、前置等待、提醒/双重否定/错对象/跨scope/修订或依赖端点不套此规则。 |

公共转换额外检查任务声明与实际时间/材料/事件owner及反向引用、父项和依赖是否一致。只标错，不猜接；冲突、quality标记和选中资格同步。错误声明的任务受阻，独立正确事件仍可保存，不能把错误引用指向的正确事件一起封死。原声明完整保存在sidecar，真实Schema反例通过普通DomainCommitPlan验证“主动选择坏任务仍被拒绝、只选独立事件能保存”。

`src/experiments/candidate19Recorded/browser.tsx`改用`decodeCurrentSourceRecording`，仍复用普通App/Capture/ReviewSession/DomainCommitPlan/Repository；没有另一套保存链。原HTTP回答、originalSemantic、冻结转换、supportAccountingAudit、productDisposition、firstSuggestionDisplayed和用户修改分别持久化。source referenceTime及可逆scope映射保留，不按回放当天重解释来源时间。

`conditionalNonActionProduct.test.ts`和`recordedFactDiagnostic.test.ts`共11项定向场景包含全部12实际回答、不同对象/日期/名称/规则写法、最小语义反例、完整/部分参照、真实捕获/公共转换/正式提交/独立读回及幂等。一个独立工程视角发现的错挂时间、父项、modality、动作依据漏检均已补反例和检查；不是独立人工真值。没有修改旧断言。

最新运行入口6825，source bb002e92f3e1。实际六来源首屏与保存、部分确认、正式事务失败手动恢复、提交后只重读、刷新在该构建完成，详见BROWSER_EVIDENCE。C17 S01真漏事件/时间、S02错时间类型及漏结束仍保留；S05 C19“平台”是否为提交渠道保持争议，不自动给满分。新程序不能证明新版模型生成已改善。

## 之前完整比较交付的实现（历史保留）

2026-10-04。C17/C19原12身份全部确定结算，旧冻结组件、请求、参照及v11原成绩保持。这里交付的是后验公共产品转换，未修改模型输入或默认候选。

| 根因及用户场景 | 实际路径 | 当前行为和限制 |
|---|---|---|
| S01无需/禁止动作投影为待办 | recognition/directiveDispositionProduct.ts，1.0.1 | 同片段有直接否定、无引用且状态一致才转信息；提醒/条件/问句/关联端点仍受阻，缺事件不补猜 |
| S03资格说明引用已有任务，纯信息契约整份拒绝 | recognition/sourceAccountingSupportProduct.ts，1.0.0 → sourceContractV4 → 普通App | 只转换已有主动作、同对象资格未知/未公布依据的辅助引用；两项填写/递交显示，前置完成仍unknown，领取资格项未选 |
| S05材料和办结标准辅助引用导致整份拒绝 | 同上MATERIAL_SPECIFICATION/COMPLETION_STANDARD | 主实体、所属关系、同scope及原文值成立才转换；已有PDF/文件名、09:25截止、14:20—15:35活动直接显示；错引用/错标准/图冲突仍受阻 |

保留originalWire、每条scope/entity/reason、projectedAccounting、inferredFacts=0；原响应、冻结编译、后验转换、用户修改分别保存。单向权威声明生成反向索引属原契约行为，不把合法反向生成混作人工纠正。

src/experiments/candidate19Recorded/browser.tsx使用decodeProductSourceRecording；复用普通App/Capture/ReviewSession/DomainCommitPlan/Repository和独立reader。loader核确定settle、HTTP和source/request/identity/response SHA，提供12份原录制；仅回环/新库/实时派发关闭。referenceTime保留并使用可逆scope重绑，不用回放当天重解释原时间。D27最小安排沿用，个人计划与原deadline分开。

scripts/diagnose-candidate19-product.mjs对全部12份旧raw双臂同标准诊断。原模型/原冻结成绩与新产品接收、同v11后验风险分列；6/6可解析不是6/6整份正确。S02/S05的rawText边界及同日结束表示争议保留，v11原分数不改。不把新转换称新模型提高或独立人工真值。

定向29项通过：独立写法/顺序不变，最小错引用、错对象、无完成证据、错图反例。真实Schema→adapter→普通draft→DomainCommitPlan→另一Repository：S05为Task1/Project0/Event1/TimePoint3/Material1，精确值和幂等验证；S03仅保存两任务，资格项仍待确认且无已完成事实。最终浏览器证据在BROWSER_EVIDENCE另记，不用单测替代点击。

剩余：S04不适用任务仍未选且受阻，避免误执行但增加核对负担；不能自动把所有false删成正确。C17遗漏S01事件未自动发现。来源完整覆盖、自由描述及材料表述等价需下一步定向诊断；无真实裁决不报完整产品正确率。真人四指标NOT_OBSERVABLE。本包无新Prompt/新候选/新身份，原批后不再模型调用。
