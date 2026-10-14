# 最多三类证据根因及处理

角色：POST_COMPARISON_DIAGNOSTIC；不是新模型评分。固定16分母，[原回答/冻结转换/首次展示/判错](COMPARISON_REPORT.json)、[事后诊断](PRODUCT_REPLAY_DIAGNOSTIC.json)及[BROWSER](BROWSER_EVIDENCE.md)分别保留。

## 1. 生成/转换契约不一致，不能靠Prompt提醒堆叠解决

原文S01明确“图书借阅门户将在周三晚停机”，无用户动作。C17原events/timePoints空，是真遗漏；C18原已有event-0001、tp-0001/rawText周三晚，scopeAccounting kind=event同时引用两者。原convertCandidate18Envelope只接受event主实体，引发SOURCE_FACTS_ACCOUNTING_ENTITY_MISSING，整份拒绝。S02同机制。错误发生在表示和程序转换，不能全部称模型没理解。

新recordedProjectionD26只将同scope且已有事实的主/附属引用投影为typed-primary视图，原事实、附属证据和转换审计保留；不新增event/time。S01/S02事后均可显示0Task/1Event/1Time并保存，时间null/vague。浏览器无需像旧S09一样人工补事件/样本标签。**只能报告旧raw经过新转换可用，不改原0/8。** 不同来源，不能据此给旧S09步骤或省时减少百分比。

S03/S04/S07/S08原coverage的time/material/event都可能null；C18wire允许null表示已有实体，原converter要求实体存在。模型在无时间/事件时也给null，实际REAL_INPUT_FACT_COVERAGE_MISSING_FACT。S05/S06accounting缺主实体，事后投影也拒。这六份保留raw/Source/失败，不将null猜not_stated、不补primary、不删样本。

下一输入机制假设：覆盖缺省状态须显式可表达，主实体和附属引用须分开清楚且Schema/模型输出/转换一致；正反例包含缺事实、无实体、未知、不相关实体、跨来源。先版本化本地契约及产品首屏，再考虑新冻结输出比较。不能仅改scorer让这六份满分，不默认Candidate19或新16身份。

## 2. 原推理来源、时钟和风险进入正式确认链

旧scope身份绑定D26-Sxx，普通App先持久化新的SourceVersion，直接复用scope-ID会断依据。新rebindRecordedScopes逐条核相同原文及边界，scope映射可逆；实体和值不变。录制原referenceTime=2026-09-22T09:00:00+08:00，回放10月3日不应把“下周二”重新解释为10月6日。App注入context，保留原9月29日候选且标模糊/待核对；未将其正式确认成可靠截止。

S03 C17把“必填栏均已填写后”当condition=true却factScopeIds空，原文没有“已经填写”的事实；C18 prerequisiteStates.completion=unknown方向更合理但整份拒绝。S05 C17适用条件unknown本身正确；把暂定办理写task_deadline且task正向time IDs空、time反向task IDs存在，存在类型/图风险。新程序不替模型猜资格、完成或引用。普通页资格待核对及sidecar gaps阻断相关项，无关已保存S07事实保持。

S07原精确截止、PDF格式/命名可回看并正式保存；整份信息覆盖争议UNKNOWN仍保留。S08原通知同时“上传确认单”“平台显示承诺函已收妥”，自动材料判错与原文对象歧义需分开；模型漏收妥标准可确认，不借此全部归为参照争议。

下一机制应把资格、前置完成、可开始分别编码；时间值/类型/关系由明确事实约束，不用全部unknown或转人工规避任务。原D27安排仅使用已确认canonical，未知行程不编造日历。

## 3. 无效来源不能使下一次录制变成本地fallback

实际r5中C18 S03拒绝令App smartExtractionStatus=unavailable，下一C17 S05被本地规则处理，候选/首次展示归属错误。原raw仍保存，但后续的错误fallback不能冒充C17效果。App现在将注入provider的来源拒绝与全局服务状态分开，录制路径继续走同provider。

最终r6实际S03失败保留Source/raw；下一S05明确显示Candidate17固定录制及原时钟，资格受阻。S07正式失败保留用户20分钟估计，关闭恢复后手动重试只一个Task；S02提交后读回失败保存commit，按钮只重读，事件不重复。edit/checkpoint/commit/readback串联，失败/缺失不消失。默认生产候选及实时请求没有切换。

下一决策：继续当前输出契约和首屏机制，不另开确认底座、全仓审计、全局计划器或真人招募主阶段。只有模型输入变化且必须验证首答效果才申请另批许可；这批US$5.30许可已用尽，禁止再次发送。
