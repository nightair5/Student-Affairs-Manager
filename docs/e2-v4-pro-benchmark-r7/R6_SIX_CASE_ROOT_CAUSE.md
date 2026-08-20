# E2.9-R7 前置：R6 六个非平局案例根因审计

状态：**ROOT CAUSE CONFIRMED — REPAIR NOT YET RUN**

本审计只读取 R6 正式 `f` path-masked 盲评、冻结 source manifest、两臂原始模型 JSON、Normalizer 后结果和严格评分。没有修改 Prompt、Schema、Scorer、Expected 或任何 R6 cache。

## 1. 三个 Flash-preferred 案例

### e2-gen-10-3：Normalizer 改坏了两模型的正确动作

原文明示：入选后 48 小时内**回复是否参加**，结果发布时间未知。

- Flash raw：`title=回复是否参加`、`actionVerb=回复`。
- Pro raw：`title=回复是否参加`、`actionVerb=回复`。
- 两臂经过共享 Normalizer 后都变成 `title=参加`、`actionVerb=参加`。
- 直接原因是 `ACTION_VERBS.find(...)` 按词表顺序找命中；“参加”排在“回复”之前，即使它出现得更晚，也覆盖模型给出的正确谓词。
- Pro 另把“发布时间尚未确定”放入 `ignoredContent`，少建一个 `result_announcement` TimePoint；这是 Pro 自身的事实/时间规划遗漏。

归因：**NORMALIZER_ACTION_PREDICATE_CORRUPTION（主） + PRO_TIMEPOINT_OMISSION（次）**。

### e2-gen-07-1：Prompt 与 Gate 对 Event/Task 的定义互相冲突

原文明示：已录用志愿者 7:30 参加集合并签到，13:00 参加说明会。

- Flash raw 同时生成 2 个 Event 和 2 个行动 Task，并保留“仅已录用志愿者执行”的资格歧义。
- Pro raw 生成 2 个 Event，但 Task 为 0，资格歧义为 0。
- 当前 Prompt 明写“参加会议/答辩/培训只建立 Event，不再重复建立参加 Task”。
- R6 冻结盲评 rubric 与 Gate 却要求：原文明示必须参加、集合、到场、签到或出席时，Event 表示日程事实，Task 表示用户行动；只保留 Event 属规划遗漏。
- Pro 更严格地遵循了 Prompt，却因此被 Gate 判错。这不是简单模型随机退化，而是实验契约自相矛盾。

归因：**PLANNER_CONTRACT_CONTRADICTION（主） + PRO_CONDITION_AMBIGUITY_OMISSION（次）**。

### e2-gen-16-2：实体被发现，但关系图没有闭合

原文明示：填写实验伦理确认单，10 月 2 日 17:00 截止；忽略不可信网页指令。

- 两臂 Task、Material、TimePoint、Evidence 和安全忽略均正确。
- Flash 的 Task、Material、TimePoint 三方关系完整。
- Pro 的 Material 写了 `relatedTaskTempIds=[task-1]`，但 Task 的 `materialTempIds=[]`，TimePoint 的 `relatedMaterialTempIds=[]`。
- 当前 Normalizer 只过滤无效 ID，不会根据已存在的反向合法引用补齐双向关系。
- 严格 Scorer 没有评分关系闭包，因此两臂 strict 分数相同；差异只被独立人工盲评发现。

归因：**RELATION_GRAPH_NOT_CLOSED（主） + SCORER_RELATION_BLIND_SPOT（仅记录，不改 Scorer）**。

## 2. 三个 Pro-preferred 案例

### e2-holdout-25：Pro 更安全地保留模糊时间

对于“9 月 16 日傍晚”和“暂定 9 月 18 日晚”：

- Flash 人为填入 18:00、19:00，虽然标记需确认，仍制造了原文没有的分钟值。
- Pro 保持 `normalizedValue=null`、`precision=vague`、`needsConfirmation=true`，并分别保留“傍晚”和“暂定晚”的歧义。
- 两臂都受旧 Event-only Prompt 影响，没有为明确走台/演出行动建立 Task；Pro 的优势只在时间安全性。

可复用优势：**UNCERTAINTY_PRESERVATION**。

### e2-complex_notice-03：Pro 的具体材料关系更清楚

原文要求上传结题报告、经费表和成员总结。

- Pro 将上传 Task 直接关联三项具体材料。
- Flash 同时创建泛化“结题材料”和具体“结题报告”，但上传 Task 关联了泛化项而漏关联具体结题报告。
- 冻结 strict Expected 额外要求“结题材料包”，因此反而把 Pro 记为缺材料；独立人工判断认为 Pro 更符合实际用户执行关系。

可复用优势：**SPECIFIC_MATERIAL_RELATIONSHIP**。同时记录 **EVALUATION_MISMATCH**，但禁止修改 Expected 刷分。

### e2-gen-22-1：Pro 同时保留时段与地点两类歧义

对于“10 月 16 日上午进行成果交流，教室另行通知”：

- Flash 将“上午”压成全天日期 `2026-10-16`，只提示地点未知。
- Pro 保持时间值为空、`precision=vague`，同时提示具体时刻和地点均待确认。
- 其余三项行动、三份提交材料、Event 和前三个时间点两臂基本一致。

可复用优势：**TIME_ROLE_AND_AMBIGUITY_PRESERVATION**。

## 3. 可泛化原因清单

按修复优先级排序：

1. **动作谓词必须按原始位置和模型显式字段解析，不能按词表顺序抢占。** 宾语中出现第二个动作词时，不得覆盖句首谓词。
2. **Event 与 Task 是两个维度。** Event 记录“什么时候/在哪里发生”，Task 记录“用户必须做什么”；原文明示必须参加、到场、集合、签到、出席时，两者可以同时存在。
3. **条件适用范围必须进入 Ambiguity/Condition。** “仅已录用者”“仅入选者”等不能因为用户身份未知而静默丢失。
4. **实体关系必须双向闭合。** Task↔Material、Task↔TimePoint、TimePoint↔Material 中任一合法方向已存在时，应在不创造新事实的前提下补齐其余引用。
5. **模糊时间不得伪精确。** “上午、傍晚、晚、暂定、另行通知”优先保持 null + needsConfirmation，并保留原始时段信息。
6. **具体材料优先于泛化包名。** 提交关系应指向原文明示的具体交付物；不得用“材料”“资料包”等上位词替代具体对象。
7. **Strict Scorer 不覆盖关系质量。** 本轮保持 Scorer 冻结，关系正确性继续通过 path-masked 人工 Gate 衡量，不通过修改评分器追分。

## 4. 最小修复设计

修复限定在全新的 Preview-only benchmark 协议，绝不改变 Production 默认识别路径：

1. 建立 **Protocol 3.6.0** 和全新 benchmark pipeline/prompt/normalizer 版本。
2. 使用 benchmark-only Planner contract 覆盖旧 Event-only 冲突：明确要求 Event 与用户行动 Task 可并存；不改生产 `recognitionSystemPrompt()`。
3. 增加 benchmark-only post-normalizer：
   - 以 raw Task 的显式 `actionVerb` 和动词在标题中的最早位置恢复动作谓词；
   - 对已存在的 Task、Material、TimePoint ID 做关系闭包；
   - 不根据 caseId、固定句子或 Expected 创建实体。
4. 增加 fail-closed Validator：`requiresAction=true` 且存在带明确行动证据的 Event、但没有任何 Task 时，标记规划完整性问题；不让旧输出伪装为通过。
5. Prompt、Schema、Scorer、Expected 的生产版本保持不变；实验 Scorer 只更新协议/版本/hash 绑定，不改变指标语义。
6. 先运行零模型回放测试验证三个通用缺陷；通过后才允许全新标签执行完整 8-case × 2-model Screening，禁止选择性补跑。

## 5. 结论

R6 的三条 Flash 优势不是单一“Pro 能力差”：

- 1 条由共享 Normalizer 直接制造；
- 1 条由 Prompt 与 Gate 契约冲突放大；
- 1 条是 Pro 关系规划不完整，而 Normalizer/Validator 没有闭合或拦截。

同时，Pro 在模糊时间、歧义和具体材料关系上存在可重复的真实优势。证据支持实施一次隔离、最小、可回退的 Planner/Normalizer 修复；不支持直接进入 Selection、Blind 或 Production。
