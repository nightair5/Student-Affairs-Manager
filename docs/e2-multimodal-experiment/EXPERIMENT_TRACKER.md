# E2-MM Experiment Tracker

| Run ID | Milestone | 目的 | Arm | 数据 | 状态 | 备注 |
|---|---|---|---|---|---|---|
| MM-M0-01 | M0 | 冻结 RC.4 基线与实验分支 | N/A | Git/部署 | PASS | 基线 `2a95dba`; Release 未修改 |
| MM-M0-02 | M0 | 建立独立 Multimodal Preview | IT | 工程 | IN PROGRESS | 不得覆盖 RC.4 Preview |
| MM-M1-01 | M1 | 客户端默认关闭、逐次 consent、页码/大小限制 | T/IT | 合成 | IN PROGRESS | 不调用真实模型 |
| MM-M1-02 | M1 | Worker 同源、Secret、MIME、数量、大小与 schema | IT | Mock | IN PROGRESS | 正常 CI 禁止付费调用 |
| MM-M1-03 | M1 | 图片不进入 IndexedDB、备份、导出或日志 | IT | 浏览器 | TODO | 需要真实浏览器证据 |
| MM-M2-01 | M2 | 实现冻结的 I 评测消融入口 | I | Development | TODO | 不能复用 IT 伪造 |
| MM-M2-02 | M2 | 三臂评分器与失败分类 sanity | T/I/IT | Development ≤12 | TODO | 不进入最终表 |
| MM-M3-01 | M3 | 首批未见材料配对评测 | T/I/IT | Unseen-1 ≥36 | NOT RUN | 未冻结/未揭示 |
| MM-M4-01 | M4 | 用户修改时间对照 | T/I/IT | 平衡顺序 | NOT RUN | 采集工具未实现 |
| MM-M5-01 | M5 | 第二批未见材料确认 | T/I/IT | Unseen-2 ≥36 | NOT RUN | 与 Unseen-1 不重叠 |
| MM-M5-02 | M5 | 隐私、安全、浏览器 A–J 与稳定性 | T/IT | Preview | NOT RUN | 全 PASS 才可评审替换 |
