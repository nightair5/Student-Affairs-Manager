# RCO-5-007-P1 B2 零调用故障回归

- 分类：已见 B2 Development 诊断，不是模型正确率或未见泛化。
- 调用：模型 0、网络 0、Secret NONE。
- 决策：`KNOWN_B2_FAILURES_REPAIRED_ELIGIBLE_FOR_NEW_B3_ZERO_CALL_GATE`。

| 指标 | 旧策略 | P1 |
|---|---:|---:|
| Task F1 | 94.3% | 100.0% |
| requiresAction | 56.3% | 100.0% |
| Semantic fields | 94.3% | 100.0% |
| Exact task boundary | 87.5% | 100.0% |
| Complete Task Case | 37.5% | 100.0% |
| Major Correction | 62.5% | 0.0% |
| Safe Default Recall | 76.9% | 100.0% |
| Forbidden | 0 | 0 |

## P1 未通过案例

- none

P1 通过只表示已知 B2 故障被修复。下一步必须另获授权，创建并冻结全新 B3，再先跑零调用理想锚点门。
