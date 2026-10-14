# RCO-5-007-B4 首次零调用盲测

- B4 先在 commit `fc2aeb78f8d01f06a4c14be6c31bfdb91073d5be` 冻结并推送，再进行本次唯一首次运行。
- 调用：模型 0、网络 0、Repair 0、retry 0、Secret NONE。
- 决策：`B4_ORACLE_PASS_ELIGIBLE_FOR_SEPARATE_PAID_MODEL_AUTHORIZATION`。

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

## 不完整案例

- rco-task-b4-07: contract=PASS; TP/FP/FN=2/0/0; requiresAction=PASS; boundary=PASS; semantics=10/14

这不是模型正确率。上游锚点由 Expected 构造，只检验冻结 P2。B4 从本次运行起已见，不得修改 P2 后继续用 B4 声称未见泛化。
