# E2.7 PATH A PLANNING FINAL REPORT

## 1. Executive Summary

最终状态：

- **E2 BLOCKED**
- **E3 NOT READY**
- **PRODUCTION NOT READY**

本轮完成了评测口径校准、72 条隔离人工评审、60 条规划失败审计、PlanningNormalizer、两轮 Prompt 候选、80 条 Router 与 Validator 标签评测、Repair R0/R1/R2 消融以及逐组件净收益审计。最佳输出变更臂 R2 的 Material、Event、Ambiguity 与 Evidence 有改善，但 Task Strict Precision / Recall 仍为 80.00% / 67.80%，Time Value 为 76.43%，且变更输出没有新的实体级 Semantic P/R 或独立 User-impact Major 评审。因此没有 Candidate，P11/P12 按协议停止。

## 2. FactLedger rejection boundary

E2.6 的 `FACTLEDGER NOT SUPPORTED` 保持冻结；拒绝标签为 `v2-e2-factledger-rejected`，对应提交 `f32053a`。本轮没有恢复 FactLedger、没有运行两阶段 Planner、没有把相关实验路径接入默认运行时。

Preview FactLedger 实验已在本轮开始时确认收尾；后续 Repair 实验同样仅存在于独立 Preview。最终 Preview 配置中 `E2_PATH_A_REPAIR_EXPERIMENT_ENABLED=false`，实验 bearer Secret 已删除。Production 未部署。

## 3. Git baseline

- 分支：`codex/e2-path-a-planning-v2`
- 起点：`70dd976e1de03d03e4e6fec8b6d7e872945eda27`
- P9 评测 HEAD：`2d669e81135ed93a1c6c9687f1bdd38b009c8d59`
- 基线模型：`deepseek-v4-flash`
- 基线 Prompt：`recognition-2.4.1`
- Schema：`RecognitionResult 2.0`
- Pipeline：`recognition-pipeline-2.2.1`
- 基线 Router / Validator / Repair：`1.1.0` / `2.1.0` / `1.1.0`
- 本轮已评测本地 Router / Validator：`recognition-router-1.2.0` / `recognition-quality-2.2.0`

完整基线和文件哈希见 [path-a-baseline-manifest.json](./path-a-baseline-manifest.json)。

## 4. Dataset freeze

| 集合 | 数量 | 角色 | canonical LF SHA-256 |
| --- | ---: | --- | --- |
| Golden | 110 | exposed regression | `e6bf49d61e6e489bafea78e12ead6079d992c51211fe66c490d3fd87a2a0cd63` |
| Exposed Holdout | 40 | exposed regression | `e5719bce8f70eaecc7743e98f3816f7ce543ca57f5e3cc0c2aab5c987c6181e3` |
| Generalization Development | 108 | exposed development | `6919cd89e81521beaf993ebcd8b23a752c01bbc0f5aa4559e29ff25e0c5b2659` |
| E2.6 complex diagnostic | 24 | exposed diagnostic | `9c9275e42e872899602c005d4d69fd378c8592db5cac553b809438c73970416e` |

Golden、Holdout、Development expected 均未修改；冻结测试在 UTC 与 Asia/Shanghai 下均通过。

## 5. Strict evaluation contract

旧严格评分器保留为独立的 structural 指标，历史结果不覆盖、不重命名。已修复空字符串 alias 匹配造成的虚假命中，并保持 expected 只读。Strict Major 只表示冻结评分器的重大结构失败，不等同于用户需要大改。

## 6. Semantic equivalence contract

独立 Semantic Equivalence Layer 支持 Task title/grouping/split、Milestone alias/grouping、Material/Event/Channel alias 与 date-only 等价；必须保留动作、对象、actor、modality、condition、deadline、顺序、独立完成性、Event/Task 边界、时间角色/值、不确定性与逐字 Evidence。9 个语义契约测试通过。

该层不修改 expected。当前人审标签是 case-level 判断，无法诚实生成 A6 的 entity-level Semantic Task P/R，故最终值为 `NOT RUN`。

## 7. User-impact rubric

User-impact Major 仅在缺少必做行动、错误动作/对象/actor/modality/condition、影响安排的时间错误、虚构精确值、缺失必要 Event 或影响信任的 Evidence/Safety 问题时成立。合理合并/拆分、标题别名、Milestone 粒度、容器选择和纯措辞差异不属于 Major。

## 8. Blind adjudication chronology

P2B 使用隔离审阅者，只读取去标识 packet，不读取 expected、caseId、严格分数或 reveal key：

- 审阅开始：2026-08-11 17:39:12 +08:00
- 审阅完成：2026-08-11 17:55:30 +08:00
- 标签提交：2026-08-11 17:57:26 +08:00，commit `e331bc0`
- Reveal：2026-08-11 17:57:42 +08:00

Chronology valid。该评审是对已暴露样例的“隔离盲评”，不是新的泛化 Blind。

## 9. Path A Planning Failure Audit

60 条人工审计中：Planning 相关 50/60（83.33%），Fact Discovery 5/60（8.33%），Evaluation Mismatch 37/60，合理等价 28/60，Validator missed 23/60，Router under-routed 6/60。互斥主类分布以 [P3 报告](./P3_PATH_A_PLANNING_FAILURE_AUDIT.md) 为准；非互斥发生数不得相加当作比例。

## 10. PlanningNormalizer design

Normalizer 是本地确定性、保守、Evidence 约束的规划规范化原型；不新增模型调用，不读 expected，不写 Workspace v8，不创建业务事实，不跨越 Task/Event/Material 边界。

## 11. Normalizer A/B

在冻结 P2B 72 条上，Normalizer 改变 0 条，所有严格指标 delta 为 0，Harm 0%，本地均值开销 0.094 ms。按“不变不等于值得增加复杂度”，不进入 Candidate。

## 12. Prompt changes

仅执行两轮原则性候选：`recognition-2.5.0-rc.1` 与 `recognition-2.5.0-rc.2`。两轮均被拒绝，随后代码回退并保留冻结的 `recognition-2.4.1`。没有第三轮 Prompt 规则堆叠。

## 13. Prompt iteration results

| Metric | Baseline 2.4.1 | RC1 | RC2 formal |
| --- | ---: | ---: | ---: |
| Completed | 108/108 | 108/108 | 100/108 |
| Task Precision | 82.17% | 79.17% | 77.95% |
| Task Recall | 75.71% | 81.43% | 70.71% |
| Time Role | 78.85% | 76.77% | 69.62% |
| Time Value | 74.36% | 78.06% | 68.35% |
| Event | 93.94% | 64.71% | 81.25% |
| Evidence | 98.72% | 98.93% | 87.61% |
| Strict Major | 67.59% | 62.96% | 65.74% |
| Severe | 0.00% | 0.00% | 8.33% |
| Transport Failure | 0.00% | 0.00% | 7.41% |

## 14. Router labels and metrics

80 条标签：simple 20、medium 28、complex 32。Router 1.2.0 Accuracy 97.50%，Complex Recall 100%，Under-routing 0%，Over-routing 2.50%，通过校准门槛。但 80 条实际全部选择 `single_pass`，所以没有可归因的端到端质量提升；intensive 路径继续禁用。

## 15. Validator labels and metrics

80 条、13 类标签。Validator 2.2.0 Micro Precision 94.29%，Recall 88.00%，Wrong Time Role Recall 91.67%，Missing Ambiguity Recall 100%，NO_ISSUE 误报 1/35。`INVALID_EVIDENCE` Recall 仍为 0%；Validator 只告警，不改输出，其指标不能冒充识别质量提升。

## 16. Repair ablation

R0/R1/R2 使用同一冻结首次识别结果；24 个 trigger，R1/R2 各一次真实 repair-only DeepSeek 调用，共 48/48 完成，按 source hash 交错，生成期间不读 expected。R2 相比 R0：Material R +4.46pp、Time Value +2.86pp、Event +5.13pp、Evidence +0.59pp、Ambiguity R +14.89pp、Strict Major -6.25pp；Task P/R 均无变化，Repair Harm 0%。

早期错误使用 post-repair 缓存的 44-call pilot 被保留在 Git ignored cache 并从所有指标排除；正式结果绑定 pre-repair R0。

## 17. Component-by-component ablation

详见 [P9 逐组件报告](./P9_COMPONENT_ABLATION.md)。评测契约保留为离线基础设施；Normalizer、Prompt 候选和 R2 Repair 不进入 Candidate；Router/Validator 只保留诊断用途。没有输出变更组件满足完整净收益规则。

## 18. Development metrics

108 条 Development 的冻结 2.4.1 基线 Task P/R 为 82.17% / 75.71%；两轮 Prompt 候选均未通过。R2 使用独立 80 条混合集，不得把其总体指标冒充 Development 指标。最终没有达到 Development Candidate 门槛。

## 19. Golden regression

正式 Candidate 不存在，因此全量 110 Golden Candidate regression：**NOT RUN**。P6 混合集只包含 10 条 Golden，不能替代全量门槛。数据冻结和代码回归测试通过，但这不等于模型质量回归通过。

## 20. Exposed Holdout regression

P6/P8 混合集包含全部 40 条 Exposed Holdout，但提交的聚合是 80 条总体结果，没有按来源集证明实质改善。由于更早硬门槛已失败，没有为不存在的 Candidate 补做独立 Holdout Candidate regression。结论：**NOT PROVEN**。

## 21. Candidate manifest

Candidate：`null`。没有冻结 commit/model/prompt/pipeline 组合，没有把 R2 设为默认，没有 Candidate Preview 部署。机器可读门槛见 [p10-final-gate.json](./p10-final-gate.json)。

## 22. Blind protocol

协议要求 Candidate 内部门槛通过后，才可创建至少 60 条全新 Blind，且生成阶段不得读取 expected。因为 P10 失败，本轮没有创建未来 Blind、没有查看未来 Blind expected。

## 23. Blind results

P11：**NOT RUN — Candidate internal gate failed**。

## 24. Strict vs Semantic metrics

P2B 72 条中 Strict Major 41/72（56.94%），User-impact Major 14/72（19.44%）；Strict Major 相对 User-impact 的 Precision 19.51%、Recall 57.14%。31/41（75.61%）Strict Major 被人审判为合理等价结构。

这证明旧 Strict Major 大量高估用户影响；但 case-level 等价标签不足以生成 A6 的 entity-level Semantic Task P/R。因此 A6 Strict 80.00% / 67.80% 与 Semantic `NOT RUN` 必须并列报告。

## 25. User-impact results

P2B 基线输出 User-impact Major 14/72（19.44%）。按来源：Golden 2/24、Exposed Holdout 7/24、Development 5/24。A6 改变后的输出没有重新隔离评审，故 A6 User-impact Major 为 `NOT RUN`，不得沿用基线 19.44%。

## 26. Severe errors

R0/R1/R2 的 80 条诊断 Severe Error 均为 0%。RC2 formal 108 为 8.33%，因此已拒绝。安全门槛通过不抵消 Task 与 Time Value 硬门槛失败。

## 27. Browser A–J

P12：**NOT RUN**。协议要求 Blind 先达标；本轮 P11 未运行，因此没有对 Preview 执行 A–J 浏览器验收。不得把单元测试或 Cloudflare dry-run 冒充真实浏览器验收。

## 28. Latency

80 条 R0 全路径 mean / p95 为 7727 / 13013 ms。R2 repair-only mean / p95 为 2606 / 3917 ms；因只触发 24/80，全路径 mean 为 8509 ms，比 R0 增加 782 ms。Cost 为 `NOT OBSERVABLE`。

## 29. Token usage

R0 recognition 共 189,215 input / 121,108 output tokens。R2 额外增加 94,034 input / 5,380 output tokens；即额外输入约为 R0 input 的 49.70%，但 Task P/R 没有提升。

## 30. Transport reliability

P8 正式 48 次 repair 调用完成 48、失败 0、无 fallback/mock/旧缓存替代。P5 RC2 有 8/108 Schannel/TLS 失败，formal Transport Failure 7.41%，没有补跑覆盖失败。Worker 测试验证 502/503 仅一次有限重试、400 不重试。

## 31. Engineering tests

2026-08-11 实际运行：

| Command | Result |
| --- | --- |
| `npm ci` | PASS；0 vulnerabilities；有 4 个未列入 allowScripts 的依赖安装脚本警告 |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `TZ=UTC npm run test` | PASS；Vitest 50 files / 213 tests，后续 Node/Server/Worker/Functions 均通过 |
| `TZ=Asia/Shanghai npm run test` | PASS；Vitest 50 files / 213 tests，后续 Node/Server/Worker/Functions 均通过 |
| Server tests（单独） | PASS；8/8 |
| Worker tests（单独） | PASS；26/26 |
| Functions tests（单独） | PASS；5/5 |
| `npm run build` | PASS；1679 modules |
| `npm run cloudflare:check` | PASS；Production/Preview 都是 dry-run，未部署 |

## 32. Security regression

- `npm run security:scan`：PASS，扫描 381 个 source/build 文件。
- `npm audit --audit-level=high`：PASS，0 vulnerabilities。
- Prompt Injection、Origin、字段白名单、超时、安全错误、私网/重定向 SSRF 测试通过。
- DeepSeek key 仅使用服务端 Secret；没有写入本地文件或 Git，也没有输出 Secret。
- `npm ci` 提示 `esbuild`、`tesseract.js`、`workerd` 的 4 个安装脚本尚未列入 allowScripts；本轮没有擅自批准，保留为供应链审阅项。

## 33. E1 regression

Workspace v8、Repository、Migration、DomainCommitPlan、Capture/Commit、Source-before-AI 均未修改。两时区全套测试、独立 Server/Worker/Functions 测试和 build 均通过。没有进入 E3/E4，没有 Project Matching、Project Memory、Follow 或自动项目更新。

## 34. Files changed

相对 `70dd976` 共 91 个受控文件：docs 53、scripts 21、src 11、cloudflare 4、root/config 2。范围包括评测契约、隔离标签/聚合、诊断 harness、Normalizer/Router/Validator/Repair 原型与 Preview-only 端点。原始模型输出留在 Git ignored `.evaluation-cache/`；未提交 Secret、用户材料或 output。

## 35. Remaining risks

1. 主导 Task planning gap 未解决：R2 Task Recall 仅 67.80%。
2. A6 缺少 entity-level Semantic P/R 和独立 User-impact 重评。
3. 不存在 Candidate 的全量 Golden 与按来源 Holdout 回归证据。
4. Validator 的 `INVALID_EVIDENCE` Recall 为 0%。
5. Router 标签来自 exposed diagnostics；intensive 路径没有因果质量证据。
6. 本地已评测 Validator 为 2.2.0，而默认 Cloudflare recognition quality 仍为 2.1.0；因没有 Candidate，本轮没有进行默认运行时集成。
7. Repair 额外输入 Token 较高，Task 无收益。
8. P2B 是隔离 Codex 审阅，不是外部人类研究或新的泛化 Blind。
9. Browser A–J 未运行；不能声明端到端用户闭环通过。

## 36. E2 final status

**E2 BLOCKED**。

直接原因：Candidate 内部门槛失败，且语义与用户影响证据缺失；按停止条件不得继续堆 Prompt、不得创建 Blind。

## 37. E3 readiness

**E3 NOT READY**。未实现或启动 E3。

## 38. Production readiness

**PRODUCTION NOT READY**。没有 Production Candidate，没有部署 `student-affairs.site`，没有将实验路径设为默认。

## 下一步建议（不自动启动）

如后续获得明确授权，只能进入独立的 **E2.9 Complex Model Benchmark**：冻结 Pipeline、Prompt、Schema、Normalizer、Validator、Repair、Dataset、Scorer，仅比较复杂通知模型能力。不得在本轮自动启动。
