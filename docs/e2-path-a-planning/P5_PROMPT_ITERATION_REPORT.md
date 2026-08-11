# E2.7 P5 Path A Prompt iteration report

状态：`P5_STOP_NO_CANDIDATE`。

## 固定实验条件

- Dataset：冻结的 108 条 Generalization Development；未修改 expected。
- Model：`deepseek-v4-flash`。
- Schema：`RecognitionResult 2.0`。
- Pipeline / Router / Validator / Repair：`recognition-pipeline-2.2.1` / `recognition-router-1.1.0` / `recognition-quality-2.1.0` / `recognition-repair-1.1.0`。
- 单次 Recognition；没有 FactLedger、第三次模型调用、fallback 或 mock。
- 仅部署独立 Cloudflare Preview；未部署 Production。
- 两轮候选均使用同一冻结输入与严格评分器。生成完成后统一评分。

## 严格指标

| Metric | 2.4.1 baseline | RC1 | RC2 formal 108 |
| --- | ---: | ---: | ---: |
| Completed | 108/108 | 108/108 | 100/108 |
| Task Precision | 82.17% | 79.17% | 77.95% |
| Task Recall | 75.71% | 81.43% | 70.71% |
| Material Precision | 97.87% | 97.14% | 97.69% |
| Material Recall | 93.24% | 91.89% | 85.81% |
| Time Role Accuracy | 78.85% | 76.77% | 69.62% |
| Time Value Accuracy | 74.36% | 78.06% | 68.35% |
| Event Accuracy | 93.94% | 64.71% | 81.25% |
| Evidence Coverage | 98.72% | 98.93% | 87.61% |
| Evidence Validity | 100.00% | 100.00% | 100.00% |
| Ambiguity Precision | 60.78% | 57.38% | 51.92% |
| Ambiguity Recall | 51.67% | 58.33% | 45.00% |
| Strict Major Correction | 67.59% | 62.96% | 65.74% |
| Severe Error | 0.00% | 0.00% | 8.33% |
| Transport Failure | 0.00% | 0.00% | 7.41% |

RC1 的 Task Recall 提高 5.71 个百分点，但 Task Precision 下降 3.00 个百分点且 Event Accuracy 下降 29.23 个百分点。RC2 没有恢复整体质量；与 2.4.1 相比，Task P/R、Time Role/Value、Event、Evidence 与 Severe/Transport 均不满足 Candidate 门槛。

## RC2 成功子集敏感性

RC2 的 8 条失败均为本机 `curl` / Schannel TLS 握手失败，正式结果不补跑、不删除。为区分 Prompt 与 Transport，仅对原运行中 100 条成功返回做非正式敏感性聚合：

| Metric | RC2 completed-only |
| --- | ---: |
| Task Precision | 77.95% |
| Task Recall | 78.57% |
| Material Recall | 95.49% |
| Time Role Accuracy | 77.46% |
| Time Value Accuracy | 76.06% |
| Event Accuracy | 89.66% |
| Evidence Coverage | 97.62% |
| Strict Major Correction | 63.00% |
| Severe Error | 1.00% |

该分析存在按成功返回筛选的选择偏差，不能替代 108 条正式结果。即便如此，Task、Time 和 Strict Major 仍未达标，所以 RC2 失败不能归因于传输问题 alone。

## User-impact 与语义指标

- RC1/RC2 没有重新执行盲态 User-impact 人工评审，均报告 `NOT RUN`。
- 不使用 Strict Major 代替 User-impact Major。
- P2B 已证明旧 Strict Major 的合理等价误报很高；这不会把 RC1/RC2 自动改判为合格，也不会修改 expected。
- 因严格指标已明确阻断，两轮候选均不进入 P10，不为它们创建新的 Blind。

## 性能与 Token

| Metric | 2.4.1 | RC1 | RC2 formal |
| --- | ---: | ---: | ---: |
| Mean latency | 7671 ms | 8359 ms | 8076 ms |
| P95 latency | 11788 ms | 12396 ms | 12075 ms |
| Total input tokens | 291508 | 330435 | NOT OBSERVABLE |
| Total output tokens | 157438 | 154820 | NOT OBSERVABLE |
| Observed recognize tokens | 255843 / 152861 | 288027 / 150273 | 278660 / 136586 |
| Observed repair tokens | 35665 / 4577 | 42408 / 4547 | 38827 / 4403 |
| Cost | NOT OBSERVABLE | NOT OBSERVABLE | NOT OBSERVABLE |

RC2 有 8 条无 Token 的传输失败，因此禁止把 100 条成功请求的 Token 总量冒充完整运行总量。

## 完整性与哈希

- RC1 checkpoint：`172f878015e9d3497fa919e393a1a0dbed03901a6b64ced29a93b269faa6f451`。
- RC2 checkpoint：`ae570de5c7c088072a9267f15d621bd06ac24cacd020ec16e59e6bf474851199`。
- 每个 checkpoint 均含 108 个唯一 caseId，source/input hash 无缺失。
- 历史运行器把 `cloudflare/recognition.mjs` 的 SHA-256 `de5afa6afad5ed2171f35ab60cb4dc311dd04367eb33fb1d1383cf9aa4de5eaf` 误命名为 `promptSourceSha256`。该字段不是 Prompt bundle 哈希。
- 独立补算 RC1 Prompt bundle SHA-256：`8644f0289ca96a567e916279127a1323ad6f82c549e841fc8cd7c9d2bba865c5`。
- 独立补算 RC2 Prompt bundle SHA-256：`b289983e25a9c03812bbfd5ee521c0e284281a69e1ed60322422c3a8fb4706d1`。
- Harness 已修正未来运行的 Prompt 文件绑定并新增成功行 `resultSha256`；历史 checkpoint 不伪造逐行结果哈希，整文件哈希绑定原始证据。

## P5 决策

P5 允许的两轮原则性 Prompt 候选已经用尽。RC1 与 RC2 均不满足净收益和 Candidate 门槛，不得进行第三轮 Prompt 调优，也不得部署 Production。

后续 P6–P9 的 Router、Validator、Repair 与组件消融使用冻结的 `recognition-2.4.1` Prompt；只有产生可归因净收益的独立组件才可能进入 P10。当前没有 Candidate，因此不得创建 P11 Blind。
