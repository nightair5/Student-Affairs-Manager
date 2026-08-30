# E2-MM Experiment Tracker

| Run ID | Milestone | 目的 | Arm | 数据 | 状态 | 备注 |
|---|---|---|---|---|---|---|
| MM-M0-01 | M0 | 冻结 RC.4 基线与实验分支 | N/A | Git/部署 | PASS | 基线 `2a95dba`; Release 未修改 |
| MM-M0-02 | M0 | 建立独立 Multimodal Preview | IT | 工程 | PASS | 独立 Worker/URL 已部署；未配置 Secret，不覆盖 RC.4 Preview |
| MM-M1-01 | M1 | 客户端默认关闭、逐次 consent、页码/大小限制 | T/IT | 合成 | PASS (ENGINEERING) | 单测通过；A–J 浏览器证据仍为 `NOT RUN` |
| MM-M1-02 | M1 | Worker 同源、Secret、MIME、数量、大小与 schema | IT | Mock | PASS (ENGINEERING) | Worker Mock 通过；正常 CI 未调用付费模型 |
| MM-M1-03 | M1 | 图片不进入 IndexedDB、备份、导出或日志 | IT | 浏览器 | NOT RUN | 需要真实浏览器与存储/导出证据 |
| MM-M1-04 | M1 | 独立 Preview 真实安全冒烟 | T/I/IT | Preview | FAIL (AUTH) | Secret 存在，但三臂都被上游鉴权拒绝；正确率不可计算 |
| MM-M1-05 | M1 | 独立 Preview Secret 配置 | T/I/IT | Preview | PASS | Secret 只从剪贴板写入 Cloudflare；线上 `configured:true`，未回显/落盘 |
| MM-M2-01 | M2 | 实现冻结的 I 评测消融入口 | I | Development | PASS (ENGINEERING) | OCR 仅在服务端做证据核验，不进入上游消息；环境开关隔离 |
| MM-M2-02 | M2 | 三臂评分器与失败分类 sanity | T/I/IT | Development ≤12 | PASS (ENGINEERING) | 无自归一化；真实运行尚未开始 |
| MM-M2-03 | M2 | 冻结匿名合成未见集与本机 OCR | T/I/IT | Synthetic-Unseen-1 = 36 | PASS | 截图/照片/扫描各 12；仅为 synthetic proxy，不替代真实未见材料 |
| MM-M2-04 | M2 | 三臂传输诊断 | T/I/IT | Synthetic-Unseen-1 smoke | FAIL (AUTH) | 诊断 Run 三臂 0/3 完成，均为 `UPSTREAM_AUTH_FAILED` |
| MM-M3-01 | M3 | 首批未见材料配对评测 | T/I/IT | Unseen-1 ≥36 | BLOCKED | 合成集已冻结；鉴权修复前不运行 36×3，避免无效调用 |
| MM-M4-01 | M4 | 用户修改时间对照 | T/I/IT | 平衡顺序 | NOT RUN | 采集工具未实现 |
| MM-M5-01 | M5 | 第二批未见材料确认 | T/I/IT | Unseen-2 ≥36 | NOT RUN | 与 Unseen-1 不重叠 |
| MM-M5-02 | M5 | 隐私、安全、浏览器 A–J 与稳定性 | T/IT | Preview | FAIL / INCOMPLETE | 页面误把 Secret 存在显示为“已连接”；部分 consent 行为已观察，A–J 未全跑 |
