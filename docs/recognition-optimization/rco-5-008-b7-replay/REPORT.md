# RCO-5-008 B7 零调用回归

- 判定：`B7_SEEN_REGRESSION_PASS_ELIGIBLE_TO_FREEZE_NEW_B8`。
- 调用：模型 0、网络 0、verifier 0、Repair 0、retry 0、Secret NONE。
- 证据边界：复用已经见过的 B7 原始模型输出，只证明本机接口修复覆盖已知失败，不证明模型正确率提高或对新数据泛化。

| 指标 | 结果 | 门槛 |
|---|---:|---:|
| Scope Precision / Recall / F1 | 100.0% / 100.0% / 100.0% | 各 100% |
| 动作 / 对象完全正确 | 100.0% / 100.0% | 各 100% |
| 完整锚点案例 | 100.0% | 100% |
| Task Precision / Recall / F1 | 100.0% / 100.0% / 100.0% | 各 100% |
| requiresAction / Complete Task Case | 100.0% / 100.0% | 各 100% |
| unsafe default false positive | 0 | 0 |
| Forbidden | 0 | 0 |
| cancels / supersedes / amends | 100.0% / 100.0% / 100.0% | 各 100% |
| 旧要求失效 / 新要求生效 | 100.0% / 100.0% | 各 100% |
| 歧义保持 unresolved | 100.0% | 100% |
| stale / selected stale | 0 / 0 | 0 / 0 |

## 失败案例

- none

旧 B7 的预注册失败结论保持不变。新结果只允许进入 B8 数据冻结，不接稳定路径、不启动 RCO-6、不部署。
