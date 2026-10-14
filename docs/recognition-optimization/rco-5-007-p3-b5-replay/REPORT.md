# RCO-5-007-P3 已见 B5 回归

- 分类：已见 B5 故障回归，不是新盲测。
- 调用：模型 0、网络 0、Repair 0、retry 0、Secret NONE。
- 决策：`P3_SEEN_B5_REGRESSION_PASS_ELIGIBLE_TO_FREEZE_P3`。

| 指标 | P3 |
|---|---:|
| Task Precision / Recall / F1 | 100.0% / 100.0% / 100.0% |
| requiresAction | 100.0% |
| Semantic fields | 100.0% |
| Complete Task Case | 100.0% |
| Major Correction | 0.0% |
| Safe Default Recall | 100.0% |
| Forbidden | 0 |
| 修订整例 | 100.0% |
| 旧要求失效 / 新要求生效 | 100.0% / 100.0% |
| stale / selected stale / unresolved | 0 / 0 / 0 |

P3 将 B5-08 的状态声明与旧任务建立 `supersedes` 边；旧任务保留审计但退出当前待办，新任务独立生效。B5 已见，只能支持故障修复结论。
