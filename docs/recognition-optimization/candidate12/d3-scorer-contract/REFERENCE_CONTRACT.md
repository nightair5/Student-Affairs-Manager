# Reference Contract 3.0

本契约是实验评分参照的唯一机器接口，不修改产品Workspace schema v8。参照与模型回答严格分离：参照编译阶段不得接收、读取或推断任何candidate output。

## 任务身份

每个任务使用`referenceTaskId`、`actions[]`、`objects[]`和显式`actionObjectAliases[]`。动作与对象必须分别有证据，`taskBasis`只能是`explicit_action_object`或`strongly_inferred_action_object`。材料、地点、格式、联系方式和背景说明不能作为task basis。

别名只参与动作与对象的身份对齐。别名不能放宽条件、状态、完成标准、材料、时间、依赖或修订关系；别名对必须同时出现在`actions[]`和`objects[]`中。

## 状态与条件

`semanticStatus`、`semanticValidity`、`actionable`和`condition.value`分别保存，不互相覆盖。`condition.value=false/unknown`的任务固定`actionable=false`；取消、被替代、过期、已完成或历史端点也不能标为当前可执行任务。unknown可以作为待确认语义保留，但不能默认勾选为当前行动。

## 关联事实

材料、时间、完成标准和依赖都直接绑定`referenceTaskId`。模糊或未知时间不得带伪造归一化值。依赖和关系端点必须存在，不能引用自身。

修订、取消和替代分别使用结构化关系：

- `revisionRelations`：`amends`；
- `cancellationRelations`：`cancels`，允许没有新端点；
- `replacementRelations`：`replaces`，必须保留新旧端点。

同一旧端点不能被多个不相容的新端点静默覆盖。修订和替代必须保持对象一致；多端点通知逐对象建立关系。合法合并必须双方显式登记`allowedMerges`且对象相同；其他合并按禁止处理。

## 完整性与歧义

每个任务必须列出`requiredFields`、`optionalFields`和结构化`ambiguityRules`。最低必填字段为状态、有效性、actionable、条件和完成标准。`forbiddenInferences`必须包含code、kind、statement、evidence及机器可判定的assertion；assertion若同时命中Expected本身，validator固定以`D3_FORBIDDEN_EXPECTED_CONTRADICTION`拒绝，避免参照自相矛盾。不接受自然语言检查列表。

无任务来源使用`tasks: []`。完整参照与部分参照由`coverage`明确区分；部分参照的`complete`固定为null，不能用于晋级。人工来源必须如实记录labeler A、reviewer B和模型辅助状态，任何自动转换都不能冒充独立人工标签。

## 失败关闭

validator在编译前检查全部结构、端点和语义不变量。compiler输出`inputSha256`和`compiledSha256`。评分器只消费通过校验且哈希一致的编译结果。无效参照返回`REFERENCE_CONTRACT_INVALID`；预测Schema失败单独返回`PARSE_OR_SCHEMA_FAILURE`。
