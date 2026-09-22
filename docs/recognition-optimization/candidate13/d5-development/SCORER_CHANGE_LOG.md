# D5 评分合同变更记录

## v4.1.0（派发前修正）

- 时点：模型调用为0、raw/result为0、grant/reserve/settle为0。
- 原因：现有生产输出Schema的`timePoints`不提供独立`actionable`字段，v4.0却将其编译进评分输入，并在预测侧默认成`true`。这会对Schema无法表达的字段作伪精确评分。
- 处理：从时点比较中删除`actionable`，任务级actionable、条件、依赖和其他字段规则不变；compiler、scorer-input、scorer均上调为4.1.0。
- 数据处置：v4.0之后形成的工作树数据仅视为作废草稿。正式D5-R1来源、参照、身份和Manifest必须在v4.1冻结提交推送后重新生成。
- 证据边界：这次修正没有看过Candidate03或Candidate13在D5上的模型输出，因为本批从未派发。
