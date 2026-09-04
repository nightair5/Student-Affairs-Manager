# RCO-5-008 本机动作头、完整命题语义与安全评分计划

**Problem**：B7 模型找到了 18/18 个行动对象，但 10/18 个 action 吞入了“请、须、不得、可自行、要求是”等语气词。冻结 P3 依赖模型 action 之前的文字判断语义，导致可选任务被默认勾选、禁止动作被解释为肯定要求。

**Primary claim**：模型只需提供 scope、动作候选和对象；本机可用受控动作表确定最小动作头，并从完整命题独立判断否定、可选、条件、时态和默认勾选。

**Supporting claim**：修订关系可以按不可变 scope 与本机 task ID 评分，不必依赖动作字符串逐字相等。

**Anti-claim**：不得通过修改 B7 Expected、删除失败案例、放宽旧门槛或再次调用模型制造提升。

## 范围

- 新增 `modelAnchorLocalComposerV2`，不修改冻结的模型输出 Schema。
- 新增 P4 本机策略，不修改冻结 P3。
- 新增 scope/对象感知的评分与“禁止默认勾选假阳性”指标。
- 使用 B7 已有 raw result 做一次 0 调用回放。
- B7 回放过门后才能创建并冻结全新 B8；本轮不调用 B8 模型。
- 不接稳定路径、不启动 RCO-6、不部署。

## 固定实现原则

1. 动作头只能来自版本化受控动作表；匹配不到或同时命中多个动作时失败关闭，不无限放宽。
2. 原始 action 只保留在诊断中，不能覆盖原文；任务 action 使用本机最小动作头。
3. 否定、可选、强制和完成状态读取完整命题及本机动作位置，不依赖模型选择的 action 起点。
4. 条件事实只在命题归一化唯一匹配时自动挂接；零个或多个冲突候选保持 unknown。
5. 修订评分优先用 proposition scope 与对象绑定 Expected ID，动作完全匹配另行计分。
6. 任何 Expected-default-false 任务被 `selected=true` 都单独计为 unsafe false positive。

## B7 零调用回归门槛

| 指标 | 门槛 |
|---|---:|
| 合法输入 / P4 合同 | 12/12 |
| action exact / object exact | 各 100% |
| scope F1 | 100% |
| Task F1 / requiresAction / Complete Task Case | 各 100% |
| unsafe default false positive | 0 |
| cancels / supersedes / amends | 各 100% |
| 旧要求失效 / 新要求生效 / 歧义保持 unresolved | 各 100% |
| model calls / network / Repair / retry | 0 / 0 / 0 / 0 |

B7 是已见回归集，即使全通过也只能证明本机修复覆盖已知失败。B8 首次盲测才检验泛化。

## 执行顺序

1. 冻结本计划与既有 B7 输入哈希。
2. 实现受控动作头、条件事实挂接、P4 完整命题语义和评分器。
3. 属性变形与对抗测试：语气词吞入 action、复合动作、条件真/假/冲突、否定本地动作、可选动作、第三人对象词、修订 ID 映射。
4. 回放 B7 原始输出并生成结果、报告和冻结清单。
5. 只有 B7 全门通过，才创建与 B0-B7 不重复的 B8 并冻结；停止等待单独付费授权。
