# E2 Issue-scoped Repair 设计记录

## 版本与原则

- Pipeline：`recognition-pipeline-2.2.0`
- Repair：`recognition-repair-1.1.0`
- Patch contract：`recognition-repair-patch-1.0.0`

Repair 最多执行一次。它不再被要求重新生成完整 `RecognitionResult`，而只返回受限 Patch。原始识别结果是不可被 Patch 替换的基线。

## 允许范围

Patch 顶层只能包含：

- `contractVersion`
- `issueCodes`
- `evidence`
- `materials`
- `timePoints`
- `events`
- `ambiguities`
- `taskReferenceUpdates`

`taskReferenceUpdates` 只能为既有 Task 补充证据、材料与时间引用。Patch 不能返回或覆盖 Project、Milestone、WorkPackage、Task、sourceSummary、projectMatch、quality；未知字段、未获 Validator 授权的问题码、数组越界或非法引用均使本次 Repair 失效。

## 高风险问题

`MISSING_MILESTONE` 仍由 Validator 报告，但改为人工复核且不可自动 Repair。原因是阶段修复需要重组既有任务，超出了最小字段修复的安全边界。

## 可观测性

Preview 响应记录 Repair 前后 Validator、允许字段、实际变化字段和 Repair 前结果，供离线评测计算 Trigger、Success、Harm 与延迟。它不记录密钥，也不把来源正文写入服务端日志。
