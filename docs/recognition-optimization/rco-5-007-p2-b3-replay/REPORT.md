# RCO-5-007-P2 已见 B3 故障回归

- 分类：已见 B3 Development 故障回归，不是模型正确率或未见泛化。
- 调用：模型 0、网络 0、Secret NONE。
- 决策：`KNOWN_B3_FAILURES_REPAIRED_ELIGIBLE_TO_FREEZE_P2_THEN_CREATE_B4`。

| 指标 | P1 | P2 |
|---|---:|---:|
| Task F1 | 96.0% | 100.0% |
| requiresAction | 93.8% | 100.0% |
| Semantic fields | 95.8% | 100.0% |
| Exact task boundary | 93.8% | 100.0% |
| Complete Task Case | 68.8% | 100.0% |
| Major Correction | 31.3% | 0.0% |
| Safe Default Recall | 100.0% | 100.0% |
| Forbidden | 0 | 0 |

## P2 未通过案例

- none

只有本回归满分并冻结 P2 后，才允许创建全新 B4。
