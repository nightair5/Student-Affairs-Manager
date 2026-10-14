# RCO-5-009A 候选边界与直接物化根因修补计划

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

## 执行中发现的更深断层

前三项边界修好后，第一轮独立对抗虽然聚焦测试 39/39 通过，仍判定 BLOCK：旧 P5 先把候选交给有损 P4，再按 `scopeId + action.surface` 反查候选。相同 scope 出现两个同字动作时，发生位置、条件角色、当前性和对象归属会在中途丢失。

因此最终实现不再修补 P4 输出，而是：

1. 候选目录直接记录不可变 candidate/occurrence ID、UTF-16 原文位置、从句角色、当前性、条件事实与真值。
2. accepted ledger entry 与 owned object 必须一一对应；不能对应时整条契约失败，不能静默少一项。
3. task ID 固定为 `task:${candidateId}`，动作和对象直接复制自对应 span；不合并、不按文本反查。
4. 新增 candidate-aware revision resolver；相同动作靠 occurrence offset 区分，未决修订只阻断可能目标，不连坐后置独立任务。
5. `requiresAction` 使用 true / false / unknown：存在明确当前义务为 true；只有不确定可能义务时为 unknown；完整证明没有当前义务才为 false。
6. 新结果使用独立 Schema，未伪装成旧 task-formation Schema；稳定路径仍未接入。

## 最终零调用门

- 聚焦索引/composer/物化/B8 测试 49/49 PASS。
- 独立对抗复审 PASS：四个根反例、sibling quarantine、历史歧义修订后置当前任务、selected 安全 tuple 和 accepted-task 双射全部通过。
- 已见 B8：20/20 期望动作可表达，Task P/R/F1 和动作对象边界均 100%，三类修订与 unresolved 精确，unsafe/Forbidden/stale/selected-stale 均 0；旧模型候选 F1 仍只记 90%。
- B8-12 冻结标签将两个“旧任务”记作当前 future/pending/active；新安全策略记作历史、未知有效性且不选。既有 Expected 不改，差异列为冻结标签冲突，因此 Complete Case 为 11/12，不倒退安全语义凑 100%。
- B8 没有真实 `needs_model` 候选，不能证明新分类器能力。B9 必须覆盖真实 needs_model、多对象闭集、同字 occurrence、局部坏响应、修订局部隔离和表外动作。
