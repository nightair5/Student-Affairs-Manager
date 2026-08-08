# Student Affairs Product v2.0 — E2-A Recognition Baseline Report

## 1. 结论

E2-A 已完成，当前 `DeepSeek RecognitionResult 2.0` 的质量已经可以用固定数据集与固定口径复现衡量。本轮没有修改 Prompt、模型、temperature、Domain v8、Migration、Repository、Project Matching 或 Follow。

当前生产 DeepSeek 的优势是：Project Decision、Task Precision/Recall、Event 和 Evidence 已有可用基础，未出现重复或过度拆分；主要短板是：顶层 TimePoint、独立 Material、Milestone 和 Ambiguity 大量缺失。结果合法不等于可直接确认，87.27% 的样例仍触发 Major Correction。

## 2. 冻结基线

| Item | Value |
| --- | --- |
| Dataset | `e2-a-golden-1.0.0` |
| Samples | 110（11 组 × 10） |
| Result schema | `RecognitionResult 2.0` |
| Prompt version | `recognition-2.0.0` |
| Model | `deepseek-v4-flash` |
| Production endpoint | `https://student-affairs.site/api/deepseek/extract` |
| Prompt source SHA-256 | `75e0bcdf8e09f88241e92d8cc97fc18bdf2362c80ff355192e904443f9f57793` |
| Reference time | `2026-08-08T08:00:00+08:00` |
| Timezone | `Asia/Shanghai` |
| Initial pass | `2026-08-08T12:38:00.856Z` – `2026-08-08T13:04:07.666Z` |

数据集全部为合成、匿名学校事务文本，不包含真实姓名、学号、电话、文件或用户工作区数据。覆盖课程、复杂通知、比赛、申请、活动、多截止、材料、模糊时间、纯信息、OCR 噪声与安全输入。每条样例均定义完整 expected collections 与 forbidden output；空集合代表不应臆造该实体。

## 3. DeepSeek 与 fallback 严格分离

| Metric | DeepSeek production | Local fallback |
| --- | ---: | ---: |
| Completed | 108 / 110 | 110 / 110 |
| Project Decision Accuracy | 84.55% | 79.09% |
| Milestone Precision | 52.17% | 58.97% |
| Milestone Recall | 16.44% | 31.51% |
| Task Precision | 81.90% | 69.40% |
| Task Recall | 74.80% | 73.23% |
| Material Recall | 30.69% | 58.42% |
| TimePoint Accuracy | 6.38% | 25.81% |
| Event Accuracy | 86.96% | 52.00% |
| Evidence Coverage | 95.33% | 87.94% |
| Duplicate Rate | 0.00% | 0.00% |
| Over-fragmentation Rate | 0.00% | 0.00% |
| Major Correction Rate | 87.27% | 94.55% |
| Severe Error Rate | 5.45% | 18.18% |
| Invalid Output Rate | 0.00% | 0.00% |
| Request Failure Rate | 1.82% | 0.00% |
| Latency Mean | 6,266 ms | 0.25 ms |
| Latency P50 | 5,698 ms | 0 ms |
| Latency P95 | 12,725 ms | 1 ms |
| Token Usage | NOT OBSERVABLE | N/A |
| Cost | NOT OBSERVABLE | N/A |

两列不是 A/B 模型实验。fallback 是同一 Golden Dataset 上的确定性本机规则结果，仅用于说明降级路径，绝不能与 DeepSeek 混合平均或替代生产模型成绩。

## 4. DeepSeek 分类表现

| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course | 90% | 90% | 81.82% | 11.11% | 0% | 50% | 100% | 90% |
| complex_notice | 90% | 65% | 48.15% | 73.91% | 6.45% | 88.89% | 86.21% | 100% |
| competition | 60% | 100% | 60% | 50% | 0% | 100% | 90% | 100% |
| application | 0% | 90% | 90% | 40% | 0% | 100% | 100% | 100% |
| event | 100% | 0%* | 100% | 100% | 70% | 100% | 80% | 60% |
| multi_deadline | 90% | 100% | 100% | 0% | 0% | 100% | 100% | 100% |
| material | 100% | 100% | 100% | 30% | 0% | 100% | 100% | 100% |
| vague_time | 100% | 0% | 0% | 100% | 0% | 0% | 100% | 100% |
| information_only | 100% | 0%* | 100% | 100% | 100% | 100% | 100% | 10% |
| ocr_noise | 100% | 88.89% | 80% | 11.11% | 0% | 100% | 100% | 100% |
| security | 100% | 100% | 100% | 0% | 0% | 100% | 100% | 100% |

`*` Event 和 information-only 的黄金任务数为 0；Task Precision 为 0 表示出现了不应创建的任务，不能解读成一般任务抽取能力为 0。

## 5. Error Taxonomy

| Category | Count | 解释 |
| --- | ---: | --- |
| `time_missing` | 127 | 截止/事件时间常保留在任务描述或证据中，但没有形成可引用的顶层 TimePoint；多截止、材料、OCR、安全组均为 0% TimePoint Accuracy。 |
| `material_missing` | 67 | 交付物常进入任务 actionObject/description，却没有作为独立 Material；多截止和安全组 Material Recall 为 0%。 |
| `milestone_missing` | 56 | 新项目多未生成阶段；比赛组 Milestone Recall 为 0%，复杂通知也只达到 42.86%。 |
| `project_decision` | 29 | 申请组 10/10 未按 Golden 识别为新项目，比赛组也有明显偏差。 |
| `task_missing` | 29 | 复杂通知、模糊时间和 OCR 噪声是主要来源。 |
| `ambiguity_missing` | 26 | 模糊时间与 OCR 噪声各有 10 条未正确标记歧义，其余来自复杂通知。 |
| `task_spurious` | 17 | 模糊时间的动作/对象边界最不稳定；纯信息中 1 条臆造任务。 |
| `evidence_missing` | 6 | 总体 Evidence Coverage 高，但复杂通知和活动仍有字段证据缺口。 |
| `event_missing` | 2 | 少量准备/参与语义没有形成 Event。 |
| `request_failure` | 2 | `e2-complex_notice-08` 与 `e2-competition-03` 首轮返回 HTTP 502，已保留且未重试。 |
| `task_hierarchy` | 2 | 复杂结题案例的 Subtask 父子关系未达到 Golden 契约。 |

DeepSeek 结果中没有命中 forbidden output，没有发现重复任务或超过定义容差的过度拆分。安全输入组没有把泄密、删除、外发或修改数据库指令变成语义任务；但是它仍未形成 Material 与 TimePoint，因此不能视为完整通过。

## 6. Major Correction 与 Severe Error

Major Correction 在以下任一情况触发：Project Decision 错误、Task/TimePoint 命中低于 50%，或存在任一 major taxonomy failure。该指标为 87.27%，说明当前结果通常仍需用户补材料、补时间、修正项目归属或层级后才能确认。

Severe Error 为 5.45%，包括两条真实请求失败，以及在预期无任务的来源上臆造可执行任务等高风险结果。它不等同于 Major Correction：多数结果结构可用、证据也存在，但仍需要较大人工修正。

## 7. Token、成本与时延

生产 Worker 会在服务端日志记录 completion token，但现有 `/api/deepseek/extract` 响应没有返回 input/output usage，本轮也没有修改 Worker 或接触服务端密钥。因此：

- Token Usage：`NOT OBSERVABLE`
- Cost：`NOT OBSERVABLE`
- 禁止用字符数、响应长度或公开价目表估算值冒充本次实测。

时延是客户端端到端实测：平均 6.27 秒、P50 5.70 秒、P95 12.73 秒；复杂通知平均 12.11 秒，是最慢类别。

## 8. Baseline Run Note

首轮运行暴露了 Evaluation Harness 自身的空字段评分崩溃：模型返回的部分 ambiguity 没有展示用 `field`，评分器直接调用字符串方法，导致 26 条结果未保存并被误记为 invalid output。该问题只在评测器中修复：空值安全归一化，并将 forbidden task 检查限定到任务标题/动作对象，避免把描述中的格式要求误报为独立任务。

由于 26 条受影响样例没有留下首轮原始结构，它们在评分器修复后各补跑一次；两条首轮 HTTP 502 原样保留、未重试。最终 Invalid Output Rate 为 0%，不能再引用校正前的 23.64%。本说明是报告不可删除的审计记录。

## 9. 可复现产物

- `deepseek-production-summary.json`：冻结标识、总指标与按组指标。
- `deepseek-production-failures.json`：每个失败样例的 case ID、分类、严重度和原因。
- `deepseek-production-baseline.md`：机器生成的生产基线表。
- `local-fallback-*`：同一 Golden Dataset 的独立 fallback 结果。
- `.evaluation-cache/`：Git 忽略的原始结果与断点，只用于本机续跑和离线重算。

## 10. E2-A 状态

`COMPLETE — STOP BEFORE E2-B`

E2-A 已回答“当前有多好、差在哪里”。下一阶段如要修改 Prompt、结果归一化、材料/时间节点生成或 Project Decision，必须另行批准进入 E2-B；本轮不做任何质量优化。
