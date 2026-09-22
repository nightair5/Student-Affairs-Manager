# Candidate14 D7 冻结说明

Candidate14 是一份独立完整 Prompt，不继承 Candidate12/13 的后缀规则。它把“要求是否存在、当前性、条件、依赖、是否可执行、默认选择、用户确认”分开判断，并明确保护否定、取消、历史端点、完成标准和不确定时间。冻结评分版本为 Reference/Scorer 5.1.0。

未来 Candidate03 与 Candidate14 两臂必须共用 `candidate14-common-adapter-1.0.0` 和 `candidate14-time-policy-1.0.0`。因此本机时间修正不能算作 Candidate14 Prompt 的收益。

本阶段无模型调用、无教学例、无真人证据。教学例泄漏字段必须报告 `NOT_APPLICABLE_NO_TEACHING_EXAMPLES`，不能写 0 冒充已检测。

冻结边界：Candidate14 Prompt、Reference V5、Scorer V5、公共适配、时间策略、正确无任务归档、测量 V2、CheckList 回归与晋级门槛。未来 Development 来源和 Expected 在本冻结提交推送后才可生成。
