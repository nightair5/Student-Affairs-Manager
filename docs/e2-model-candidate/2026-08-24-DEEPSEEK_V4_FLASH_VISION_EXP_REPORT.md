# `deepseek-v4-flash-vision-exp` 候选评测报告

## 结论

`deepseek-v4-flash-vision-exp` **不能替换当前 `deepseek-v4-flash`**。它通过了 API、严格 JSON、RecognitionResult 2.0 和模型血缘兼容性检查，但在完整 108 条 Development 上没有提升整体识别成功率，反而在 Task、Material、TimePoint、Event、Evidence、Major Correction 和稳定性上回退。

本轮状态：`DEVELOPMENT GATE FAIL / GOLDEN NOT RUN / HOLDOUT NOT RUN / BLIND NOT CREATED / PRODUCTION NOT CHANGED`。

## 完整 Development 对照

| 指标 | 冻结 Flash 2.4.1 | Vision Exp | 变化 | 判定 |
| --- | ---: | ---: | ---: | --- |
| Project Decision | 90.74% | 92.59% | +1.85 pp | 改善 |
| Task Precision | 82.17% | 76.52% | -5.66 pp | 回退 |
| Task Recall | 75.71% | 72.14% | -3.57 pp | 回退 |
| Material Recall | 93.24% | 89.19% | -4.05 pp | 回退 |
| TimePoint Accuracy | 75.00% | 67.10% | -7.90 pp | 回退 |
| Event Accuracy | 93.94% | 65.63% | -28.31 pp | 严重回退 |
| Evidence Coverage | 98.72% | 95.73% | -2.99 pp | 回退 |
| Major Correction | 67.59% | 73.15% | +5.56 pp | 回退，越低越好 |
| Severe Error | 0.00% | 0.93% | +0.93 pp | 回退，越低越好 |
| Invalid Output | 0.00% | 0.00% | 0 | 持平 |
| Request Failure | 0.00% | 0.93% | +0.93 pp | 回退，越低越好 |

Vision Exp 只通过了 Project、Material 最低门槛、Evidence、重复/过度拆分、安全和结构类检查；未通过 Task Precision、Task Recall、TimePoint、Event 和 Major Correction，因此完整 Gate 为 FAIL。

## 为什么 8 条 Screening 看起来更好

8 条配对 Screening 中，Vision Exp 的 Task Precision 从 53.85% 提升到 88.89%，Task Recall 从 63.64% 提升到 72.73%，Major Correction 从 87.50% 降到 75.00%；但 TimePoint 从 66.67% 降到 50.00%，双方仍未通过 Gate。

完整 108 条推翻了“整体提升”的初步印象，原因是 Screening 是有意挑选的 8 个高风险家族代表，不是覆盖 27 个家族和四种表达变体的代表性样本。Vision Exp 在这些样本上减少了部分虚假任务，但扩大后暴露出更多任务遗漏、时间角色错误、事件遗漏和项目判断问题。这正是必须使用完整 Development，而不能把小样本结果直接当成产品成功率的原因。

## 主要失败类型

Vision Exp 完整运行的主要错误为：

| 错误类型 | 次数 |
| --- | ---: |
| Task missing | 37 |
| Ambiguity missing | 31 |
| Time incorrect | 31 |
| Task spurious | 28 |
| Milestone missing | 23 |
| Project decision | 20 |
| Material missing | 14 |
| Event missing | 10 |
| Evidence missing | 10 |
| Time missing | 10 |
| Time spurious | 10 |

这说明换成 Vision Exp 没有改变此前的第一性根因：单次模型仍要同时完成事实发现、任务政策判断、时间角色分类、层级规划和证据连接。模型在 Project Decision 和减少过度拆分上局部更好，但没有解决 Task、TimePoint 和 Event 的耦合错误。

## 运行质量与资源

| 项目 | Flash 2.4.1 | Vision Exp |
| --- | ---: | ---: |
| 平均延迟 | 7,671 ms | 7,918 ms |
| P50 | 7,351 ms | 6,805 ms |
| P95 | 11,788 ms | 14,019 ms |
| 已观测 Token | 291,508 input / 157,438 output | 294,984 input / 107,516 output，partial |
| Cost | NOT OBSERVABLE | NOT OBSERVABLE |

Vision Exp 平均延迟略高，P95 高约 2.23 秒；复杂公文样本出现约 22–24 秒响应。输出 Token 更少，但由于存在一次无效响应，完整 Token 总量只能标记为 partial，不能冒充完整成本统计。

## 安全和实验完整性

- API `/models` 真实返回目标模型；完整 Development 记录了 120 次上游调用，实际返回模型血缘全部匹配 `deepseek-v4-flash-vision-exp`。
- Expected、评分、Gate 和错误分类只在本地执行，未发送给模型。
- 图片和文件本体上传均为 0；本轮只测试产品现有的“本机 OCR 后文本识别”路径，并未测试视觉输入能力。
- API Key 只存在于运行进程内存；仓库、Git 忽略缓存、报告和命令输出均未保存 Key 或 Authorization Header。
- 第 9 条样本出现一次 `INVALID_AI_RESPONSE`，按规则保留为 Request Failure，没有偷偷重试或覆盖。
- Golden、旧 Holdout 和 Blind 均未运行，避免在 Development 失败后继续消耗预算或污染阶段边界。

## 产品决策

1. 保持生产模型 `deepseek-v4-flash` 不变。
2. 不把 Vision Exp 暴露为用户可选模型，也不部署 Preview/Production。
3. 保留通用候选模型评测入口，今后任何新模型都必须先通过身份、Screening 和完整 Development。
4. 下一步质量提升仍应针对可观察的事实层、时间角色和事件/任务边界，而不是单纯换模型。
5. 如果未来要评估真正的图片视觉能力，必须先单独修改隐私/数据发送授权边界，并建立匿名图片数据集；本轮没有获得也没有假定该授权。

## 证据位置

- 完整候选结果：`docs/e2-model-candidate/vision-exp-development/`
- 同时段配对 Screening：`docs/e2-model-candidate/vision-exp-screening/`
- 协议预检：`docs/e2-model-candidate/vision-exp-preflight/`
- 冻结 Flash 基线：`docs/baselines/e2-generalization/after-2-4-1/`
- 原始结构化结果与传输证据：`.evaluation-cache/model-candidates/`（Git 忽略）
