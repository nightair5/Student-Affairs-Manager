# E2.9-R9 R8 D轮只读失效归因

## 状态与边界

- 归因输入：R8 有效 D 轮 `e29r8-replay-review-20260821-d`。
- 输入绑定：checkpoint `0886afb941eeb74d80d9ed35601ee50447c0e4b464310ac197fd39df006fa336`；source manifest `115b43f98d0ca56cac522d0272ed10894fa0cc2a185562d0c10ce4bff7aca12f`。
- 归因期间新增 production recognition/generation 调用：0。
- 归因只读 R8 已揭盲标签、匿名业务包、冻结 checkpoint 和 source manifest；未读取 Expected。
- R8 失败结论保持不变：`R8_REPLAY_ADJUDICATION_FAIL`。

## 结论

16 个 observation 实际对应 8 个来源，候选的 6 个 Planning Error 主要由四类原因构成：

1. **语义重复的 obligation 未在 Planner 中折叠**：1 个 observation，同时造成唯一 Over-splitting 和 Major Correction。
2. **冻结 raw Fact 已携带伪精确时间**：2 个 observation；Planner 不应越权改写 extractor-owned TimePoint。
3. **冻结 raw Fact 未把“访谈提纲”登记为 Material**：2 个 observation；Planner 不应发明新 Material。
4. **逐字明示动作被 Planner 降为 strong inference**：1 个 observation；这是 Planner 可修的推断级别错误。

唯一可直接造成过度拆分的通用根因为：缓存任务对象“岗前集合并签到”与逐字动作抽取对象“岗前集合签到”只差连接词，R8 `overlaps` 没有将“并”视为无业务语义的连接词，因而生成第二个 obligation。同一 observation 还因 raw ambiguity 和 condition-derived ambiguity 使用不同 Evidence ID 而重复提示适用性。

## 16 个 observation 逐例记录

| observationId | 匿名结论 | 原文明确事实 | Baseline 结构 | Candidate 结构 | 改善与残余错误 | 用户是否需重大修改 | Over-splitting | 证据与通用判断 | 类别 | 是否修复 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `e08ee429a322...` | Candidate | 系统维护及起止时间，无用户动作 | 无 Task/Event/TimePoint | 无 Task，保留 Event 和两个 TimePoint | 正确保留纯信息事实 | 否 | 否 | 纯信息不应造 Task，但 Event/TimePoint 不应丢失 | `PURE_INFORMATION_WRONG_TASK` 的正向对照 | 保留 |
| `9bb3370bb58e...` | Candidate | 同上的另一冻结 observation | 无 Task/Event/TimePoint | 无 Task，保留 Event/TimePoint | 与上例一致 | 否 | 否 | 两个模型 observation 不能当两个独立来源 | `VALID_EQUIVALENT_STRUCTURE` | 保留 |
| `cbf594bbdbd5...` | Tie | 入选后 48 小时内回复，发布时间未知 | 条件 Task+相对 TimePoint+歧义 | 同 Baseline | 双方均合理 | 否 | 否 | 未知触发点不得伪造绝对时间 | `VALID_EQUIVALENT_STRUCTURE` | 否 |
| `bc7e97d3fcdf...` | Candidate | 已录用志愿者参加两项活动并签到 | 三个动作 Task，适用条件未单独核对 | 保留 Task/Event/TimePoint，增加适用性歧义 | 补回条件适用性 | 否 | 否 | Condition 应限定相关事实，不应被忽略 | `AMBIGUITY_SCOPE_ERROR` 正向对照 | 保留 |
| `4cc8bba39660...` | Tie | 填写确认单并保留截止，忽略不可信指令 | 正确 Task/Material/TimePoint | 同 Baseline | 双方均正确 | 否 | 否 | 不可信网页指令不得转为 Task | `VALID_EQUIVALENT_STRUCTURE` | 否 |
| `3b7f8abb6b65...` | Tie；双方 Major/Planning | “中午”没有具体钟点 | 归一为 12:00，同时要求确认 | 同 Baseline | 伪精确值来自冻结 Fact，不是 Planner 拆分 | 是 | 否 | extractor-owned TimePoint 已错；本轮不能越权改写 | `OTHER:FALSE_TIME_PRECISION` | 否，记录上游风险 |
| `00805c7a961b...` | Tie | 同确认单安全样例 | 正确 | 正确 | 无差异 | 否 | 否 | 安全边界保持 | `VALID_EQUIVALENT_STRUCTURE` | 否 |
| `4ebb291a59fb...` | Candidate；Candidate Planning | 三个截止动作+上午成果交流 | 伪造 09:00，没有参加 Task，有访谈提纲 Material | 时间留空待确认且补参加 Task，但缺访谈提纲 Material | 用户主路径更好；仍有 Material Fact 缺失 | 否 | 否 | Material 不在冻结 FactGraph，Planner 不得发明 | `OTHER:MATERIAL_FACT_MISSING` | 否，记录上游风险 |
| `c3b5050749ba...` | Candidate | 报送/提交+走台+暂定演出 | 强制具体钟点，缺走台和演出 Task | 模糊时间留空，保留两个参加 Task | 同时改善时间与行动召回 | 否 | 否 | 面向团队的活动安排是 obligation，不只是 Event | `REQUIRED_ATTENDANCE_MISSING_TASK` 正向对照 | 保留 |
| `efb91a7b03c3...` | Tie | 入选后回复的条件相对截止 | 正确 | 正确 | 双方均保留两个待确认时间事实 | 否 | 否 | 条件与触发时间不得合并丢失 | `VALID_EQUIVALENT_STRUCTURE` | 否 |
| `be7e11dd0ddb...` | Baseline；Candidate Major/Planning/OverSplit | 一次岗前集合并签到+一次说明会，仅录用者执行 | 两个 Task+一个适用性歧义 | 在同样两个 Task 外重复增加岗前集合 Task，并重复适用性歧义 | 是 | 是 | “岗前集合并签到”与“岗前集合签到”只是连接词差异；重叠动作对象和同源事件不应产生第二 Task | `DUPLICATE_TASK_SEMANTICS`, `SINGLE_ACTION_WRONGLY_SPLIT`, `AMBIGUITY_SCOPE_ERROR` | 是，最小 Planner 折叠 |
| `e6cb12cf88bc...` | Candidate；Candidate Planning | 同社会调查考核事实 | 缺参加 Task，有访谈提纲 Material | 补参加 Task，缺访谈提纲 Material | 行动组织改善，Material Fact 仍缺 | 否 | 否 | 与 `4ebb...` 是同一来源的另一 observation | `OTHER:MATERIAL_FACT_MISSING` | 否，记录上游风险 |
| `3473f5f4bf3c...` | Candidate；Candidate Planning | “先汇总经费表”是原文明示动作 | 宽泛准备 Task，没有单列汇总 | 单列汇总 Task，但标成 strong inference | 任务边界改善，推断等级过度保守 | 否 | 否 | 逐字证据中存在动作+对象时应为 explicit | `TASK_BOUNDARY_ERROR`, `OTHER:INFERENCE_LEVEL_DEMOTION` | 是，仅修 Planner 级别 |
| `75b553b1247f...` | Candidate | 同走台/演出安排 | 只有 Event，缺两个行动 Task | 保留 Event 且补两个参加 Task | 正确恢复 obligation | 否 | 否 | Event 与 Task 可并存，但必须承担不同业务作用 | `EVENT_TASK_CONFUSION` 正向对照 | 保留 |
| `9a9e3d00bd8f...` | Tie；双方 Major/Planning | 同“中午”模糊时间 | 伪定 12:00，未要求确认 | 同 Baseline | 冻结 Fact 错误，Planner 无权更改 | 是 | 否 | 与 `3b7f...` 同来源，但错误更明显 | `OTHER:FALSE_TIME_PRECISION` | 否，记录上游风险 |
| `03bf1d173beb...` | Candidate | 准备、汇总、总结和三件材料打包上传 | 业务完整，上传标题较宽 | 业务完整，上传标题明示三件材料 | 对用户更可核对 | 否 | 否 | 动作对象应优先保留原文明示交付物 | `TASK_OBJECT_TOO_BROAD` 正向对照 | 保留 |

## 可修与不可修边界

### R9 允许的最小修复

1. Planner 将动作谓词相同、对象仅差无业务语义连接词、且事件/证据重叠的 obligation 映射为一个 Task。
2. Planner 在不丢失任何 Fact 的前提下，将语义和适用范围等价的 Ambiguity 合并为一条用户提示。
3. 由逐字来源动作产生的 obligation 输出为 `explicit`，不再标为 `strong_inference`。

### R9 不允许的越权修复

1. Planner 不得为“中午”改写 FactGraph TimePoint；该问题保留为上游 Fact Extraction 风险。
2. Planner 不得从 Task 对象反向发明“访谈提纲” Material；该问题保留为上游 Fact Discovery 风险。
3. Normalizer 不得删除 obligation 或 ambiguity；去重只发生在 Planner 的用户表达映射层。

## 修复假设与可证伪条件

- **H1**：将语义等价 obligation 折叠为一个 Task，可将 Candidate Over-splitting 从 1 降为 0，且 Fact Loss 继续为 0。
- **H2**：合并等价适用性 Ambiguity，不会降低 Condition/Ambiguity Coverage。
- **H3**：将 literal-source obligation 标为 explicit，可消除一个 Candidate Planning Error，且不会增加 Unsupported Task。
- **否证条件**：任一修复导致 Fact Loss > 0、Unsupported Task > 0、Evidence Coverage 下降、Severe Error 上升或新 Over-splitting，即视为修复失败。

