# Student Affairs Manager Product v2.0 — E2.5 FactLedger Diagnostic

## Final status: DIAGNOSTIC INCONCLUSIVE

E2 继续保持 `BLOCKED`，E3 与 Production 继续保持 `NOT READY`。本阶段没有接入生产默认路径，没有修改 Workspace v8、Repository、Migration、DomainCommitPlan、Capture/Commit、冻结 expected 或任何站点部署。

在本次选定的 30 条已暴露失败案例中，人工归因支持“错误主要位于 B：事实已发现后的结构规划”：排除 11 条合理等价/评分契约争议后，19 条人判真实产品错误中 Planning 为 14 条（73.7%），Fact discovery 为 5 条（26.3%）。该比例不能外推到全部通知。B 路径的真实 DeepSeek 调用因服务端 Secret 未配置而 `NOT RUN`，所以不能声称 FactLedger 两阶段已经优于单次识别，也不能否定它。

## 1. 30 条人工归因结果

逐例完整记录见 `d1-attributions.json`，包含原文明示事实、当前输出、标准结果、错误层、用户重大修改判断、证据和理由。样例构成为：

- Development 失败 10 条；
- Golden `complex_notice` 10 条；
- Exposed Holdout 失败 10 条。

全部样例均已暴露，只具有诊断/回归资格。

## 2. 错误类型比例

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

按错误层聚合：Planning 14/30（46.7%）、Fact discovery 5/30（16.7%）、Evaluation/equivalence 11/30（36.7%）。

## 3. Major Correction 评测审计

当前 strict scorer 把 28/30 标为 Major，人工判断仅 15/30 真正需要重大修改：

- Precision：53.6%（15/28）；
- Recall：100%（15/15）；
- 假阳性：46.4%（13/28）。

主要假阳性来自同截止/同渠道材料被合并成一个 Task、阶段名称或粒度差异、上位词对象、以及无行动信息 Event。D2 新契约保留全部冻结标准事实，同时把 `strict structural score`、`semantic equivalence score` 与 `human-impact Major Correction` 分开，不允许通过修改 expected 刷分。

三份 `recognition-2.4.1` 暴露缓存共 258 条（257 条 completed），29 次 Repair attempt 均可由 beforeResult 重新评分，24 次 applied；按修正后的 strict scorer，Repair Success 6.90%、Harm 0%。这只能说明缓存中未观察到 strict-score harm，不能替代 human-impact harm 审计。

## 4. FactLedger Contract

中间层 schema 为 `e2.5-fact-ledger-1.0.0`，至少显式表达：obligation、action predicate、object、material、time expression、time role、event、condition、constraint、modality、ambiguity、evidence。

关键不变量：

- 只记录“原文明确说了什么”，不设计 Project/Milestone/Task；
- 每项事实引用逐字 evidence，并验证字符偏移；
- relative/vague/unknown 时间不得制造精确值；
- 更正通知用 supersedes 关系表达；
- Event 不得吞掉签到、回复、提交等 obligation；
- 不写 Workspace v8，不成为新业务数据库。

## 5. FactLedger → Planner 架构

```text
Stage 1 Fact Extraction
  -> strict FactLedger parse
  -> evidence/reference/time-safety validation
  -> Stage 2 Planner
  -> existing RecognitionResult 2.0 parser
  -> same diagnostic scorer
```

Ledger invalid 时该例停止，不调用 Planner。Planner 只获得已验证 Ledger view 与 evidence quote，不读取 expected，也不能制造 Ledger 中没有的新事实。该路径只能由显式诊断命令运行；生产 `pipeline.ts` 与默认 Runtime 没有导入它。

## 6. A/B 实验结果

选择 24 条已暴露复杂样例：10 Development、10 Golden complex、4 Exposed Holdout complex。

| Metric | A recognition-2.4.1 | B FactLedger → Planner |
| --- | ---: | ---: |
| Fact Recall | NOT OBSERVABLE | NOT RUN |
| Task Precision | 81.40% | NOT RUN |
| Task Recall | 61.40% | NOT RUN |
| Material Precision / Recall | 98.04% / 98.04% | NOT RUN |
| TimePoint Type / Value Accuracy | 78.95% / 82.89% | NOT RUN |
| Milestone Precision / Recall | 59.09% / 50.00% | NOT RUN |
| Event Accuracy | 100.00% | NOT RUN |
| Ambiguity Precision / Recall | 70.83% / 73.91% | NOT RUN |
| Evidence Coverage | 99.28% | NOT RUN |
| Major Correction | 83.33% | NOT RUN |
| Severe Error | 0.00% | NOT RUN |

B 为 `NOT_RUN / DEEPSEEK_NOT_CONFIGURED`。A 已通过可复现脚本从原始输出重算，结果中绑定三份 raw cache 的 SHA-256；空 alias 评分缺陷修复前后这 24 条数值一致。没有用 mock、local fallback、A 输出变换或人工 Ledger 代替，因此所有架构门槛 delta 都是 `NOT COMPUTABLE`。

## 7. Router 标签与准确率

独立人工标签 60 条：simple 10、medium 22、complex 28。

- Accuracy：45.00%（27/60）；
- 全部 under-routing：48.33%（29/60）；
- Complex → Simple：3.57%（1/28）；
- Simple → Complex：0%（0/10）；
- 另有 Complex → Medium 15/28、Medium → Simple 13/22。

当前 Router 对依赖时间、条件链、更正关系和 Event/Task 关系的语义复杂度不敏感。

## 8. Validator 标签与 Precision/Recall

独立人工多标签集 60 条：36 条 `NO_ISSUE`，24 条正例共 37 个 issue。

- Micro Precision：50.00%（6/12）；
- Micro Recall：16.22%（6/37）；
- NO_ISSUE specificity：83.33%（30/36）。

| Issue | Precision | Recall |
| --- | ---: | ---: |
| MISSING_TASK | 100.00% | 44.44% |
| MISSING_TIMEPOINT | 16.67% | 33.33% |
| WRONG_TIME_ROLE | 0.00% | 0.00% |
| MISSING_AMBIGUITY | 0.00% | 0.00% |
| EVENT_TASK_CONFUSION | 100.00% | 25.00% |

这证明 Repair trigger 不能作为 Validator 正确性代理。

## 9. 延迟与 Token 对比

| Metric | A | B |
| --- | ---: | ---: |
| Mean latency | 11,299 ms | NOT RUN |
| P50 / P95 | 11,313 / 17,055 ms | NOT RUN |
| Input tokens total | 91,814 | NOT RUN |
| Output tokens total | 54,481 | NOT RUN |
| Mean input/output per case | 3,825.58 / 2,270.04 | NOT RUN |
| Cost | NOT OBSERVABLE | NOT RUN |

Token 来自真实上游 usage，没有用字符数估算；因 B 未运行，不能判断两阶段延迟与 Token 代价。

## 10. 是否值得正式实施两阶段架构

目前只值得继续完成隔离实验，不允许建议正式实施。原因是 D1 对规划侧主导的诊断证据较强，但用户定义的五项 A/B 门槛全部不可计算：Task Recall 增益、Major Correction 降幅、Task Precision、Evidence Coverage 与 Severe Error delta 均无 B 观测值。

最终状态因此只能是 `DIAGNOSTIC INCONCLUSIVE`。

## 11. 修改文件

- 文档与机器可读结果：`docs/e2-factledger/**`；
- 隔离 FactLedger：`src/recognition/e2/factLedger/**`；
- 诊断命令与标签测试：`scripts/run-factledger-ab.mjs`、`scripts/summarize-factledger-d5.mjs`、`scripts/audit-factledger-d6.mjs`、`scripts/factledger-d6-labels.node.mjs`；
- 冻结校验兼容：`scripts/recognition-e2-dataset-freeze.mjs` 只统一 CRLF/LF 后计算 hash，没有改数据或 manifest；
- `package.json` 只增加显式诊断/标签校验命令。

未修改生产识别实现、Workspace v8、Repository、Migration、DomainCommitPlan、Capture/Commit 或冻结数据集标准答案。

## 12. 测试结果

- `npm run lint`：PASS；
- `npm run test`：PASS，Vitest 48 files / 197 tests；冻结/标签 Node tests 8；server 8；Cloudflare Worker 25；Functions 5；
- `npm run build`：PASS；
- D6 诊断重放：PASS，60 Router + 60 Validator 标签均唯一、合法且缓存 Prompt/模型一致；
- B 启动检查：预期退出码 2，`NOT_RUN / DEEPSEEK_NOT_CONFIGURED`。
- Fresh-agent 实验完整性审计：`WARN / provisional`；未发现虚构结果或分数归一化欺诈，可修复的 checkpoint/provenance 问题已关闭，剩余警告来自 exposed synthetic scope、单一标注者、B 未运行和 strict scorer 限制。

## 13. Git 状态

开发分支为 `codex/e2-factledger-diagnostic`，阶段提交均已推送到同名 origin 分支。最终报告提交后的 HEAD 与 clean 状态以最终交付回执为准。

## 14. 剩余风险

1. 关键风险是 B 路径没有真实模型观测，不能作架构收益判断。
2. 60 条 Router/Validator 标签全部来自已暴露集，是 human diagnostic，不是泛化证据。
3. D1 只有 30 条人工归因，比例存在选择与标注者偏差，尚无双人一致性统计。
4. 当前 strict scorer 的结构别名会扭曲 Major 与 Repair Success；语义契约已设计但尚未替换正式评分器。对 `normalizedLocal=null / needsConfirmation=false` 的 expected 也无法验证具体非空时间值。
5. Router/Validator 的低指标揭示生产缺口，但本阶段按约束没有修改它们。
6. A 的 Fact Recall 不可观测；无法直接计算事实发现与规划的逐例条件概率。
7. 当前 legacy A cache 没有调用时 source hash；未来真实配对 B 必须重跑 A，不能把事后派生 hash 当作来源证明。
8. 即使后续 B 过门槛，也仍需新的合法未见评测与浏览器 A–J 回归，不能直接部署。

## 15. 下一步建议

只建议在隔离环境中补齐 D5，不进入 E3/E4：

1. 由安全服务端进程临时提供 `DEEPSEEK_API_KEY`，用已冻结的 24 条选择、同模型与现有 Harness 运行 B；
2. 保存 Stage 1 Ledger validation、Stage 2 输出、逐例 scorer、真实 latency/usage，不做隐藏重试；
3. 同时应用 D2 的 strict/semantic/human-impact 三套结果，不修改 frozen expected；
4. 按用户门槛一次性判定 Recommended / Not Recommended；未过即停止，不增加 Prompt 规则；
5. 若 B 通过，也只形成后续正式实施提案，仍需新的未见集和完整浏览器回归才能解除 E2 BLOCKED。

STOP：不自动进入下一阶段，不部署 Production。
