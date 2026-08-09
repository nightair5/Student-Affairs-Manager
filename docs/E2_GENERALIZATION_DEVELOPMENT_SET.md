# E2 Generalization Development Set

状态：`G2 FROZEN — DEVELOPMENT ONLY`

## 1. 目的

该数据集用于解决第一轮候选在陌生表达、结构和语体上的泛化下降。它可以用于 Prompt、Router、Validator 和 Repair 的开发与回归，但永远不能作为最终 Blind Test，也不能单独证明 E2 完成。

## 2. 规模与结构

| 项目 | 值 |
| --- | ---: |
| 样本数 | 108 |
| 语义家族 | 27 |
| 每个家族的结构变体 | 4 |
| 参考时刻 | `2026-08-08T08:00:00+08:00` |
| 默认时区 | `Asia/Shanghai` |
| 数据集版本 | `e2-generalization-development-1.0.0` |

每个家族保留相同核心业务语义，同时改变句序、段落、主动/被动表达、正式/口语语体、列表/表格形式与显式程度。四种变体标记为 `direct`、`reordered`、`formal`、`conversational`。

## 3. 类别分布

| 类别 | 样本 |
| --- | ---: |
| course | 16 |
| application | 12 |
| event | 12 |
| material | 12 |
| multi_deadline | 12 |
| competition | 8 |
| information_only | 8 |
| vague_time | 8 |
| complex_notice | 4 |
| meeting | 4 |
| scholarship | 4 |
| ocr_noise | 4 |
| security | 4 |

## 4. 泛化维度

每个维度至少由一个完整的四变体家族覆盖：

- 短消息、长通知、口语群聊、正式公文、表格化通知、OCR 噪声。
- 多段落、顺序混乱、材料先行、时间先行、时间藏在备注、材料藏在附件说明。
- 无典型动作词、Event 与 Task 混合、多个 Event、多个 Deadline。
- 模糊时间、相对时间、冲突时间、可选事项、条件事项。
- 纯信息、无需操作、安全 Prompt Injection。

## 5. 标注范围

每条样本冻结以下 expected：

- Project Decision 与必要时的项目标题。
- Milestone、Task/Subtask、Material、TimePoint、Event。
- 逐实体 Evidence 片段。
- Ambiguity 与 forbidden output。
- TimePoint 类型、精度、是否需要确认和可安全确定时的本地时间。

自动测试要求所有预期 Task 对象、Material 名称、TimePoint 原文、Event 标题及 Evidence 片段在对应正文中逐字存在。测试同时检查 ID/文本唯一性，以及与原 110 Golden 和原 40 Exposed Holdout 不存在完全重复正文。

## 6. 冻结与订正

- 语义哈希：`31fc538f6f774b2cca8eaf8a252c88995e17a27904d5dda3325f8292c2e61e22`
- 源文件 SHA-256：`6919cd89e81521beaf993ebcd8b23a752c01bbc0f5aa4559e29ff25e0c5b2659`
- 冻结清单：`docs/baselines/e2-generalization/development-freeze.json`
- 订正日志：`docs/baselines/e2-generalization/development-corrections.json`

后续不得为了提高指标直接改 expected。发现合法标注错误时，必须先记录 case ID、原值、新值、证据与原因，再更新哈希和版本。

## 7. 运行方式

本地规则冒烟：

```powershell
npm run eval:recognition:e2 -- --provider=local-fallback --dataset=generalization --label=g2-local
```

真实 DeepSeek 仅允许显式指向 Preview，并要求服务端 Secret 已配置：

```powershell
npm run eval:recognition:e2 -- --provider=deepseek-production --dataset=generalization --label=g2-before --endpoint=https://<preview-worker>/api/deepseek --origin=https://<preview-worker> --expected-prompt=recognition-2.3.0 --transport=python-session --resume=true
```

原始输出只进入 Git 忽略的 `.evaluation-cache/`。常规 CI 不调用付费模型。

## 8. 防污染边界

- 本数据集是可见开发集，不是 Blind。
- 原 Golden 与原 Holdout 只承担回归职责。
- 最终候选冻结后才建立全新 Blind inputs/labels；开发代码不得读取 Blind labels。
- Blind 正式运行一次后即失去 Blind 资格，无论结果成功或失败。
