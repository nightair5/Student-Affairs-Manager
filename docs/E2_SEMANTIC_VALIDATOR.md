# E2 Semantic Validator 设计记录

## 目标与版本

`recognition-quality-2.1.0` 将 Quality Validator 从“标题是否命中固定动作词”调整为“结构、关系、事实线索与证据联合检查”。Validator 仍只报告问题，不创建、删除或改写业务实体。

## 本轮变化

- Task 结构检查以非空 `actionVerb` 与 `actionObject` 为准，不再要求标题包含旧动作词表。
- 新增 `MISSING_ACTION`：当来源明确标记需要行动、正文存在义务/截止或动作关系，但结果没有 Task 时报告；该问题不可自动修复。
- 日期扫描覆盖年份、数字分隔日期、中文日期、相对和模糊表达，用于发现漏掉的 TimePoint；不会自行归一日期。
- Material 缺失检查同时要求“准备/取得/携带/提交/核验关系”和可交付或凭证对象，并排除“仅供参考、无需提交”等 reference-only 语义。
- Event 检查要求参加关系或事件发生关系，避免把“提交汇报材料”中的“汇报”误报成 Event。
- 过度拆分阈值改用语义动作单元数，不再累加固定动词命中次数。

## 精度保护

- 纯信息与“无需操作”段落不作为动作信号。
- Reference-only 附件不触发 `MISSING_MATERIAL`。
- Validator 不把日期正则结果写成 TimePoint，不把对象写成 Material，也不把义务句写成 Task。
- 新增回归测试同时覆盖命中与不应命中的反例，避免用“每条都告警”换取 Recall。
