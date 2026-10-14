# MAINLINE-03-SCOPE：识别输出到确认 V2 的交接审计

日期：2026-09-06。状态：范围设计，非实现验收；最终复核见 REVIEW.md / CHECKS.json。
唯一仓库 C:\Users\Winner\student-affairs-multimodal-exp；分支 codex/e2-multimodal-recognition-exp。
起始本机/远端 235e3650ee776277b5bdc4c6c371a9356c833a1f，干净；R1 实现 19/19 哈希匹配。
BASELINE.json 绑定 747 个既有只读文件和追加日志原字节前缀。没有回切旧提交。

## 1. 结论与唯一主因

客户端已经能承接“人工给对且契约可表达的建议”，但真实识别输出与它尚未完成来源绑定和表达能力交接。
本轮找到的主要问题不是模型品牌，而是：不同层的“结果”不是同一种信息，不能直接接线或凭空补齐。

唯一下一实施包：**MAINLINE-03-I1，零调用的来源绑定与可表达性接入验证**。
先复用真实 App、MAINLINE-02 runtime、冻结确认 V2 和新空测试库，给服务形状的完整响应补本机来源引用；候选简化结果只做显式缺口诊断，不伪造成完整结果。
本包之后仍须根据缺口申请完整语义契约/连接权限；不能直接越过 G5 调图片。

模型识别准确率：**本轮未测量**。本轮未运行产品、模型、OCR或历史runner，也没有重跑R1工程/浏览器检查。
旧 R1 的 99/99、998通过/1跳过、42/42 是已交付历史工程证据，非本轮新增成绩。旧40/42、旧17测试及所有历史FAIL保持。

## 2. 实际链路（代码静态追踪，不代表线上已验收）

```text
普通文字录入（当前默认）
 App.handleIntakeInput
   → 本机 buildLocalRecognition
   → beginCapture：Source → SourceVersion → RecognitionRun → ExtractionDraft
   → connected 时 ProxyDeepSeekExtractionService.recognize
      → /api/deepseek/extract → Worker解析/时间AST/规范化 → RecognitionResult 2.0
      （未连接则本机规则；本轮没有触发这些分支）
   → capture.recognize保存整个result
   → workspaceV8ToLegacyView / recognitionToLegacySuggestions（显示兼容投影）
   → 旧面板操作 + selectionFromDraftItems → DomainCommitPlan → canonical事务

MAINLINE-02隔离入口（已验收工程链）
 browser.tsx：旧通知匹配 → artificialResponse【人工替身】
   → 真实App的runtime.capture → 同一真实capture/canonical
   → reviewAdapter → 冻结confirmationV2 → DraftReviewPanel
   → 真实选择/ID/版本 + 保存过的编辑 → confirmV2 → DomainCommitPlan
   → 新测试库 → 刷新/任务中心/无日期列表/JSON实际文件

冻结研究候选（尚未接上述V2）
 B8 model-anchor-selection / 009+ action-candidate-classification
   → scope/catalog/composer → 010 candidate-task-safety-result-3.0.0
   → 研究任务/语义/条件/修订结果【不是RecognitionResult 2.0】
   → [完整字段适配与表达检查缺口] → V2
```

真实录入、来源先存、事务、面板与下游组件已存在；隔离识别仍是人工回调。默认入口仍走旧确认，不因本次审计而切换。
普通入口直接调用 recognize 而非 extract；extract 返回的 ParsedSuggestion[] 只是另一兼容入口，不能误认为正式事实存储。
默认确认虽使用真实 DomainCommitPlan，但会先保存旧工作区视图并从旧显示项构造 selection；这与隔离 V2 的实际编辑意图不是同一条确认链。

## 3. 字段/引用交接证据

| 信息 | 当前来源及交接 | 已知障碍/允许结论 |
| --- | --- | --- |
| 来源正文/版本 | App.tsx:574先beginCapture；capture.ts:402起整份result保存；草稿经recognitionRunId→run.sourceVersionId→version.sourceId | 不能假设Draft直接持有sourceId。隔离引用必须绑定本次CaptureHandle，不复用历史source ID |
| 来源依据 | cloudflare/recognition.mjs:137–141规范化为pending-source，不保留textStart/textEnd；客户端parse不补位置 | confirmationV2.ts:93要求真实sourceId与逐字位置。当前服务输出直接注入V2将因EVIDENCE_INVALID阻断；这是静态确定性结论，非本轮运行成绩 |
| 动作/对象 | RecognitionResult包含actionVerb/actionObject，V2检查非空，canonical从完整result取值 | 出处合法不证明语义正确；不能凭字符串匹配把模型误判变正确 |
| 时间 | Worker唯一AST产生raw/type/normalized/timezone/precision及task/material引用；完整result保留 | compatibility视图只取第一时间供卡片显示；V2按完整关联检查。不能再从卡片deadline反造正式时间 |
| 材料 | 独立materials和双向task引用、格式/数量/渠道 | 旧投影只有名称；从该投影恢复材料会丢关系和属性。V2直接读取canonical草稿，禁止改走投影回写 |
| 条件/行动状态 | 010有条件真/假/未知及三值requiresAction；RecognitionResult仅整份boolean | 未知不能映射false；description/conflict文案不等价于结构化条件，必须记表达缺口 |
| 修订 | 010有本机revisionRelations及supersedes引用；RecognitionResult无等价结构化修订图 | 不得把修订塞进description后声称完整保存，也不能覆盖已确认旧要求 |
| 事件/地点 | RecognitionResult可表达事件/时间/地点 | 冻结V2任务意图不含事件授权；相关事件会EVENT_REQUIRES_SEPARATE_CONFIRMATION阻断。当前范围不新增事件确认 |
| 默认选择 | Worker规范化计算selected；V2以explicit及独立检查形成默认选，确认仍需用户动作 | 原始模型JSON与服务规范化输出必须分层；不能将原始模型selected当权威，不能借接线新增语义放行 |
| 编辑/确认 | reviewAdapter读取原result及编辑history；confirmV2只取id/version及保存的override | R2支持的deadline编辑范围不扩大；计划开始/事件编辑、正式任务执行仍未授权 |

另有两个可观察边界：Proxy发送最多24,000字，而来源可能存完整正文；普通App已有质量提示，这不是整份处理成功。runtime现把provider/model/提示固定为人工；复用旧模型结果时必须新增显式回放来源标记，不能继续冒称人工或新联网预测。

## 4. 冻结候选为什么不能强转

- modelAnchorSelectionContract.ts:9–24只含scope、动作、对象与ignoredScopeIds，没有完整时间/材料/条件/修订字段。
- actionCandidateClassificationContract.ts:9–25进一步只让模型选择candidateId/verdict/objectCandidateId。
- actionCandidateComposerV2.ts:70–89构造directive时timeRefs=[]、materialRefs=[]、eventRef/locationRef=null；其覆盖complete仅指候选范围，不是通知所有事实完整。
- candidateTaskSafetyPolicyV2.ts:28–40的010产物含三值行动性/完整命题审定；其继承任务仍有timeRefs等位置，但不能把被上游置空的引用当原文无这些事实。
- 010 frozen manifest仍保持原字节。将上述结果强制填满RecognitionResult，必然遇到无法表达或需要新语义决策；本次不批准这种转换。

因此最小包不创建“丢掉所有时间材料、只剩标题”的成功路径。候选输入保存原始回放凭据并明确 CONTRACT_UNREPRESENTABLE；这属于诊断成功，不计正确确认成功。正向工程路径仍须真正确认，禁止全拒绝过门。

## 5. 已见材料的三类诊断（未重评分）

只读取旧MAINLINE-01人工工程响应、B8原始记录/既有score的01/07/09三例，以及010已见B9报告摘要。未导入Expected到任何决策链，未运行旧runner。

| 例子/类型 | 实际观察 | 归因边界 |
| --- | --- | --- |
| 旧multi/no-date人工正确响应 | 原42字段口径，完整实体/本机来源位置；R1曾42/42 | 正确可表达输入的工程对照，不是模型正确样本或独立语义真值 |
| B8-01已见模型结果 | 原文要求整理清点表并保存副本，raw分别选两项；旧score记tp2/fp0/fn0 | 可追溯动作/对象选择，但不能代表时间材料识别率，不能据此宣告全契约可接V2 |
| B8-07已见模型结果 | 原文先说目录已完成，再要求核对；raw忽略已完成句，旧score仍记fn1 | 存在任务口径/状态口径问题，不能仅凭fn判模型漏掉当前待办；保持旧分数，另列标签解释待独立裁决 |
| B8-09已见失败结果 | raw把“停止执行该安排”放入动作；旧composer记ACTION_HEAD_NOT_CONTROLLED，最终invalid，关系未形成 | 模型表示方式与受控目录/修订表达共同作用，不能把整体FAIL全算模型语义错误，也不能加关键词救旧分 |
| 010已见B9诊断 | 旧报告diagnosticGate=PASS，历史B9 gate=FAIL；semanticTruth=NOT_AVAILABLE | 说明工程诊断与模型正确率是两件事；历史状态不改 |

三分法的记录要求：输出本身违背来源→语义错误；正确事实没有合法字段→表达缺口；上游已有的合法字段/引用在下一层丢掉→交接丢失。
单例可有多因，分别记路径和证据。缺独立语义标签时写待裁决，不把“校验通过”当语义为真。此次能够确定来源交接和表达缺口，不能给模型新的整体准确率。

## 6. 唯一下一包与明确非目标

精确文件/职责见 IMPLEMENTATION_WHITELIST.md，验收见 VALIDATION_DESIGN.md，可复制授权见 NEXT_PROMPT.md。
下一包拟修改2个已有文件、新增6个隔离源码/测试及2脚本；尚未获授权，不实施。
不会改App默认路径、旧人工入口默认表现、共享Schema/仓储/确认策略或冻结候选。
输入预加载来自旧工程响应与3个已见B8记录；只有服务形状完整响应走V2，候选未达表达条件则留证阻断。
本次未找到并验证可直接用于正向接入的真实完整服务响应样本；正向先用明确工程响应经过同样的服务形状处理，不能冒充历史真实完整模型输出。

需要后续单独批准：完整条件/修订语义契约与适配；confirmationV2事件/三值交互能力；任何Schema/仓储/迁移变更；真实服务联网及模型、真实材料/真人、稳定接入、正式任务编辑/执行、ICS/真实提醒、部署/商业验收。
付费设计只列待授权条件，不复用过去10元许可。G5仍未证明，不启动RCO-6。

## 7. 本轮检查与交付边界

文档协作技能用于明确输入/决策/白名单和无上下文读者复核；代码审查技能优先追踪主调用链，不修饰命名和样式；Git技能用于验证后精确提交推送。
仅增加本目录文档、短交接及追加日志。CHECKS记录本轮新检查，REVIEW记录独立复核；不冒用R1旧工程数字。
最终提交SHA以Git回执为准，提交内不伪造自引用SHA。完成后停止。
