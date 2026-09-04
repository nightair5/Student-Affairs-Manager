# RCO-5-007-B6 首次零调用盲测

- B6 先在 commit `ee7ffc9` 冻结并推送，再进行本次唯一首次运行。
- 调用：模型 0、网络 0、Repair 0、retry 0、Secret NONE。
- 决策：`B6_ORACLE_PASS_ELIGIBLE_FOR_SEPARATE_PAID_MODEL_AUTHORIZATION`。

| 指标 | 结果 | 门槛 |
|---|---:|---:|
| Task Precision / Recall / F1 | 100.0% / 100.0% / 100.0% | F1 >=90% |
| requiresAction | 100.0% | >=95% |
| Complete Task Case | 100.0% | >=80% |
| Major Correction | 0.0% | 越低越好 |
| Forbidden | 0 | 0 |
| cancels / supersedes / amends 精确关系 | 100.0% / 100.0% / 100.0% | 各 100% |
| 旧要求完整失效 / 新要求生效 | 100.0% / 100.0% | 各 100% |
| stale / selected stale | 0 / 0 | 0 / 0 |
| 歧义保持未解析 | 100.0% | 100% |
| 修订整例 | 100.0% | 完整报告 |

## 不完整案例

- none

这不是模型正确率。上游 scope、动作和对象锚点由 Expected 构造，只检验冻结 P3 的本机任务形成与修订关系。B6 从本次运行起已见；不得修改 P3 或 B6 后再用本集声称首次泛化。
