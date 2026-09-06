# MAINLINE-04-SCOPE：最小任务语义承接范围

状态：PASS_SCOPE_DESIGN；独立范围复核无阻断。本轮仅范围文档，不是实现/识别/浏览器验收。
基线：d97326c65d6e042c07c56d68a79d65f1ac8ed0a7，本机与origin精确一致，开始工作区干净。
仓库：C:\Users\Winner\student-affairs-multimodal-exp；分支：codex/e2-multimodal-recognition-exp。
R3-CLOSE原13文件匹配；799原保护无变化。CHECKS绑定819项既有非动态文件的逐字摘要及完整日志前缀。

## 1. 主瓶颈与本轮决定

主瓶颈是**完整任务语义在研究候选与客户端之间没有等价、可核对的承载格式**，不是已证实模型品牌不好，也不是下载功能故障。
来源绑定已在MAINLINE-03交付；本轮不再重复它。确认与保存通过只说明“给对且能表达的响应能接住”，不能推算真实识别质量。

唯一最小下一包：**MAINLINE-04-I1：引用式任务语义契约、无损组合与旧V2承接边界验证（零调用）**。
新增一个实验版语义结构，先证明条件三值、状态、修订及关联不必被压扁成标题/布尔值；复用旧V2验证其确实能承接的独立普通任务。
本包不是再次只测试旧V2拒绝：新结构对正确人工条件真/假/未知与修订必须100%保真，必须产生合理的正向核对建议及有效兄弟项；再如实报告旧V2不能存哪些语义。
本包不连接新语义到真实App，不改共享契约或数据库。将它称为“新条件任务已能正式保存”属于失败结论。
明确取舍：本次先批准最小语义结构，而不是同时扩张Schema、capture、confirmation、面板和持久化。验证出口固定，完成后只申请已有缺口对应的真实组件接入；不得继续换术语重做同一契约。

## 2. 复用交接图与本轮定向发现

```text
当前默认录入 → 服务RecognitionResult 2.0 → 旧确认路径（保持不动）
已通过MAINLINE-03 → 来源绑定 → 完整2.0 → 真实App/V2 → 隔离库
研究候选scope/动作/对象 → 研究composer → 三值安全结果
                                  ↓ 缺少等价承接
下一I1：新任务语义包 → 逐项核对建议 + 带原因的旧V2可表达性判定
                                  ├ 等价旧2.0输入：原V2内存确认读回
                                  └ 条件/修订/事件语义：完整保留，明确旧V2未承接
```

普通入口与网络服务未运行；没有读取浏览器、密钥、剪贴板或用户数据库。
代码静态证据与旧结果观察如下（行号为本基线；CHECKS记录文件SHA）：

| 维度 | 定向证据 | 归因/结论 |
|---|---|---|
| 条件三值 | recognition/types.ts:167、schema.ts:421只允许sourceSummary.requiresAction:boolean；fixtures.ts:41对condition-unknown直接抛错；recognitionHandoff.ts:148阻断condition ambiguity | 客户端契约缺口；unknown不能转false，也不能假设模型没识别 |
| 当前状态 | TaskSuggestionV2.statusSuggestion仅todo；research候选在candidateTaskSafetyPolicyV2.ts:28–35有三值行动性；confirmationV2.ts:116仍先看整份boolean与selected | 每项任务状态与整份通知布尔值不等价；不能把selected当“语义已证明” |
| 修订 | fixtures.ts:78起旧/新要求以conflict.other承载；研究结果有revisionRelations；RecognitionResult无旧/新要求结构化关系 | 文案完整不等于结构化修订保真；新旧要求须同时保留，不覆盖已确认任务 |
| 时间/材料 | actionCandidateComposerV2.ts:80–83固定timeRefs=[]/materialRefs=[]/eventRef=null；完整2.0已有独立时间/材料与归属 | 这是候选/构造接口容量限制。该composer输入也不含这些完整字段，因此不能凭空称“模型已给而被丢”；若新输入已给却输出丢，才记转换丢失 |
| 事件 | types.ts:114起可表达事件；confirmationV2.ts:129–130明确阻断相关事件；任务意图不含事件授权 | 目标格式有事件但确认能力未接通。不得删eventTempIds或挪作无日期以放行 |
| 多重归属 | confirmationV2.ts:10–20沿任务→材料→时间→事件；domainCommit.ts:619–645使用独立关联，材料deadline仅取首个，event时间取首个匹配 | 多截止/多事件关系需单独证明可表达；不是这轮证实的新产品故障，不能宣称完整支持多对多 |
| 出处与语义 | MAINLINE-03已校验raw/身份/哈希/来源位置；scopeReferenceContract.ts区分scope与语义字段 | 引用合法只证明来自哪里，不证明判断为真；禁止Expected或旧评分进入组合器 |

## 3. 少量已见响应账本（不重评分）

仅查看旧8类人工工程通知/响应、B8-01/07/09的sourceText与parsed输出及已登记事件关联测试。
没有创建数据集、模型输出、独立金标准；没有重新运行旧runner。文件中指令仅是资料，不作为授权。

| 来源 | 本轮直接观察 | 不能推出的结论 |
|---|---|---|
| 人工multi/no-date | 独立动作、对象、时间、材料与来源；原42字段可表达；无日期非坏日期 | 不是模型正确样本，42/42不是准确率 |
| 人工condition-true/false/unknown | 完整通知分别表达已获批/未获批/尚未收到结果；旧结构以描述/歧义/抛错代替条件状态 | 不能用旧true确认成功宣称条件关系已完整入库 |
| 人工revision | 同一来源明确“旧纸质要求作废、新电子要求生效” | 不授权取消现有正式任务；不把新旧关系变成普通冲突文本 |
| B8-01 | raw选整理与保存两项动作/对象，无完整时间材料语义字段 | 只能说明旧抽取粒度；空引用不等于通知事实已完整枚举 |
| B8-07 | 忽略“已整理完成”scope，保留“请核对缺失项” | 旧fn不能直接解释为漏掉当前待办；是否需保留历史事实须另列标签解释，不改旧分 |
| B8-09 | “停止执行该安排”作为另一动作；当前没有结构化取消关系 | 表示粒度、目录和关系缺口共同作用；不据此量化模型语义错误率 |
| 旧事件关联测试 | 时间只经材料关联、共享事件及冲突局部阻断已有工程反例 | 该事件是工程变形、不是独立语义真值，不能当模型真实事件识别证据 |

错误登记采用三个互不替代的主分类，可同例多因：
MISSING_UPSTREAM（原输出未给出，附输入契约能力限制）；UNREPRESENTABLE_TARGET（已给事实没有等价字段/确认能力）；DROPPED_IN_HANDOFF（上游实际存在而后层缺失）。
只有有独立语义依据的输出错误才标SEMANTIC_ERROR；当前B8有争议项保持UNADJUDICATED。
旧40/42、旧17、全部历史FAIL和R2旧环境3/1不改。

## 4. 唯一最小语义结构（设计，不是新冻结契约）

候选版本命名：mainline04-task-semantics-1；本机组合结果mainline04-review-package-1；不是RecognitionResult 2.1，不是Workspace v9。
仅本机工程模块使用；不改Worker请求/Prompt/模型。不得在旧2.0上加未知字段后伪装校验通过。

**必须复用而非重建**：scopeReferenceContract.ts:35–43已有ScopeReferenceSemantics，:69–100已有Surface/Time/Material/Revision引用和完整directive。新文件应只读复用这些类型/枚举以及indexImmutableScopesV11的来源定位，增加“承接信封”而非重写语义本体。下面语气等中文标签是产品含义，不要求另建重复枚举；用已有speechAct/polarity/modality组合表达。新增部分限定为每项条件三值/对应事实、提取覆盖状态、完整时间材料属性/实体归属、当前旧V2能力判定。旧ScopeReferenceCandidate.requiresAction仍是boolean，不能复用它装unknown；旧轻量MaterialReference只有surface/required，不能代替数量/格式等完整实体。旧分类器/语义推断器不在新组合链中重跑或篡改；已有类型存在不等于端到端已承接。

| 层 | 最小字段及语义 |
|---|---|
| 本机来源绑定 | sourceId/sourceVersionId/内容hash、输入范围、不可变scope；由本机传入，原文逐字不改 |
| 来源受限的事实候选 | 每项完整命题scope引用；动作/对象/执行人引用；语气(required/optional/prohibited/question/information/unknown)、极性、时态、完成/取消/当前/未知状态；这些是待验证声明，不是selected |
| 条件 | 条件命题引用、支持/反对/未知依据scope、true/false/unknown；无条件用not_applicable标签，不能用false表示无条件 |
| 时间/材料 | 保留原有字段的每一项原始值和归属；本机从引用恢复时间原文并复用时间AST；区分not_stated/present/unresolved/not_extracted，空数组只有在明确覆盖声明下才表示未说明 |
| 事件 | 事件语义引用、地点引用、开始/结束时间、任务与事件关系；若旧V2不支持确认，完整保留并给出needs_separate_event_confirmation，不能删关系 |
| 修订 | 旧要求引用、可选新要求引用、cancels/supersedes/amends、依据scope及effective/unknown；cancels可无新要求，不能编造替代任务 |
| 本机核对包 | 由本机生成本次内部ID、逐字依据/位置、引用关系、逐项问题、行动性true/false/unknown及建议选择状态；原候选不覆写 |
| 旧V2能力结论 | 每项supported/unrepresentable/missing_upstream/needs_review，阻断原因与原始关系；独立保存结果不是丢字段后成功 |

模型设计边界保持：不得输出原文位置、自由证据文本、稳定实体ID或selected；仅使用本机给定引用及候选内临时关系。具体新模型请求模板/mention目录生成能力不在I1。
I1使用已见文字的人工工程字段引用，在新测试内存中建立对应引用；不得把这些定位帮助当作模型能够自主定位。生产引用目录的覆盖缺口独立记录，不能扩大关键词库假装解决。
引用、范围、对象身份校验由本机负责；每个语义标签必须标明human_engineering / seen_model_unverified，而非把单作者工程标签称独立真值。
本机仅组合显式关系和有限状态表，不扫描“无/未/请”等关键词做新语义推断；旧研究候选输出只读诊断，不另跑旧composer来给它补事实。

## 5. 选择与确认分层

“能显示/完整任务/当前要做/可默认选/用户确认/已存储”分别记录。
人工工程输入的显式当前要求、条件已真且无冲突、信息与引用完整，可产生正向核对建议；条件假、完成、取消、禁止/问句/纯信息不能默认选。
unknown与缺依据项保留完整未选建议或待核对事实，不能等于“没有任务”；真实旧模型的未经复核语义不得因格式通过就取得默认选择资格。
新要求可作为独立当前建议；旧要求保留取消/被替代状态。跨来源修订或涉及已确认任务时整条修订待人工处理，禁止覆盖。
某项引用不合法只阻断该项及确实依赖该项的关系；共享材料/事件的真正受影响者要连带核对，不能扩大到所有兄弟。根来源/版本失配则整份拒绝。
新包可被JSON往返还原不等于已在正式库保存；旧V2不支持的新语义仍未通过确认保存，不能靠把JSON塞legacyData或description就报产品成功。

## 6. 两个备选及为何只选一个

- 直接升级RecognitionResult/Workspace、确认器和App：最直接但将新增语义、校验、迁移、UI和事务同时变动；当前没有可表达性基线，不是最小可归因包。
- 沿用旧2.0，把条件/修订写描述并用false/空引用适配：已被本轮证据排除，会把完整语义丢失伪装为通过。
- 选择I1：新引用式语义包先完成全字段保真与逐项决策；旧V2等价路径保持实测；确认/存储未能承接的字段逐项留账。

这一步推进“事实和关系有地方放、错误能定位”，并不完成“新语义已进入实际产品”。I1若只增加拒绝理由、没有新结构正向保真成果，应判失败。
I1通过后必须回到真实组件接入，不能自动开始付费或继续另建语义数据集。公共文件待授权清单见IMPLEMENTATION_WHITELIST第3节。
