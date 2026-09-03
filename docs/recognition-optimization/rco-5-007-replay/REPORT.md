# RCO-5-007 B1 零调用回放报告

- 分类：`SEEN_DIAGNOSTIC_REPLAY`，不是未见集。
- 调用：模型 0、网络 0、Repair 0、retry 0、密钥访问 NONE。
- 结论：`ELIGIBLE_FOR_NEW_UNSEEN_VALIDATION_ONLY`；稳定路径未改、RCO-6 未启动、未部署。

## 结果

| 指标 | RCO-5-007 |
|---|---:|
| 新契约有效案例 | 12/12 |
| 任务 Precision / Recall / F1 | 100.0% / 100.0% / 100.0% |
| 动作+对象精确率 | 100.0% |
| requiresAction | 100.0% |
| 语义字段一致率 | 98.1% |
| 任务边界整例一致 | 100.0% |
| Complete Task Case | 83.3% |
| Safe Default Recall | 100.0% |
| Forbidden Default | 0 |

## 逐例

| Case | 预测/Expected 任务 | 动作对象 | requiresAction | Forbidden | Complete |
|---|---:|---:|---|---:|---|
| rco-scope-b1-01 | 2/2 | 2/2 | PASS | 0 | FAIL |
| rco-scope-b1-02 | 2/2 | 2/2 | PASS | 0 | PASS |
| rco-scope-b1-03 | 2/2 | 2/2 | PASS | 0 | PASS |
| rco-scope-b1-04 | 3/3 | 3/3 | PASS | 0 | FAIL |
| rco-scope-b1-05 | 0/0 | 0/0 | PASS | 0 | PASS |
| rco-scope-b1-06 | 1/1 | 1/1 | PASS | 0 | PASS |
| rco-scope-b1-07 | 3/3 | 3/3 | PASS | 0 | PASS |
| rco-scope-b1-08 | 2/2 | 2/2 | PASS | 0 | PASS |
| rco-scope-b1-09 | 2/2 | 2/2 | PASS | 0 | PASS |
| rco-scope-b1-10 | 3/3 | 3/3 | PASS | 0 | PASS |
| rco-scope-b1-11 | 2/2 | 2/2 | PASS | 0 | PASS |
| rco-scope-b1-12 | 0/0 | 0/0 | PASS | 0 | PASS |

## 如何解释

这轮证明的是：同一批 B1 模型候选经过固定的本机规则后，可以稳定产出通过新契约的待确认建议，并且模型不再决定默认勾选。它不证明新材料也会一样好。

旧 B1 的 Scope F1、Complete Case 等使用另一套 fail-closed 图评分，本轮使用任务形成评分，两者不能直接相减宣称“提升了多少”。本轮仍保留旧指标作为历史参照。

共有 3 个任务的完整语义组合与旧 Expected 不同：B1-01 的“暂勿提交”旧标签是 pending，而新政策统一为 cancelled；B1-04 的两个否定命令旧标签是 present，而新政策统一把面向收件人的命令标为 future。没有为追分修改 Expected。
