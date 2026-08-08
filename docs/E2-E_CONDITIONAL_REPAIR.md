# E2-E Conditional Repair

`recognition-repair-1.0.0` 只在 Quality Validator 指出允许修复的结构缺口时启动，单次识别最多调用一次 Repair。允许的范围为缺 Evidence、TimePoint、时间歧义、Material、Event、Milestone，以及把伪精确时间降为需要确认的模糊值。

Repair 返回完整 RecognitionResult 2.0，但系统不会直接采信。确定性合并规则保留首轮实体，不导入新 Task，不接受不在来源中的证据，只增补引用完整且有逐字证据的 Material、TimePoint、Event；Milestone 仅能重组已有相同 tempId 的任务。修复失败、超时或无效时返回首轮有效结果，并在 `repair.errorCode` 中记录真实状态。

假动作、过度拆分、悬空引用和深层 Subtask 不做自动修复，继续交由人工确认。本阶段不改变 Domain、Repository、Migration 或确认提交路径。
