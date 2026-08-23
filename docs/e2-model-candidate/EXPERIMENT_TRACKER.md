# DeepSeek Vision Exp 实验跟踪

| Run ID | 目的 | 模型 | 数据 | 状态 | 结论 |
| --- | --- | --- | --- | --- | --- |
| R001 | 账号模型身份检查 | Vision Exp | `/models` | PASS | 目标模型真实可用 |
| R002 | 协议预检 | Flash / Vision Exp | Development 1 条 | PASS | 两臂结构与模型血缘正常 |
| R003 | 高风险家族 Screening | Flash / Vision Exp | Development 8 条 | PARTIAL | Task 改善、TimePoint 回退，双方 Gate FAIL |
| R004 | 完整候选评测 | Vision Exp | Development 108 条 | FAIL | 整体差于冻结 Flash 基线，不进入回归 |
| R005 | Golden 回归 | Vision Exp | Golden 110 条 | NOT RUN | 被 R004 停止规则阻断 |
| R006 | 旧 Holdout 回归 | Vision Exp | Holdout 40 条 | NOT RUN | 被 R004 停止规则阻断 |
| R007 | Blind / A–J / Production | Vision Exp | 未见数据和浏览器矩阵 | NOT RUN | 未冻结候选，不得进入 |
