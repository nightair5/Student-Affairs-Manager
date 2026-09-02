# RCO-5-002 修补轮实验完整性审查

**日期**：2026-09-02
**最终结论**：`FAIL / REJECT_CANDIDATE / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED`

## A–F 完整性结论

- Ground truth：PASS；全部为手写匿名 `contract_fixture`，未冒充模型或真实材料标签。
- Score normalization：PASS；未运行质量评分，内部质量值固定保守且强制人工复核。
- Artifact：PASS；`facts-1.1` 至 `facts-1.4` 分版本冻结，失败版本不覆盖；最终审查绑定 `facts-1.4` 四个组件 SHA。
- Reachability：WARN；候选保持隔离，只由测试调用，不在 Worker、浏览器或稳定产品路径生效。
- Scope：PASS；0 次模型/Repair 调用，无 Secret、真实材料、真人、部署或受保护输入修改。
- Classification：`contract_fixture / simulation_only`；`real_gt`、模型配对和 `human_eval` 均 `NOT_RUN`。

## G. 对抗审查结论

四轮 fresh same-family/provisional 审查先后拒绝 `facts-1.1`、`facts-1.2`、`facts-1.3` 和 `facts-1.4`。修补关闭了最初的字段串借、状态矛盾、sourceId 默认值、数量子串、简单否定、描述外源、事件时间类型与 optional 依赖勾选，但最终仍可通过并列实体、回指取消、扩张 rawText、实体子串和名词化动作制造 selected 错误事实。

第一性原理结论：来源中出现一段文字，只能证明“文字存在”，不能仅靠正则证明“该字段属于这个任务/材料/事件”。继续扩充词表会同时增加漏拒和误拒，不能成为商业级安全门。

## 决策

- `facts-1.4`: `REJECT_CANDIDATE`。
- RCO-5-002：`TECHNICAL REPAIR FAIL`，不是质量失败或模型结论。
- B1/B4：`NOT_RUN`；在基础契约仍可错误选中时不花模型预算。
- RCO-6：`BLOCKED_BY_RCO_G5 / NOT_STARTED`。
- 下一步架构门：evidence 增加由本机解析器验证的字符 span/句段 ID；字段关系携带 typed assertion 与 relation span；无法由确定性规则验证的关系保持 unlinked、unselected、needsConfirmation。该 Schema 变更需新的明确授权，且完成后仍需重新零调用审查。

审查轨迹：`.aris/traces/experiment-audit/2026-09-02_run03/` 至 `run06/`。轨迹保存最终结论与限制，不声称保存内部思维链。
