# Candidate13 D6 实验完整性审计

结论：`WARN / REJECT_DECISION_SUPPORTED`。现有证据支持保守结论`REJECT_CANDIDATE13_DEVELOPMENT`；未发现结果替换、自归一化、隐藏重试、预算越界或绕过冻结门槛。

本审计由未参与D6实现的同系列模型审计员只读完成，属于`provisional`工程复核，不是独立人工审计，也不是独立人工真值。

## 审计结论

| 项目 | 结论 | 证据边界 |
|---|---|---|
| 参照来源 | WARN | 12份参照均明确标为模型辅助单作者、合成Development，独立人工参照为0；只能用于工程筛选。 |
| 评分与归一化 | WARN | v4.1按原始TP/FP/FN、冻结字段和Forbidden规则评分，没有用候选自身结果归一化；但空分母P/R定义为1，且部分产品语义字段不在精确评分范围，因此“完整正确”只表示通过v4.1合同。 |
| 结果存在性 | PASS | 24份raw和24份result齐全，身份、请求和响应哈希对应；均为HTTP 200、settled、零重试、零repair、零verifier。 |
| 预算与账本 | PASS | 1个grant、24次reserve、24次settle；账本742行合法追加至791行。冻结最坏预算、实际usage上界和`NOT_OBSERVABLE`服务商实扣边界披露一致。 |
| 执行链路 | WARN | 确定性评分、结果回放、编辑、保存、失败恢复与读回有工程证据；注册真人试次没有执行，三项行为指标保持`NOT_OBSERVABLE`。 |
| 门槛执行 | PASS | Candidate13安全门槛因Forbidden=2失败，整份正确来源净增门槛因2/12对2/12失败；结论按预注册规则固定为拒绝。 |
| 结论范围 | PASS | 包内未把合成Development、工程回放或自动化时间扩大为独立Holdout、真人转化、默认候选、Preview或Production证据。 |

## 关键复核

- Candidate03：完整正确2/12，TP/FP/FN为12/9/6，F1为61.54%，Forbidden为2。
- Candidate13：完整正确2/12，TP/FP/FN为14/3/4，F1为80.00%，Forbidden为2。
- 配对结果为Candidate03胜2、Candidate13胜3、平7。Candidate13的任务级表现改善，但没有提高整份正确率，且仍违反零Forbidden硬门。
- 浏览器工程回放记录了真实产品缺口：S09-B虽为正确零任务输出，但事件/时间检查阻断“无任务处置”，因此不能计入正确处置率。

最小后续阻碍是：先修复S04、S08、S11及零任务事件/时间处置问题，冻结新候选后用全新Development重测；只有通过相同硬门，才准备独立人工参照、全新未见Holdout和注册真人试次。当前不得替换默认候选、部署或进入Production。
