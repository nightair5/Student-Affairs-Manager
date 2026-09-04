# RCO-5-007-B5 首次零调用盲测

- B5 先在 commit `578d2a3789eaa4f7af252b7587e3b0414ead1746` 冻结并推送，再进行本次唯一首次运行。
- 调用：模型 0、网络 0、Repair 0、retry 0、Secret NONE。
- 决策：`B5_ORACLE_FAIL_P2_GENERALIZATION_NOT_ESTABLISHED_PAID_MODEL_BLOCKED`。

| 指标 | 结果 | 门槛 |
|---|---:|---:|
| Task Precision | 100.0% | 完整报告 |
| Task Recall | 100.0% | 完整报告 |
| Task F1 | 100.0% | >=90% |
| requiresAction | 100.0% | >=95% |
| Semantic fields | 97.5% | 完整报告 |
| Exact task boundary | 100.0% | 完整报告 |
| Complete Task Case | 93.8% | >=80% |
| Major Correction | 6.3% | 越低越好 |
| Safe Default Recall | 100.0% | 完整报告 |
| Forbidden | 0 | 0 |
| 修订案例整例正确 | 50.0% | 完整报告 |
| 旧要求完整失效表达 | 50.0% | 100% |
| 新要求生效召回 | 100.0% | 100% |
| 陈旧任务 / 被默认勾选的陈旧任务 | 1 / 0 | 后者 0 |

## 不完整案例

- rco-task-b5-08: contract=PASS; TP/FP/FN=2/0/0; requiresAction=PASS; boundary=PASS; semantics=10/14

这不是模型正确率。上游锚点由 Expected 构造，只检验冻结 P2。B5 从本次运行起已见；失败后不得修改 P2 或 B5 再用本集声称首次泛化。
