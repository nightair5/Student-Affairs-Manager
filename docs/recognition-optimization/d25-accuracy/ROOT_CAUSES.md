# D25有限根因与代码路径

只复核三个目标及材料/修订的相关回归。原D17录制、v7和原决定未修改；新参照和v9在新模型输出前冻结。完整原文、原答、raw/response SHA及逐条风险在[ROOT_CAUSE_EVIDENCE.json](ROOT_CAUSE_EVIDENCE.json)。

## S09：不是没有任务就没有事实

D17 ordinal18，C17-D16-S09。原文是校车预约平台周三晚停机，明确不要求删除、提交说明或发消息。正确主事实是0当前任务，加独立停机事件和模糊开始时间。原答tasks/events/timePoints全部为空，把业务片段放入informationScopeIds；公共adapter只能保留这些数组，不能凭空提取事件。新诊断检出INDEPENDENT_INFORMATION_EVENT_OR_TIME_MISSING。这是生成层真实漏提，不是标题截取或scope差异。

修改`src/experiments/realInput01/candidate18.ts`与`sourceFactsV3.ts`：用`real-input-source-facts-3`逐片段核账，事件是独立生成类型；信息分类不能替代已陈述的事件/时间。装配器验证引用和类型，不阅读原文猜出漏失事实。未决、空答案、全部信息可以保留原始输出，但若实际缺事件会被参照判错，不计首次正确。

已知开发样本标签移到来源元数据，生成请求正文不夹测试标签。旧来源的标签及raw仍原样保留，不按任意方括号自动删除正文，也没有把所有未覆盖片段自动标成信息。

浏览器D25-S01构造正例经过已有正式链：0 Task、0 Project、1 Event、1 TimePoint；rawText=周三晚、normalizedValue=null、precision=vague、needsConfirmation=true。它证明产品能保存这类事实，不证明C18模型已经生成过。

## S06：资格、前一步和可开始是三件事

D17 ordinal11，C17-D16-S06。原文“先填写…必填栏均已填写后，再提交”是依赖顺序，未陈述目前已填写。原答提交任务condition=true、factScopeIds=[]，同时又依赖填写任务。公共adapter原样保留；新诊断TASK_FIELD_WRONG/UNSUPPORTED_CONDITION_TRUTH。原页面容易显示“条件已满足”，但来源没有这项事实。

C18把适用资格与`prerequisites`的完成事实分开；只有当前、肯定、匹配动作对象且不处于“如果/完成后”等条件范围的证据才能支持true。否定与不同对象的已完成不能借用。任务本身仍是当前待办；确认保存不等于前置已完成。`sourceFactsV3.ts`生成依赖边和一致反向视图；`firstSuggestionGuard.ts`只检查并阻断无据true/false与缺端点，原答不改。已有task-center readiness依据真实依赖任务状态计算等待。

浏览器D25-S03填写/提交两项共同确认：两项todo，提交项在“受阻与稍后”，前置未完成。旧S06仍显示CONDITION_TRUTH_WITHOUT_FACT，未强行保存。肯定/否定、对象替换、同义与顺序反例通过实际Schema、adapter、v9和正式确认链。

此类确定检查有有限语言覆盖，不是独立语义裁决模型；真实复杂完成表述仍可能待核对。不会靠全部unknown制造通过，也不将unknown改为false删除。

## S05：关联只有一个写入来源

D17 ordinal10，C17-D16-S05。原答time-0001.relatedTaskTempIds包含task-0001，而task.detail.timePointTempIds为空；time coverage又写unresolved。这是确定的图冲突，和资格unknown、材料视图或rawText边界争议分开。公共adapter没有安全依据选一边；新诊断保留TIME_GRAPH_CONFLICT，页面显示TIME_EDGE_DISAGREEMENT并阻断关联事项。

C18只输出一个权威显式关联集合，装配器验证目标存在、关系方向和循环，再生成反向索引，记录`source-facts-assembly-3.0.0`转换且inferredFacts=0。它不从旧双向冲突答案猜哪边对。依赖和修订仍引用真实任务实体，不能引用scope ID；取消/替代旧端点非可执行。材料、格式、命名和任务对象继续分开，普通控制保留PDF及命名要求。

浏览器D25-S05任务T1与时间PT1_0双向一致，资格unknown仍保留needs_review，不当作可执行保存。精确截止控制经正式事务读回正确关联与2026-10-19T16:30（Asia/Shanghai）；坏修订只阻断关联项，预约线上时段可单独保存。

剩余公共时间表示边界：既有adapter对“暂定下周二下午办理”会给date_only的日期值并保留原文，未创建具体下午时刻；候选时间wire不自行决定normalizedValue。D25没有重写整个时间解析器，不能声称暂定/相对日期的所有不确定性已裁决。此来源资格本身未知，当前页面留草稿。涉及这种精度/生效语义的结论需单列；本批只优先检验图一致性，不能用工程正例掩盖时间契约争议。

## 共用评分与产品安全

`scripts/d25-scoring.mjs`为v9，旧v7/v8保持。新的确定校准包括材料直接证据支持、unresolved/not_extracted覆盖不能整份通过；风险按规范化义务身份比较，不能总FN数相同就忽略新漏对象，也不能以Expected ID集合判断合法表示退步。信息/事件/时间、引用图、条件与关键字段分别报告。

标题、自由描述、教学例泄漏不由上述结构化检查自动裁决，保持NOT_ADJUDICATED。开发参考是single-author/model-assisted/provisional；相对时间诊断克隆采用公共adapter校准，本身不是独立真值。没有为了某一臂答案设置特例，没有改历史Expected。

运行路径：来源持久化→RecognitionRun/Draft→C18原始facts→具名程序转换→公共wire/time adapter→现有ReviewSession→相关事实检查→DomainCommitPlan原子事务→独立Repository读回。原回答、转换、用户操作分别保存。兼容RecognitionRun中的旧parser prompt标识属于历史兼容字段；真实生成候选/Prompt身份以冻结请求和原始记录元数据为准，不能将兼容标识冒充实际模型Prompt。

旧D15/D17共48份录制同规则诊断没有补事实。D19中标作d15的章节实际取D11 C15 raw的出处问题在本轮订正记录，旧文件不改。D25可审查的开发收益要由新输出决定，现阶段只有机制与产品工程证据。
