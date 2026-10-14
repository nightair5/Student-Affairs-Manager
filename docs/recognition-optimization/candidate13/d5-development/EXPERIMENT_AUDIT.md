# Candidate13 D5-R1 实验完整性审计

结论：`PASS_WITH_WARN`。允许保持`CANDIDATE13_V4_DEVELOPMENT_READY_FOR_NEW_AUTHORIZATION`，含义仅为零调用准备包已可申请新的明确授权。

本审计由未参与实现的同系列模型只读完成，属于provisional工程复核，不是独立人工审计或独立真值复核。

## 审计结论

| 项目 | 结论 | 证据边界 |
|---|---|---|
| 参照来源 | PASS/WARN | 12份均诚实标记`PROVISIONAL_MODEL_AUTHORED`、模型辅助单作者，独立人工0；只能作为合成Development。 |
| 冻结时间线 | PASS | v4.0因Schema不可表达字段在零调用状态作废；v4.1于`ee6ee45caa4e1bd258237ccb4c6bc9792d0c9e34`冻结推送，D5-R1在其后生成。 |
| 评分与归一化 | PASS/WARN | v4.1按原始TP/FP/FN及结构化字段汇总，不使用候选自身最大值归一化；晋级门槛将在结果执行器中应用，本阶段没有模型结果。 |
| D4与D5绑定 | PASS | D4冻结清单13/13无漂移；D5-R1 Manifest绑定D4身份、v4.1 compiler/scorer、Schema、adapter、measurement、prepared identity、observation和准备脚本自身SHA。 |
| 请求身份与派发 | PASS | 12 A、12 B，6组AB/6组BA；24个身份均`dispatchAuthorized=false / NOT_RUN`，递归检查无Expected字段。 |
| 结果存在性 | PASS | 真实结论是没有结果：模型调用0，raw/result/receipt/grant均不存在；首次整份正确率`NOT_RUN`，真人三项指标`NOT_OBSERVABLE`。 |
| 重合检查 | PASS/WARN | 12/12无逐字命中，最高字符bigram Jaccard 0.15873，小于0.8；本地筛查不能证明零概念重合。 |
| 执行可达性 | WARN | scorer、measurement、observation和身份保护均有工程测试，但授权runner、真实transport、结果聚合和真人入口不属于本阶段，尚未执行。 |
| 结论范围 | PASS | 文档没有把工程测试写成模型效果、真人转化、独立Holdout或发布证据。 |

## 首轮审计修复

首轮审计曾因`b1bebff`之后的评分合同修改仍沿用4.0.0而判定FAIL。本轮已完成版本上调、作废记录、独立冻结提交、D5-R1全量重建和第二轮复核；原草稿状态为`NEVER_DISPATCHED_NEVER_SCORED`，没有进入结果。

审计仍不能替代两名独立人工的参照复核，也不能证明四项主指标已经提升。真正派发前还需重新核价、新grant和用户对24次及费用硬上限的明确授权。
