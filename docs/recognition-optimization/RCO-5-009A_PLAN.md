# RCO-5-009A 候选边界三项根因修补计划

**触发证据**：RCO-5-009 提交推送后、B9 创建前，四个全新通用对抗夹具首次运行得到 1 PASS / 3 FAIL。失败不是模型问题：

1. 同一 scope 内的界面诱饵把后续明确真任务一起标成 non-task。
2. 对象中的关系从句被当作第二个动作，例如“保存已经核对的记录”。
3. 条件事实跨过无关 scope 被远距离误绑定。

**主张**：这三处都属于本机候选边界/证据邻接规则，应在新版本组件中修复，不应靠 Prompt、付费重试或 B9 调参。

## 不变量

- 已冻结并提交的 RCO-5-009 v1 文件、freeze 和 B8 结果保持字节不变；修补使用新文件和新版本号。
- 非任务判定以单个 action 的局部上下文为准，不能用整个 scope 的某个“示例/按钮”词连坐其他动作。
- 若后一个动作词位于前一动作对象的完成/关系结构中，保留审计候选但标为 non-task；前一动作对象必须保持完整。
- 条件事实只允许从紧邻的断言 scope 构造；跨越普通信息、另一要求或新条件即停止，不做远距离猜测。
- action/object/scope/offset/selected 仍由本机构造；模型权限不扩大。
- 任一表外明确要求仍进入 unresolved，不能被当成 requiresAction=false。

## 固定验证

1. 新鲜对抗 4/4：同 scope 诱饵隔离、对象内关系动作、远距离条件阻断、权威引文/示例引文对照。
2. RCO-5-009 原 24 个定向/B8 测试全部继续通过。
3. B8 v2 零调用 oracle 与 frozen raw 分层回归保持产品 Task F1/Complete 100%，旧模型分类仍只记 90%。
4. v1 component freeze 完整性继续 PASS；v2 另建 freeze，不修改旧 freeze。
5. lint、test、build、security 全过后独立提交并推送；此前不得创建 B9。

## 停止条件

- 需要修改 B8 或任何既有 Expected/freeze/dataset/checkpoint/cache。
- 为通过夹具而把局部 proposition 或对象规则无限放宽。
- v1 freeze 漂移、B8 安全/修订退化、出现模型/网络/Secret 行为。
- 新鲜对抗仍有失败；此时 B9 继续阻塞并报告根因。

本阶段模型、网络、verifier、Repair、retry 和 Secret 均为 0；不接稳定路径、不启动 RCO-6、不部署。
