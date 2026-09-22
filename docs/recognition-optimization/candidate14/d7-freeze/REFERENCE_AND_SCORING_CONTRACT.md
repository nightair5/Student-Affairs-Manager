# Candidate14 Reference/Scorer 5.2

参照把存在性、执行人、当前性、条件、依赖、可执行性、默认选择、确认状态、材料、时间和完成标准分开。完整参照中的 `N/A` 表示该字段在来源中没有事实，因此预测也必须为空；部分参照才允许明确列出未裁决字段。

任务匹配采用确定性一对一分配。一个预测任务不能同时满足两个 Expected；多个同分最大匹配返回 `ADJUDICATION_REQUIRED`。动作、对象、材料、时间、完成标准、依赖和修订均按字段精确匹配，只接受冻结前登记的等义。预测出的额外实体、悬空实体、额外修订和完整参照中未声明的事实都计错。无任务来源必须逐项保留事件、时间、地点、禁止项或信息范围，空输出不能通过。

当前 wire 的历史/取消概念通过合法 `tense/status/validity/revision` 组合表达，不要求 Schema 中不存在的枚举。参照验证器阻断 `false + actionable` 等不可满足组合。聚合保留 Schema/reference failure 的分母与 Severe，TP 只由最终字段检查重新计算。

Reference/Scorer 5.2 仍是合成 Development 的单作者工程参照，不是独立人工真值。5.1 在派发前被同系列 provisional 审计判为失效；旧 v4.1、旧 Expected 和 D6 分数保持不变。
