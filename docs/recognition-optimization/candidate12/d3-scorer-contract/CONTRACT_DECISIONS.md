# D3 契约决策记录

1. 不修补D1冻结Expected。D1/D2已揭盲，任何补字段、补别名或改checks都只能成为事后诊断，不能恢复正式晋级资格。
2. 参照Schema和评分输入Schema分开。人工或未来标签先通过reference validator，再由确定性compiler生成评分输入；候选回答不进入compiler。
3. 动作与对象使用数组及成对别名。避免单独扩动作或对象后形成没有人工确认的笛卡尔组合。
4. 字段正确性不参与任务身份匹配。身份匹配后分别计算条件、状态、材料、时间、完成标准、依赖和关系错误，避免靠身份别名掩盖关键字段错误。
5. 合法合并必须双向明示。未明示或跨对象合并固定保留FN/错误，不由评分器猜测。
6. false、unknown和历史端点可保留为语义任务，但不能是当前actionable；纯信息使用零任务。
7. 完整来源必须所有任务、字段、关系和结构化检查通过，且无FP、Forbidden或教学泄漏。部分参照永不产生完整来源PASS。
8. `REFERENCE_CONTRACT_INVALID`、`PARSE_OR_SCHEMA_FAILURE`和`ADJUDICATION_REQUIRED`分开，不能用0分覆盖接口错误。
9. v3只用于未来新数据。D2正式决定和原始结果保持不变。
10. 24类夹具是接口测试数据，不是Development、Holdout或模型质量证据。
11. 禁止推断除说明与证据外必须携带结构化assertion；它不能命中Expected自身。逐字段评分必须给出稳定原因码，不能只返回布尔值。
