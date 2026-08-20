# E2.9-R6 DeepSeek V4 Pro Screening 报告

最终状态：**EXPERIMENT BLOCKED**。Screening Gate：**V4_PRO_SCREENING_R6_FAIL**。

## 1. 执行范围

本轮严格停在用户授权的条件流水线边界：Readiness 6 次通过后执行 Screening 16 次；Screening Gate 失败，因此 Selection、Blind 与 Production 均未执行。

| 阶段 | 计划调用 | 完成 | 重试 | Gate |
|---|---:|---:|---:|---|
| Readiness | 6 | 6 | 0 | PASS |
| Screening | 16 | 16 | 0 | FAIL |
| Selection | 最多 32 | 0 | 0 | NOT RUN |
| 合计 | — | 22 | 0 | — |

16 个 Screening observation 均为一次完成；没有 fallback、选择性补跑或旧缓存替代。A/B 输出全部完成并冻结后，Scorer 才读取 expected 并统一评分。

## 2. 严格指标

| 指标 | Flash | Pro | 结果 |
|---|---:|---:|---|
| Task Precision | 81.25% | 92.86% | Pro +11.61 pp |
| Task Recall | 81.25% | 81.25% | 持平 |
| Milestone Precision | 46.15% | 36.36% | Pro -9.79 pp |
| Milestone Recall | 46.15% | 30.77% | Pro -15.38 pp |
| Material Precision | 92.86% | 92.31% | Pro -0.55 pp |
| Material Recall | 100.00% | 92.31% | Pro -7.69 pp |
| TimePoint Type Accuracy | 89.47% | 84.21% | Pro -5.26 pp |
| TimePoint Value Accuracy | 73.68% | 89.47% | Pro +15.79 pp |
| Event Accuracy | 100.00% | 100.00% | 持平 |
| Ambiguity Precision | 83.33% | 100.00% | Pro +16.67 pp |
| Ambiguity Recall | 71.43% | 71.43% | 持平 |
| Evidence Coverage | 100.00% | 97.83% | 两者达标 |
| Strict Major Correction | 75.00% | 62.50% | Pro -12.50 pp |
| Severe Error | 0.00% | 0.00% | 持平 |
| Planning Error | 87.50% | 87.50% | **未下降** |

Pro 改善了 Task Precision、TimePoint Value、Ambiguity Precision 和 Strict Major Correction，但没有改善 Task Recall 或 Planning Error，并明显降低 Milestone Recall。该结果不满足进入 Selection 的冻结门槛。

## 3. Path-masked 独立盲评

全新 f review packet 的独立完整性审阅为 PASS：没有直接模型身份、确定性路径关联器、expected、aggregate 或 mapping 泄露，审阅者无法识别 X/Y 身份。8 对匿名输出完成盲评后才创建揭盲映射。

揭盲聚合结果：

- Pro 优 3 对；Flash 优 3 对；TIE 2 对；信息不足 0 对。
- 用户影响 Major：Pro 3，对比 Flash 2。
- 人工 Planning Error：Pro 5，对比 Flash 5。

因此 `proClearlyDegradesAtMostOnePair` 失败：Flash 明显更好的案例为 3 对，超过门槛最多 1 对。

首次 e review 因审计 JSON 字段格式不符合 runner schema，在创建 labels envelope、reveal key 和 Gate 前 fail-closed 退出。由于 reveal secret 仅存在于退出进程内，旧 e review 不可恢复、未参与正式 Gate；没有重跑任何模型。正式 Gate 仅使用全新的 f packet 与两名全新审阅者。

## 4. 性能与 Token

| 模型 | 平均延迟 | P50 | P95 | Input Token | Output Token | Total Token |
|---|---:|---:|---:|---:|---:|---:|
| Flash | 9,672 ms | 10,290 ms | 13,398 ms | 19,008 | 15,255 | 34,263 |
| Pro | 15,386 ms | 9,998 ms | 23,516 ms | 19,008 | 14,490 | 33,498 |

Pro 总 Token 少 765（-2.23%），但平均延迟高 5,714 ms（+59.08%），P95 高 10,118 ms（+75.52%）。性能数据只用于诊断，不改变 Gate 结论。

## 5. Gate 与停止边界

通过的检查包括：8 对完整、Task Recall 非劣、Task Precision 降幅限制、Evidence Coverage、Severe Error、人工 Planning Error 非劣、Prompt Injection、Pro 至少改善两对、模型 lineage 与单次尝试完整性。

失败的两项检查：

1. `strictPlanningErrorLower`：Flash 与 Pro 均为 87.50%，Pro 没有实际下降。
2. `proClearlyDegradesAtMostOnePair`：Flash 优 3 对，超过上限 1 对。

因此：

- Selection：**NOT RUN**
- Blind：**NOT CREATED**
- Production：**NOT DEPLOYED**
- E2：**BLOCKED**
- E3/E4：**NOT READY / NOT ENTERED**

## 6. Preview 与 Secret 清理

- 临时实验 bearer 已从本地进程和 Cloudflare Preview 删除。
- Preview Secret 名称只剩 `DEEPSEEK_API_KEY`；未读取或输出其值。
- 默认 Preview 已恢复所有实验 Feature Flag 为 `false`，清理版本为 `0d5643ea-fa9e-4326-b422-f5a636147e65`。
- 禁用后的实验 POST 在无认证和假认证下均返回 HTTP 405，未进入模型实验路由。GET 由静态 SPA 返回 200，因此不误报为 404。
- 原始输出、checkpoint、揭盲映射和 labels 保留在 Git ignored cache；Git 只提交匿名聚合报告与独立审计。

## 7. 结论与建议

当前证据不支持把 V4 Pro 推进到 24-case Selection。它在部分严格指标上有改善，但复杂通知的核心 Planning Error 没有下降，且盲评退化案例超过门槛。

下一步只能先对 3 个 Flash-preferred 对做只读、非调参的错误类型归因，判断问题来自 Milestone、Material、Time Role 还是 Task/Event 组织；如要修复 Prompt、Schema 或 Scorer，必须另开阶段与新协议，不能复用本轮 Screening 进行刷分，也不能自动创建 Blind。
