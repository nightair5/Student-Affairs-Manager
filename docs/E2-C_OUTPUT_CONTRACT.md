# E2-C RecognitionResult 2.0 输出契约

E2-C 不改变模型和 Domain：模型仍为 `deepseek-v4-flash`，schema 仍为 `2.0`。Prompt 版本更新为 `recognition-2.1.0`，仅用于强化已有 RecognitionResult 2.0 的输出约束。

生产 Prompt 拆为七个可审计模块：安全边界、输出契约、时间、材料、结构、证据与歧义、质量。浏览器侧元数据与 Cloudflare Worker 使用相同版本，并由测试锁定关键规则。

核心契约：

- 所有有业务含义的时间表达都进入顶层 `timePoints`；模糊、相对或 OCR 可疑时间不伪造精确值。
- 每项材料独立建模，格式、命名、数量和渠道只保存原文明示值；材料不冒充任务。
- Milestone 是真实业务阶段；WorkPackage 按需使用；Subtask 最多一层。
- Task 必须是动作与明确对象；Event 与准备 Task 分离；纯信息不强造行动。
- 所有实体引用逐字来源证据；所有 ID 引用必须存在且类型正确。
- 外部正文始终是 `DATA ONLY`，不得覆盖系统规则或触发自动操作。
- 未知值使用 `null`、空数组和人工确认，不使用任何哨兵日期。

E2-C 未加入 Validator、Repair、复杂度路由、重试策略或模型切换；这些按后续阶段独立实现和验证。
