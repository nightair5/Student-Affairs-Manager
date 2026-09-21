# Candidate12 临时 Development 补充计划

版本：`c12-plan-0.6-provisional-development`。状态：`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。

用户要求Codex自行制作一份材料。本包据此生成12份完全合成的校园通知及完整结构化参照，但如实标记为`PROVISIONAL_MODEL_AUTHORED_DEVELOPMENT_ONLY`，不冒充独立人工真值。

交付边界：

1. 覆盖12类预定语义场景，含两份多端点修订。
2. 每份来源和参照具有SHA-256，整包可确定性重复验证。
3. `modelAssistanceUsed=true`、人工标注者0、人工复核者0、Holdout资格false。
4. 独立人工验证器必须拒绝本包；正式24个请求身份保持0。
5. 12份正文加入已见排除库，未来真人来源不得复用或高相似改写。
6. 模型API调用、Secret读取、grant/reserve/settle和账本写入均为0。

下一步仍是接收两位不同真实人员完成的12份全新密封来源与Expected。临时包不能改变Candidate12晋级门槛。
