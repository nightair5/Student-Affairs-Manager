# E2-D Recognition Quality Validator

`recognition-quality-2.0.0` 是独立于 schema 解析器的纯业务验证层。它不写入 Domain、不创建任务，也不自动修复识别实体；它只输出结构化问题，并把问题以 `quality.reviewReasons` 暴露给人工确认界面。

当前规则覆盖：ID 唯一、引用完整、Subtask 最大一层、逐字证据、来源时间遗漏、模糊时间伪精确、时间歧义遗漏、材料遗漏、Event 遗漏、复杂项目阶段遗漏、假动作和过度拆分。每个问题包含 code、severity、repairable、message、entityId 和 evidence。

Worker 的成功响应新增 `validation` 元数据；RecognitionResult 2.0 自身只更新 `quality.needsHumanReview` 与可解释复核原因，Project、Task、Material、TimePoint、Event、Evidence 等实体不被 Validator 改写。
