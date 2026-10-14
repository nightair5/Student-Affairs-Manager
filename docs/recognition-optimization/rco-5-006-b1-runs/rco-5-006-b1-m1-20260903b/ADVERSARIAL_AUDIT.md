# RCO-5-006-B1-M1 新鲜对抗审查

## 审查结论

`INVALID_RUN / NO_PROMOTION / DO_NOT_LAUNCH`

这不是“模型接口没通”，而是“接口全部有回执，但模型输出不能稳定满足产品契约”。本轮不能进入 RCO-6，也不能据此替换稳定路径。

## 调用完整性

- 12 个 candidate 均各调用 1 次并获得 HTTP 200、provider request ID、指定模型身份和 usage。
- 其中 2 个 candidate 未通过本地契约，相关 verifier 在联网前跳过。
- 其余 10 个 verifier 均各调用 1 次并获得回执；其中 1 个 verifier 自身契约不合格。
- 实际模型请求 22 次，确认回执 22，未知回执 0，Repair 0，retry 0。
- 63,036 input tokens、20,761 output tokens、83,797 total tokens；供应商账单费用不可观测。按冻结保守峰值代理折算 0.551404 CNY，全轮理论上限 8.504602 CNY，低于 10 CNY 硬上限。

## Fail-closed 诊断下界

契约不合格案例按全错进入固定分母。由于整轮已经 `INVALID_RUN`，这些数字只用于定位问题，不是可宣传的正式准确率。

| 指标 | 结果 | 预注册门槛 |
|---|---:|---:|
| candidate 契约通过 | 10/12（83.3%） | 12/12 |
| verifier 契约通过 | 9/10 已调用；9/12 全计划（75.0%） | 所有应调用项通过 |
| scope Precision | 68.4% | 报告 |
| scope Recall | 59.1% | 报告 |
| scope F1 | 63.4% | ≥90% |
| requiresAction | 83.3% | ≥95% |
| 最弱关键语义轴（tense） | 29.4% | 每轴 ≥90% |
| 完整语义 bundle | 8.8% | ≥85% |
| Complete Case | 0/12（0%） | ≥75% |
| Forbidden Default | 0 | 0 |
| Safe Default Recall | 7/10（70.0%） | ≥90% |
| Missed Safe Default | 3 | 报告 |

## 主要失败，不在细枝末节

1. **模型没有稳定遵守引用契约。** 第 1 例把“预约草稿”作为“暂勿提交”scope 内的 object，但该文字并不在所引用 scope；第 4 例一边输出 `requiresAction=false`，一边把未触发条件误标成当前有效必做指令；第 9 例 verifier 声称检查完整，却没有覆盖全部 scope。
2. **模型倾向把一个完整命题拆碎或拆成额外任务。** 它把“检查并保存”“填写并保存”“携带并核验”等拆成多个 directive，也把共同材料说明、否定说明和征询说明拆成额外 observation，直接破坏任务数量、scope 归属和 Complete Case。
3. **语义标签存在系统性偏差。** 命令句经常被标为 `present` 而不是冻结口径的 `future`；“不要/无需”经常仍被标为 `pending`，而不是冻结口径的 `cancelled`；条件句的 `speechAct/polarity/validity` 也不稳定。这不是偶发错字，而是模型与产品语义政策没有对齐。
4. **同模型复核没有消除同模型盲点。** verifier 与 candidate 使用同一模型，只靠不同 run ID；它能完成格式复核，但没有把范围拆分、时态和状态的系统性误差拉回门槛，且自身还有 1 个完整覆盖声明错误。
5. **安全策略只守住了“不要误自动勾选”，没有守住“别漏掉该勾选项”。** Forbidden Default 为 0 是好事，但 Safe Default Recall 只有 70%，意味着安全保守策略仍会让用户补改 3/10 个本应默认选中的任务。

## 对计分器本身的对抗审查

- 模型阶段结束后的首次本地计分因把 composer 的字符串 `action/object` 错当成带 `surface` 的对象而失败。该错误发生在 22 次模型调用全部结束之后；修正只重跑本地评分，没有新增模型调用。
- 第二次审查发现早期诊断只统计 10 个契约有效案例，会抬高质量数字。现已改为：2 个无效 candidate 按全错进入固定分母。scope F1 从有效子集的 70.3% 降为 fail-closed 的 63.4%，semantic bundle 从 11.1% 降为 8.8%，Safe Default Recall 从 77.8% 降为 70.0%。
- 结果仍受单一 Codex 作者 Expected 影响。`future/present`、否定指令的 `cancelled/pending`、复合动作是否拆分以及 subject 表面范围存在可争议空间。因此本轮不能外推为该模型的一般自然语言正确率。
- 但即使把所有可争议标签都暂时搁置，2 个 candidate 契约失败、1 个 verifier 契约失败、0/12 完整案例和明显过度拆分仍足以否决上线。

## 下一道门

不要立刻扩大到图片或 RCO-6。先建立独立人工双人裁定的“语义政策说明 + 少量校准集”，把复合动作拆分、命令句时态、否定状态和 observation 合并规则写成可执行例子；然后只新冻结数据做一次同规格复验。若仍不能达到 12/12 契约与预注册门槛，应停止同模型 candidate + verifier 路线，改为模型只提候选、确定性规则负责语义归一化和最终安全筛选。

## 边界确认

- 未修改 Dataset、Expected、scopeIndex、plan、validator 或 cache。
- 未接稳定路径，未启动 RCO-6，未部署。
- API key 未写入 checkpoint、raw result、result、report、Git 或项目文件。
