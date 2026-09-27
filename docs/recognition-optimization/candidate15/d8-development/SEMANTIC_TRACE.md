# D8 语义—评分—处置对应表（工程 provisional）

| 原文义务/事实 | Candidate15 Prompt | wire / 公共 adapter | v6 参照与评分 | 页面处置 | 证据边界 |
|---|---|---|---|---|---|
| 当前动作＋对象 | 单独列任务，不跨对象合并 | `tasks.action/object` 与 scope | 动作、对象、actor、状态、条件、完成标准、材料、时间、依赖逐项核对 | 逐项编辑/拒绝/确认 | 完整参照可测；需正反例 |
| 否定、禁止、已取消、历史要求 | 默认非当前任务；确需修订关系才保留旧端点 | task semantics/revisions 或 `informationScopeIds` | 任务有效性、修订端点可测；仅信息 scope 无法证明禁止语义 | 用户可以拒绝错项；首次原答保留 | 信息 scope 只能证明覆盖，不能证明理解了禁止 |
| true/false/unknown 条件 | 不把 unknown 当 true/false | `condition.value`，本机不改条件 | 值、条件与事实 scope、actionable 逐项核对 | unknown 要人工确认 | 需要完整参照才可测 |
| 材料、格式、包装 | 附着任务，不作独立任务/办结标准 | materials/detail | 材料与完成标准分别比较 | 材料审查与保存 | “不得合并压缩包”是否属于办结标准需个案裁决；不硬塞统一答案 |
| 任务时间 | 保留类型、原文及不确定性 | 模型只给 raw/type，本机 timePolicy 归一 | type、normalized、timezone、precision、allDay、confirmation | 待定日期不可假装已确定 | 完整参照可测 |
| 独立事件及其起止时间 | event_start/end 正确关联 | events.start/end ID → timePoints；同一公共 adapter | v6 逐项比六个时间语义字段＋关联对象 | 事件事实可核对，非任务不自动创建任务 | 已有合法 wire 与六种单字段反例 |
| 无当前任务的信息 scope | 所有非任务 scope 进入 informationScopeIds | `informationScopeIds` | v6 对 event/time/location/background 全部要求覆盖；不再只允许 information kind | 归档/拒绝后不得产生正式任务 | scope 可查；单凭 scope 不证明语义正确 |
| “时间另行公布” | 不冒充当前截止 | 当前 wire 可以保存 raw，但没有独立“未公布的截止”类别 | 仅能做部分参照与 scope 保留 | 展示待核对，不生成虚假日期 | `UNEXPRESSIBLE`，不得给整份正确分 |

版本边界：`candidate14` 的冻结文件与 R4/R5 结果保持原样；本表与 `candidate15-reference-contract-6.0.0`、`candidate15-scoring-6.0.0`、Prompt 15.1 一起作为新的工程契约。单作者/模型辅助设计不是独立人工真值。仅已见匿名开发资料允许在本阶段反复修复，不能当 Holdout。

裁决约定：动作和对象的别名须有原文依据；不影响含义的顺序和标点不扣分，否定、时间类型、条件真假和取消目标的改变必须扣分。拆合以“一个动作＋一个明确对象”为最小义务；多个端点不能跨对象合并。`N/A` 表示完整参照确认没有该事实，`partial` 不计整份正确。未决歧义追加登记，禁止按模型输出倒改旧 Expected。
