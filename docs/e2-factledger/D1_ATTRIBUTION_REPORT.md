# E2.5 D1：30 条失败案例人工归因

## 结论

本报告只使用已暴露的 Development、Golden 和 Exposed Holdout 作为诊断材料，不把任何样例重新定义为 Blind，也没有修改冻结标准答案。核对基线为提交 `8ae655e`、Prompt `recognition-2.4.1`、模型 `deepseek-v4-flash`。

30 条中，5 条（16.7%）的主要问题是原文义务/事件事实没有进入当前结构化输出；14 条（46.7%）的主要问题是事实已被发现，但 Task、Milestone、TimePoint、Event、条件或关系规划错误；11 条（36.7%）主要是合理等价结构或评分契约问题。排除这 11 条评测/等价结构争议后，在 19 条真实产品错误中，Planner 侧占 14/19（73.7%），Fact discovery 侧占 5/19（26.3%）。

这只支持“优先隔离事实发现与规划进行实验”的方向，不足以提前判定 FactLedger 值得正式实施。

## 选择规则与证据

- Development：从 108 条已暴露开发集的失败中选择 10 条，覆盖材料角色、时间角色、Event/Task、变更通知、OCR、相对时间和同日多步骤。
- Golden：选择全部 10 条 `complex_notice` 失败案例，避免主观挑选其中表现最差的子集。
- Exposed Holdout：选择 10 条失败，覆盖课程、比赛、申请、模糊时间、复杂通知和截止变更。
- 原文与标准结果来自冻结 TypeScript 数据集；当前输出来自同一仓库 Git 忽略缓存中的 `g8-*-2-4-1` DeepSeek 运行；提交中只保存人工摘要，不提交原始模型缓存。
- 逐例完整字段、证据和判断理由见同目录 `d1-attributions.json`。

## 主标签比例

| 主标签 | 数量 | 比例 |
| --- | ---: | ---: |
| VALID_EQUIVALENT_STRUCTURE | 10 | 33.3% |
| FACT_MISSING | 5 | 16.7% |
| TIME_ROLE_ERROR | 5 | 16.7% |
| FACT_FOUND_PLANNING_WRONG | 3 | 10.0% |
| MILESTONE_ERROR | 2 | 6.7% |
| AMBIGUITY_MISSING | 2 | 6.7% |
| TASK_BOUNDARY_ERROR | 1 | 3.3% |
| EVENT_TASK_CONFUSION | 1 | 3.3% |
| EVALUATION_MISMATCH | 1 | 3.3% |

`ROUTER_UNDER_ROUTED` 和 `VALIDATOR_MISSED` 作为次标签分别出现在零 Task/零 Event 仍通过的样例中。检查到的 Repair 均未删除已发现事实；D1 没有足够证据把任何一条归为 `REPAIR_HARM`。

## 30 条逐例摘要

| 集合 | Case | 主归因 | 错误层 | 真正需要重大修改 | 关键判断 |
| --- | --- | --- | --- | --- | --- |
| Development | e2-gen-01-1 | FACT_FOUND_PLANNING_WRONG | Planning | 否 | 两 Task/时间/歧义正确，问题在项目化和 Material 角色。 |
| Development | e2-gen-03-3 | TIME_ROLE_ERROR | Planning | 是 | 值均正确，报名/提交时间角色和入围条件错误。 |
| Development | e2-gen-05-1 | EVALUATION_MISMATCH | Evaluation | 否 | 零 Task 正确；仅保留公示 Event 被算 Major。 |
| Development | e2-gen-07-1 | EVENT_TASK_CONFUSION | Planning | 是 | 签到事实进入 Event 标题但没有可完成 Task。 |
| Development | e2-gen-10-3 | FACT_MISSING | Fact | 是 | ‘回复’被改成‘参加’。 |
| Development | e2-gen-11-3 | FACT_MISSING | Fact | 是 | 其他材料义务缺失，旧截止未结构化为变更事实。 |
| Development | e2-gen-12-1 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 总 Task + 两 Material 可等价于两个办理步骤。 |
| Development | e2-gen-15-3 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 上位词 Task 覆盖两材料，OCR 时间仍需确认。 |
| Development | e2-gen-20-2 | TIME_ROLE_ERROR | Planning | 是 | 依赖未知结束时刻却生成精确截止。 |
| Development | e2-gen-21-3 | FACT_FOUND_PLANNING_WRONG | Planning | 是 | 三动作证据齐全但零 Task，且 Router/Validator 均漏检。 |
| Golden complex | e2-complex_notice-01 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 同截止报告与记录合并提交。 |
| Golden complex | e2-complex_notice-02 | VALID_EQUIVALENT_STRUCTURE | Planning | 是 | 合并 Task 合理，但报名角色和优秀团队条件错误。 |
| Golden complex | e2-complex_notice-03 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 仅层级/阶段粒度不同，Major=false。 |
| Golden complex | e2-complex_notice-04 | TASK_BOUNDARY_ERROR | Planning | 否 | 马甲作为 Material 已发现，未另建准备 Task。 |
| Golden complex | e2-complex_notice-05 | MILESTONE_ERROR | Planning | 是 | 实体齐全，但入选条件未保留。 |
| Golden complex | e2-complex_notice-06 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 源码和说明书合并同截止提交；Repair 无伤害。 |
| Golden complex | e2-complex_notice-07 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 链接和授权书合并同截止提交。 |
| Golden complex | e2-complex_notice-08 | MILESTONE_ERROR | Evaluation | 否 | 摘要/全文阶段合并，不影响行动。 |
| Golden complex | e2-complex_notice-09 | FACT_FOUND_PLANNING_WRONG | Planning | 否 | 学生行动正确，但保留了其他角色时间。 |
| Golden complex | e2-complex_notice-10 | TIME_ROLE_ERROR | Planning | 是 | 报名/区间角色错误且下午产生假精度。 |
| Exposed Holdout | e2-holdout-02 | FACT_MISSING | Fact | 是 | ‘携带’被改成‘准备’。 |
| Exposed Holdout | e2-holdout-05 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 同截止交付合并，Repair 正确移除假精度。 |
| Exposed Holdout | e2-holdout-10 | TIME_ROLE_ERROR | Planning | 否 | 仅申请截止类型错误，值和实体正确。 |
| Exposed Holdout | e2-holdout-12 | AMBIGUITY_MISSING | Planning | 是 | ‘暂定’丢失，开放日被标为确定。 |
| Exposed Holdout | e2-holdout-18 | FACT_MISSING | Fact | 是 | Event、TimePoint、Ambiguity 全缺，Validator 只补证据。 |
| Exposed Holdout | e2-holdout-22 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 更具体的上传对象因别名不匹配被判 Major。 |
| Exposed Holdout | e2-holdout-24 | TIME_ROLE_ERROR | Planning | 是 | 报名角色与录用者条件错误。 |
| Exposed Holdout | e2-holdout-25 | VALID_EQUIVALENT_STRUCTURE | Evaluation | 否 | 合并 Task/阶段但事实和安全语义完整。 |
| Exposed Holdout | e2-holdout-28 | AMBIGUITY_MISSING | Planning | 是 | 旧/新截止值齐全但变更关系缺失。 |
| Exposed Holdout | e2-holdout-33 | FACT_MISSING | Fact | 是 | ‘回复’被改成‘参加’。 |

## Major Correction 初步核对

当前评分器把 28/30 标为 Major Correction；人工判断只有 15/30 真正需要用户做重大修改。以这 30 条为限：

- Major 标记相对人工判断的 precision：15/28 = 53.6%。
- recall：15/15 = 100%。
- 13/28（46.4%）Major 标记是本次人工审计认定的假阳性，主要来自同截止交付合并、阶段名称/粒度不同、上位词对象和无行动信息事件。

本段是 D1 的初步证据；D2 将审计评分实现与等价规则，不会修改任何冻结 expected。

## D1 边界与下一步

- 未修改 Prompt、Router、Validator、Repair、生产运行代码或 Workspace v8 链路。
- 未创建 Blind，未接触未来 Blind 标准答案。
- D1 落地验证：`npm run lint` 通过；`npm run build` 通过；Vitest 46 个文件、188 项测试通过，但完整 `npm run test` 在随后 3 个冻结源哈希检查处失败。只读诊断确认 Git blob 哈希与冻结 manifest 一致，失败来自 Windows `core.autocrlf=true` 将工作树 LF 转为 CRLF；冻结数据没有 diff。该评测契约兼容问题留给 D2 修复，D1 不改评测代码。
- D1 支持进入 D2 评测契约审计；不支持进入 E3/E4 或部署 Production。
