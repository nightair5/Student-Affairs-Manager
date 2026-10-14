# RCO-5-002 零调用契约修补报告

**日期**：2026-09-02
**范围**：确定性 facts-first 候选、匿名契约回归与新鲜审查；不接稳定路径，不调用模型，不部署
**结论**：`TECHNICAL REPAIR FAIL / REJECT_CANDIDATE / RCO-G5 QUALITY NOT_RUN / NO_PROMOTION / DO_NOT_LAUNCH`

## 修补内容

- `sourceId`、`sourceContent`、reference time 与 IANA timezone 在 compose 前必填并 fail-closed。
- `requiresAction=false + explicit event` 拒绝；optional 任务的时间、材料、项目匹配不再自动勾选。
- 保留有限标准动作和校园常见别名；未知动作拒绝。
- 时间、材料、约束、事件地点、description、数量和必填性增加来源与关系校验。
- 内部 quality 不自报覆盖率或日期正确率，固定要求人工复核。
- 54 个匿名 contract fixtures 覆盖历史审查反例与 15 个校园动作；它们不是模型或真实材料 ground truth。

## 四轮新鲜审查

| 候选 | 结论 | 主要发现 | 冻结/轨迹 |
|---|---|---|---|
| `facts-1.1` | FAIL | 分离 evidence 可跨实体串借，缺 sourceContent 可绕过 | `RCO-5_REPAIR_COMPONENT_FREEZE.json` / `run03` |
| `facts-1.2` | FAIL | 合并为单 quote 后可跨句串借；否定、数量、description 等仍有缺口 | `RCO-5_REPAIR_V2_COMPONENT_FREEZE.json` / `run04` |
| `facts-1.3` | FAIL | 同分句相邻实体、远距离取消与日期角色仍可串借 | `RCO-5_REPAIR_V3_COMPONENT_FREEZE.json` / `run05` |
| `facts-1.4` | FAIL | 受控词面关系仍可被并列、回指、子串与 rawText 扩张绕过 | `RCO-5_REPAIR_V4_COMPONENT_FREEZE.json` / `run06` |

全部审查均为 fresh same-family / ultra / read-only / provisional；未接触模型端点、Secret、真实材料、部署或受保护评测输入。详细结论见 `RCO-5_REPAIR_EXPERIMENT_AUDIT.md` 与 `.json`。

## 第一性原理结论

`quote ∈ sourceContent` 只证明文字存在；即使再加句界和正则，也不能证明“字段 A 属于实体 B”。继续扩充例外词表会同时制造漏拒和误拒，不足以承担商业产品的自动选中门。

所以下一步不是付费调模型，而是把 provenance 从“字符串引用”升级为：

1. 本机解析器生成、可复核的字符 span/句段 ID；
2. 每条字段关系带 typed assertion 和 relation span；
3. 确定性校验无法证明归属时，关系保持 unlinked、unselected、needsConfirmation；
4. 新 Schema 先做零调用反例门，通过后才运行 B1 同输入配对。

该架构变更不在本轮授权内。本轮到此失败封存，不运行 B1/B4，不启动 RCO-6。RC.4、Release、Production、稳定模型和默认文字路径均不变。
