# DeepSeek Vision Exp 候选实验计划

**问题**：仅替换模型为 `deepseek-v4-flash-vision-exp`，能否提高学生事务识别质量？

**方法主张**：保持 Development Dataset、Prompt、Router、Validator、一次 Repair 和评分器不变，只改变上游模型。

**日期**：2026-08-24

## Claim Map

| Claim | 为什么重要 | 最低可信证据 | 对应实验 |
| --- | --- | --- | --- |
| C1：Vision Exp 提高整体识别质量 | 决定是否值得成为产品候选模型 | 完整 108 条 Development 的核心指标净提升且通过冻结 Gate | B1–B3 |
| C2：提升不以安全、结构或可用性回退为代价 | 产品不能用更高分换取泄密、无效 JSON 或不可接受延迟 | 精确模型血缘；Severe/Invalid/Request Failure 不回退；报告真实延迟与 Token | B1–B3 |
| 反主张：少量难例的增益只是样本选择偏差 | 8 条 Screening 不能代表 27 个语义家族 | 完整 Development 必须复核 Screening 方向 | B2–B3 |

## 实验块

### B1：协议兼容预检

- 数据：Development 首条样本；Flash 与 Vision Exp 各一次。
- 检查：纯文本 Chat Completions、严格 JSON、RecognitionResult 2.0、实际返回模型血缘。
- 成功条件：两臂均完成，且请求模型和返回模型完全一致。
- 结果：PASS。

### B2：高风险语义家族配对 Screening

- 数据：8 条，覆盖申请、会议、多截止、模糊时间、材料、纯信息、OCR 噪声和提示注入。
- 对照：同一时间窗口中的 Flash 与 Vision Exp。
- 成功条件：Task、TimePoint、Event、Major Correction 无关键回退，并保持传输/结构/安全稳定。
- 结果：PARTIAL。Task 和 Major 改善，但 TimePoint 回退，双方 Gate 均失败。

### B3：完整 Development 候选评测

- 数据：冻结的 `e2-generalization-development-1.0.0`，108 条、27 个语义家族。
- 对照：冻结的完整 Flash 2.4.1 Development 基线；B2 作为同时段小样本辅助证据。
- 成功条件：完整 Gate 通过，且无核心指标显著回退。
- 结果：FAIL。Vision Exp 未通过 Task、TimePoint、Event 和 Major Correction 门槛。

## 执行顺序与停止规则

| 阶段 | 运行 | 决策门槛 | 结果 |
| --- | --- | --- | --- |
| M0 | API `/models` 身份检查 | 账号真实列出目标模型 | PASS |
| M1 | 1 × 2 兼容预检 | 协议、结构、血缘全部成功 | PASS |
| M2 | 8 × 2 配对 Screening | 出现值得扩大验证的净收益 | PARTIAL，扩大到 Development |
| M3 | 108 × Vision Exp | 完整 Gate 通过 | FAIL |
| M4 | Golden / Holdout 回归 | 仅 M3 通过后运行 | NOT RUN |
| M5 | Blind / 生产替换 | 仅所有冻结门槛和浏览器验收通过后运行 | NOT RUN |

## 数据、隐私和成本边界

- 只发送匿名合成文本；Expected 只在本地评分，不发送给模型。
- 图片和文件本体上传次数均为 0；没有启用视觉输入。
- API Key 仅从剪贴板进入单个 PowerShell 进程环境，未写入仓库、缓存、日志或报告。
- Token 使用来自 API 的真实 usage；完整运行有一次请求失败，因此总量按已观测调用报告为 partial。
- API 未返回可归属价格，Cost 为 `NOT OBSERVABLE`，不做估算。
