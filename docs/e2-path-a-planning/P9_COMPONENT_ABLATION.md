# E2.7 P9 逐组件消融报告

## 结论

P9 状态：**COMPLETE — NO CANDIDATE**。

没有任何输出变更组件同时满足“真实 User-impact Major 下降、Task 不回退、Evidence/Safety 不回退、成本与收益匹配”的净收益规则。A6 Repair R2 在部分严格指标上有收益，但 Task Precision / Recall 保持在 80.00% / 67.80%，未解决主导缺失任务问题；其变更输出也没有新的独立 User-impact 盲评。因此不得冻结 Candidate，也不得创建 P11 Blind。

## 证据边界

- A0、A4、A5、A6 使用同一组 80 条已暴露诊断样例；A0 与 A6 是真实配对结果。
- A2 使用冻结的 72 条 P2B 样例；A3 使用 108 条 Development。跨样本阶段只用于组件决策，不能伪装成同一 80 条的逐级因果曲线。
- 所有集合均为 exposed / development / regression，不是 Blind。
- User-impact Major 只对旧 P2B 输出做过人工评审；A6 改变后的输出为 `NOT RUN`，Strict Major 不替代 User-impact Major。

## 组件对比

| 阶段 | 组件 | 增量收益 | 增量风险 | 延迟 / Token 增量 | 决策 |
| --- | --- | --- | --- | --- | --- |
| A0 | 当前 Path A，Repair 关闭 | 80 条真实基线 | Task R 67.80%，Time Value 73.57%，Event 84.62% | 7727 / 13013 ms；189215 / 121108 tokens | Reference |
| A1 | 新评测契约 | 分离 Strict、Semantic、User-impact，防止严格结构误判冒充用户重大修改 | 不改变输出；仍是暴露诊断 | 0；0 / 0 | 保留为评测基础设施，不是运行时组件 |
| A2 | PlanningNormalizer 1.0.0 | 72 条中 0 条改变，Harm 0% | 没有实际收益，却增加转换边界 | 均值 0.094 ms；0 / 0 | 不进入 Candidate |
| A3 | Prompt Planning Contract | RC1 Task R +5.71pp | RC1 Event -29.23pp；RC2 Task/Time/Evidence/Severe/Transport 均回退 | 候选调用已单独报告；保留路径无增量 | 两轮均拒绝，保留 2.4.1 |
| A4 | Router 1.2.0 | Accuracy 97.50%，Complex Recall 100%，Under-routing 0% | 80 条均仍走 `single_pass`，没有可归因质量增益；暴露标签可能过拟合 | 独立延迟不可观测；0 模型 Token | 仅保留诊断分类，不启用 intensive 路径 |
| A5 | Validator 2.2.0 | Micro P/R 94.29% / 88.00%；Wrong Time Role R 91.67%；Missing Ambiguity R 100% | INVALID_EVIDENCE Recall 0%；仅告警，不直接改善输出 | 独立延迟不可观测；0 模型 Token | 保留非变更诊断层，不计 Candidate 净收益 |
| A6 | Repair R2 | Material R +4.46pp；Time Value +2.86pp；Event +5.13pp；Evidence +0.59pp；Ambiguity R +14.89pp；Strict Major -6.25pp | Task P/R 均 +0；Ambiguity P -0.73pp；User-impact 未重新评审 | Repair 2606 / 3917 ms；全路径均值 +782 ms；+94034 / +5380 tokens | 不进入 Candidate / 不设为默认 |

## A0 与 A6 严格指标

| Metric | A0 | A6 R2 | Delta |
| --- | ---: | ---: | ---: |
| Task Precision | 80.00% | 80.00% | 0.00pp |
| Task Recall | 67.80% | 67.80% | 0.00pp |
| Material Recall | 95.54% | 100.00% | +4.46pp |
| Time Role Accuracy | 80.00% | 80.00% | 0.00pp |
| Time Value Accuracy | 73.57% | 76.43% | +2.86pp |
| Event Accuracy | 84.62% | 89.74% | +5.13pp |
| Evidence Coverage | 97.35% | 97.94% | +0.59pp |
| Evidence Validity | 100.00% | 100.00% | 0.00pp |
| Ambiguity Precision | 73.81% | 73.08% | -0.73pp |
| Ambiguity Recall | 65.96% | 80.85% | +14.89pp |
| Strict Major | 66.25% | 60.00% | -6.25pp |
| User-impact Major | NOT RUN | NOT RUN | NOT RUN |
| Severe Error | 0.00% | 0.00% | 0.00pp |
| Repair Harm | N/A | 0.00% | 0.00pp |

## Candidate 门槛预检

A6 明确未达到：

- Task Strict Precision ≥ 82%：**失败，80.00%**；
- Task Strict Recall ≥ 80%：**失败，67.80%**；
- Time Value Accuracy ≥ 80%：**失败，76.43%**；
- Task Semantic P/R：A6 未重新运行，**NOT RUN**；
- User-impact Major ≤ 30%：A6 未重新盲评，**NOT RUN**。

Material、Time Role、Event、Evidence、Severe、Duplicate、Over-fragmentation 和 Repair Harm 达标，不能抵消上述硬门槛失败。

## P9 决策

1. 保留评测契约作为离线评测基础设施。
2. PlanningNormalizer 没有实证收益，不作为 Candidate 组件。
3. Prompt 保持冻结的 `recognition-2.4.1`，不得开启第三轮规则堆叠。
4. Router 只保留已校准的诊断分类能力；不启用未验证的 intensive 路径。
5. Validator 只保留非变更告警能力；不得把 Validator 指标描述成识别质量提升。
6. Repair R2 仅保留实验历史，不接入默认路径。
7. P10 必须记录 Candidate Freeze 不成立；P11/P12 不得运行。

没有修改 Golden、Holdout、Development expected；没有修改 Workspace v8、Repository、Migration、DomainCommitPlan；没有进入 E3/E4；没有部署 Production。
