# P6 Router 人工标签冻结

## 范围

- 共 80 条已暴露诊断样例：simple 20、medium 28、complex 32。
- 原有 E2.5 人工 Router 标签 60 条保持原判定；另人工补充 20 条 Development 原文，使 simple/medium 覆盖更充分。
- 每条记录均包含原文 SHA-256、判定理由、建议识别强度、低路由风险和高路由成本。
- Router 仅分配识别强度，不执行事实或业务结构识别；运行时禁止读取 caseId、expected、测试固定句和 Golden 分类。

## 路径定义

- simple：单阶段 Path A + 轻量校验。
- medium：单阶段 Path A + 标准校验。
- complex：更充分的单阶段 Planning Prompt 预算、更高 max tokens、更严格 Validator、条件式至多一次 Repair；本轮仍使用同一 `deepseek-v4-flash` 模型。
- FactLedger 已拒绝，任何等级都不得指向 FactLedger 或两阶段 Planner。

## 冻结纪律

标签文件先于 Router 参数调整提交。后续允许使用正文可观测特征校准，但不得改标签迎合路由器。该集合已暴露，只能提供诊断校准证据，不能作为 Blind。

冻结时 `recognition-router-1.1.0` 仅达到 Accuracy 45%、Complex Recall 37.5%、Under-routing 46.25%、Over-routing 8.75%，未过门槛。历史 `recognition-2.4.1` 原始缓存在本工作树不可用，因此本提交不估算延迟、Token 或质量；这些指标必须由标签冻结后的独立、版本绑定 Path A 运行补齐。
