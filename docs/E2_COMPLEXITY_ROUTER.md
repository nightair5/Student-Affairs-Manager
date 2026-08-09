# E2 Complexity Router 泛化记录

## 版本

`recognition-router-1.1.0`

## 路由信号

Router 继续是确定性纯函数，但不再主要依赖长度和旧动作词数量。当前评分综合：

- 时间表达数量；
- 主动动作或被动义务数量；
- 材料关系数量；
- Event 线索数量；
- 列表与表格结构；
- 附件/PDF/截图上下文；
- 条件、更正、模糊表达；
- 跨段指代；
- 文本长度与段落数量。

真正高风险的是 `Complex → Simple` 的 under-routing；因此表格、多时间、多事件、跨段指代和更正语义会提高复杂度。单个日期、单个附件或单个 Event 不会单独强制进入 Complex，避免无意义增加延迟和 Token。

## 两阶段状态

Complex 的 `candidateStrategy` 仍为 `fact_then_plan`，但 `selectedStrategy` 默认保持 `single_pass`。现有审计没有提供同一候选在相同样例上的两阶段净收益证据，因此本阶段不启用两次模型调用，也不把“架构上可用”表述成“质量已证明”。

## Facts contract

未启用的第一阶段事实契约升级为 `recognition-facts-1.1.0`，覆盖 actors、actions、obligations、objects、material purposes、time roles、events、conditions、channels、constraints、ambiguities 和逐字 evidence。该契约不做 Project/Milestone/Task 规划。
