# E2 Generalization Failure Audit

状态：`G1 COMPLETE — NO PROMPT CHANGE`

本报告只审计第一轮候选 `b7f6be8`。它不修改 Golden、旧 Holdout、Prompt、Router、Validator、Repair、模型或运行时。原 110 条 Golden 从本轮起称为 Development Regression Set；原 40 条 Holdout 从本轮起称为 Exposed Regression Set，二者均不再承担最终 Blind Gate。

## 1. 冻结基线

| 项目 | 值 |
| --- | --- |
| 基线分支 | `codex/e2-recognition-v2` |
| 基线提交 | `b7f6be8a12c0d8cf24cca32005250d43468367cb` |
| Prompt | `recognition-2.3.0` |
| Pipeline | `recognition-pipeline-2.1.2` |
| Validator | `recognition-quality-2.0.0` |
| Repair | `recognition-repair-1.0.0` |
| Router | `recognition-router-1.0.0` |
| 模型 | `deepseek-v4-flash` |
| Golden checkpoint SHA-256 | `2448246D89B5A86E33C7BF96942C433E4486A02C0AD9263F6425C6FBA1FA928C` |
| Exposed Holdout checkpoint SHA-256 | `1B2523633D45C7667F4ED4B6D70EF5B19DBEC3210616E89F76F23B62DC54B0E3` |

复现命令：

```powershell
node_modules\.bin\vite-node.cmd scripts\audit-e2-generalization.ts
```

该命令只读 Git 忽略的逐例 checkpoint，输出完整 JSON 审计结果，不写入测试答案或产品数据。

## 2. Golden 与 Exposed Holdout 差异

| 指标 | Golden 110 | Exposed Holdout 40 | 差值 |
| --- | ---: | ---: | ---: |
| Project Decision | 97.27% | 95.00% | -2.27 pp |
| Milestone Precision | 59.26% | 66.67% | +7.41 pp |
| Milestone Recall | 21.92% | 48.28% | +26.36 pp |
| Task Precision | 86.61% | 70.69% | **-15.92 pp** |
| Task Recall | 86.61% | 77.36% | **-9.25 pp** |
| Material Precision | 93.40% | 98.15% | +4.75 pp |
| Material Recall | 98.02% | 100.00% | +1.98 pp |
| TimePoint Accuracy | 91.67% | 78.69% | **-12.98 pp** |
| Event Accuracy | 91.30% | 82.35% | **-8.95 pp** |
| Evidence Coverage | 98.05% | 95.63% | -2.42 pp |
| Ambiguity Precision | 34.04% | 88.89% | +54.85 pp |
| Ambiguity Recall | 59.26% | 66.67% | +7.41 pp |
| Duplicate | 0.00% | 0.00% | 0.00 pp |
| Over-fragmentation | 0.00% | 0.00% | 0.00 pp |
| Major Correction | 30.91% | 60.00% | **+29.09 pp** |
| Severe Error | 0.00% | 2.50% | **+2.50 pp** |
| Request Failure | 0.00% | 2.50% | +2.50 pp |

结论：泛化下降集中在 Task、TimePoint、Event 和最终可用性；Material、Milestone 与 Ambiguity 并未同步下降。不能把本轮问题笼统归因于“所有实体都识别不好”。

## 3. Per-category 证据

Exposed Holdout 中任务质量最弱的组：

| 组 | Task P | Task R | 其他显著问题 |
| --- | ---: | ---: | --- |
| scholarship | 25.00% | 50.00% | 将材料说明组织成了错误或多余动作 |
| material | 33.33% | 33.33% | Material 本身召回 100%，但 Task 规划失败 |
| application | 57.14% | 80.00% | TimePoint Accuracy 66.67% |
| vague_time | 66.67% | 50.00% | TimePoint 20.00%，Event 0.00% |
| competition | 75.00% | 75.00% | 任务边界仍不稳定 |
| complex_notice | 76.92% | 90.91% | Recall 尚可，Precision 与层级质量不足 |

Exposed Holdout 逐例错误数量以 `task_missing=12`、`task_spurious=11`、`milestone_missing=15`、`time_missing=8`、`evidence_missing=8`、`ambiguity_missing=8`、`event_missing=3` 为主。它显示“漏事实”和“错误规划”同时存在，但 Task 的一进一出式错误尤其突出。

## 4. Router 审计

冻结数据没有人工编写的 Router 标签。审计工具因此只提供一个风险代理标签：当任务/时间不少于 3、事件不少于 2、材料不少于 4、实体负荷不少于 10，或多歧义与多时间并存时视为 Complex；多实体或有歧义时视为 Medium；其余为 Simple。这个结果不能冒充真实 Router Accuracy，但可以比较 under-routing 风险。

| 数据集 | 代理一致 | Under-route | Over-route |
| --- | ---: | ---: | ---: |
| Golden | 69/110 | 40/110（36.36%） | 1/110（0.91%） |
| Exposed Holdout | 14/40 | **24/40（60.00%）** | 2/40（5.00%） |

Exposed Holdout 中存在 4 条 `Complex → Simple`、5 条 `Complex → Medium`、15 条 `Medium → Simple`。按实际路由分组：

| 实际路由 | 样本 | Task P | Task R | TimePoint | Event | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Simple | 24 | **57.14%** | **64.00%** | 73.08% | **57.14%** | 93.10% |
| Medium | 12 | 90.00% | 90.00% | 78.26% | 100.00% | 98.44% |
| Complex | 3 | 70.00% | 87.50% | 91.67% | 100.00% | 96.88% |
| Unknown（请求失败） | 1 | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% |

Router 当前只统计文本长度、固定日期/动作词、列表、更正和少量条件词；没有材料角色、事件数量、表格、附件、跨段引用或歧义密度。`Simple` 路由上的明显低质量与 60% under-routing 风险共同证明 Router 是主要泛化根因之一。

## 5. Validator 审计

Validator 当前依赖固定 `ACTION_VERBS`、`DATE_TOKEN`、`MATERIAL_CUE`、`EVENT_CUE`。在最终结果上重新运行 Validator，并将其 issue code 与评测器可映射的错误类别做逐例集合比较，得到以下粗粒度代理：

| 数据集 | Issue Precision | Issue Recall | TP / Predicted / Expected |
| --- | ---: | ---: | ---: |
| Golden | 5.00% | 1.64% | 1 / 20 / 61 |
| Exposed Holdout | 0.00% | 0.00% | 0 / 11 / 39 |

该代理不是正式 Validator 基准：旧 checkpoint 没有保存 Repair 前完整结果，也没有保存全部原始 Validator 报告；不同评测错误到 Validator code 的映射也不是一一对应。但它足以证明当前 Validator warning 与最终语义失败之间缺少可验证的一致性。下一阶段必须为 Validator 建立独立标注和真正的 warning precision/recall，不能以“触发了 Repair”代替检测正确。

## 6. Repair 审计

| 数据集 | Attempted | Applied | Error | Repair 后仍 Major | Repair 后 Severe |
| --- | ---: | ---: | ---: | ---: | ---: |
| Golden | 17 | 5 | 0 | 5 | 0 |
| Exposed Holdout | 9 | 6 | 0 | **5** | 0 |

Exposed Holdout 的 Repair issue 以 `FALSE_PRECISION=5`、`MISSING_TIMEPOINT=5`、`MISSING_MATERIAL=1` 为主。9 次 Repair 中有 6 次改变结果，但最终仍有 5 例需要 Major Correction。

`Repair Semantic Success Rate` 与 `Repair Harm Rate` 在旧工件中均为 **NOT OBSERVABLE**：Worker 只落盘最终结果和 `applied`，未保存 Repair 前结果；`applied=true` 不等于语义改善。G6 必须保存 before/after 评分，并限制允许修改的字段后再计算成功与伤害，禁止从现有数据猜测。

## 7. 八个审计问题的回答

1. **复杂通知是否被错分为 Medium/Simple？** 是。风险代理显示 Exposed Holdout 60% under-route，且 Simple 路由 Task P/R 仅 57.14%/64.00%。
2. **陌生时间表达是否更易遗漏？** 是。Golden `time_missing=1`，Exposed Holdout `time_missing=8`；TimePoint Accuracy 下降 12.98 pp。
3. **Material 是否依赖固定关键词？** 当前证据不支持。Exposed Holdout Material P/R 为 98.15%/100%；真正失败集中在材料与动作的规划关系。**AUDIT ASSUMPTION INVALIDATED**。
4. **Milestone 是否依赖固定比赛/申请模板？** 未得到充分证据。Holdout Milestone Recall 反而高于 Golden，但两组绝对召回都不理想；现有 Prompt 使用固定阶段名称，仍需在新开发集按结构变体验证，不能先下结论。
5. **Repair 是否在修复同时引入错误？** 旧工件无法测 Harm。能确认的是 9 次 Holdout Repair 后仍有 5 次 Major；不能把 `applied` 当成功。
6. **Validator 是否对 Golden 模式敏感？** 是，且更严重：它与两组最终语义错误都缺少稳定对应。固定词表和正则无法覆盖陌生句式。
7. **Complex 两阶段是否优于单次？** **NOT RUN / NOT OBSERVABLE**。第一轮所有候选实际 `selectedStrategy=single_pass`；必须在新 Development Set 做受控 A/B 后才能决定是否启用。
8. **Prompt 是否因大量规则/示例学习形式？** Prompt 没有大量完整 Golden few-shot，故“示例污染”假设不成立；但存在高密度输出约束、固定动作词和固定阶段命名，事实发现与规划仍在同一调用中竞争注意力。**AUDIT ASSUMPTION PARTIALLY INVALIDATED**。

## 8. 根因结论

### Root Cause A — Router 对陌生结构 under-route

Router 把固定词表和文本长度当主要复杂度代理，未识别“少典型动词但多语义角色”“材料先于动作”“多事件/条件/跨段引用”等结构。24/40 的风险代理 under-route 与 Simple 路由低质量构成直接证据。

### Root Cause B — Fact extraction 与 Planning 仍在同一生成任务中竞争

Material 在 Holdout 保持近满分，而 Task P/R 明显下降，说明模型常常看到了对象，却没有稳定决定“是否形成任务、如何合并动作、怎样关联事件”。这更像规划边界失败，而不是普遍事实识别失败。

### Root Cause C — Task 规则过度依赖显式动作词

Prompt 要求“只保留原文逐字出现动作词”，Validator 也只接受固定 `ACTION_VERBS`。被动表达、无典型动词的义务、条件适用和材料导向句式容易漏 Task；说明性句子又可能被规划为伪动作。

### Root Cause D — TimePoint 发现与语义角色判断耦合过紧

旧 Pipeline 对熟悉表达表现好，但陌生表达出现 8 个 time missing，并在模糊时间组降至 20%。日期发现、语义角色、归一化和歧义处理没有分成可独立验证的步骤。

### Root Cause E — Validator/Repair 缺少可观测闭环

Validator issue 与评测错误相关性很弱，Repair 又不保存 before 结果，导致系统无法知道“为何触发、修了什么、是否伤害”。工程上已有一次性 Repair 边界，但质量反馈闭环尚未成立。

### Root Cause F — Event 与 Task 边界在 Simple 路由不稳定

Simple 路由 Event Accuracy 仅 57.14%，整体 Holdout Event 下降 8.95 pp。活动、面谈、培训、纯信息时段与用户准备动作的边界需要 facts-first 角色标注，而不是只靠“参加/举行”等触发词。

## 9. G2–G7 的证据化约束

- 新 Development Set 必须重点增加无典型动作词、被动语态、材料先行、时间先行、事件与动作混合、模糊时间、纯信息和结构变体；不能只追加比赛模板。
- Facts-first 先保存 action/object/material/time/event/condition/evidence 等事实角色，再做最小结构规划；Simple 保持单次调用，Complex 两阶段必须先经 Development A/B 证明收益。
- Router 应加入时间表达、材料角色、动作角色、Event、列表/表格、附件、条件、歧义和跨段引用等结构特征；报告 under-route 与 over-route 成本。
- Validator 必须建立独立 issue labels，测 warning precision 与 recall；只能 detect，不能 invent。
- Repair 必须保存 before/after、allowed fields、issue-scoped patch 与评分差异，最多一次；无法改善时保留原结果并标记 needsReview。
- 所有开发修改继续回归旧 Golden 和 Exposed Holdout，但最终成功只由候选冻结后的全新 Blind Test 决定。

## 10. 当前判定

`G1 COMPLETE`

当前仍为 `E2 BLOCKED / E3 NOT READY / PRODUCTION FORBIDDEN`。可以进入 G2 建立 Generalization Development Set；此时尚未修改任何识别 Prompt 或运行时行为。
