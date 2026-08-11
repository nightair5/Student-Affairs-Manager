# P5 rejected-candidate rollback

RC1 与 RC2 均未达到净收益和 Candidate 门槛。运行代码因此恢复冻结的 `recognition-2.4.1` Prompt；这不是第三轮 Prompt 候选，不产生新的质量主张。

保留不变：

- `deepseek-v4-flash`
- `RecognitionResult 2.0`
- `recognition-pipeline-2.2.1`
- `recognition-router-1.1.0`
- `recognition-quality-2.1.0`
- `recognition-repair-1.1.0`
- Workspace v8、Repository、Migration、DomainCommitPlan 与正式 Capture/Commit 链路

RC1/RC2 的代码提交、Preview 版本、聚合结果、失败审计与 Git ignored 原始 checkpoint 均继续保留。后续 P6–P9 使用 2.4.1 作为独立组件消融基线，不得继续增加 Prompt 规则。
