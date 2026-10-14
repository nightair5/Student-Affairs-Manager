# RCO-5-007-B3 首次理想锚点零调用门

- 数据先在 commit `e52e76b3cbfc7e8b760e91b5cde033fedab1c9af` 冻结并推送，再执行本次首次运行。
- 调用：模型 0、网络 0、Repair 0、retry 0、Secret NONE。
- 决策：`B3_ORACLE_FAIL_P1_GENERALIZATION_NOT_ESTABLISHED_PAID_MODEL_BLOCKED`。

| 指标 | 结果 | 门槛 |
|---|---:|---:|
| Task Precision | 96.0% | 完整报告 |
| Task Recall | 96.0% | 完整报告 |
| Task F1 | 96.0% | >=90% |
| requiresAction | 93.8% | >=95% |
| Semantic fields | 95.8% | 完整报告 |
| Exact task boundary | 93.8% | 完整报告 |
| Complete Task Case | 68.8% | >=80% |
| Major Correction | 31.3% | 越低越好 |
| Safe Default Recall | 100.0% | 完整报告 |
| Forbidden | 0 | 0 |

## 不完整案例

- rco-task-b3-01: contract=PASS; task TP/FP/FN=2/0/0; requiresAction=PASS; boundary=PASS; complete=FAIL
- rco-task-b3-03: contract=PASS; task TP/FP/FN=2/0/0; requiresAction=PASS; boundary=PASS; complete=FAIL
- rco-task-b3-04: contract=PASS; task TP/FP/FN=2/0/0; requiresAction=PASS; boundary=PASS; complete=FAIL
- rco-task-b3-06: contract=PASS; task TP/FP/FN=1/0/0; requiresAction=FAIL; boundary=PASS; complete=FAIL
- rco-task-b3-10: contract=PASS; task TP/FP/FN=0/1/1; requiresAction=PASS; boundary=FAIL; complete=FAIL

这不是模型正确率。上游锚点由 Expected 构造，只隔离检验本机 P1。无论通过或失败，B3 从本次运行起都已见，不得修改 P1 后继续用 B3 声称未见泛化。
