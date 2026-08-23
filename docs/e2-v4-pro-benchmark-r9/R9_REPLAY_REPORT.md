# E2.9-R9 Planner 精度修复与零模型复裁报告

## 最终结论

`R9_REPLAY_GATE_PASS_SCREENING_REQUESTABLE`

R9 完成了 R8 失败案例的只读归因、实体与 Planner 权限冻结、隔离 Planner 最小修复、16 条冻结 observation 的零生产模型回放，以及全新的 path-masked 匿名复评。预注册 Gate 全项通过。

这只表示可以另行申请一次全新小规模 Screening。本轮没有申请授权、没有运行 Screening，也没有运行 Selection、创建 Blind 或部署 Production。

## 执行边界

- 基线：`3f67959`
- 分支：`codex/e2-9-r9-planner-precision-repair`
- R8 有效失败记录：`e29r8-replay-review-20260821-d` / `R8_REPLAY_ADJUDICATION_FAIL`，保持不变
- 新增生产 recognition/generation 调用：0
- 网络请求：0
- Expected：候选生成阶段未读取；匿名审阅未读取；候选冻结并哈希后，仅独立严格评分阶段读取
- Prompt、RecognitionResult Schema、Scorer 语义、Expected、Workspace v8、Repository、Migration、DomainCommitPlan、Production 默认链路：均未修改
- 原始候选、匿名包、映射、标签与 reveal：只保存在 Git ignored 的 `.evaluation-cache/e2-9-r9/`

“零模型回放”仅指没有新增生产 recognition/generation 调用。匿名审阅者是 fresh same-family LLM-as-judge；它不是人工评审、不是 Ground Truth，只是 provisional proxy。

## R8 失效归因与通用失效图谱

完整逐条证据见 `R9_READ_ONLY_FAILURE_ATTRIBUTION.md`，机器可读图谱见 `failure-map.json`。分析覆盖了候选全部 6 条 Planning Error、3 条 Major Correction、唯一 1 条 Over-splitting、至少 3 条真实改善、Baseline 优于 Candidate 的案例以及 Tie 中双方共同错误。

通用根因如下：

1. 等价 obligation 仅因非语义连接词差异被投影为两个 Task，造成唯一 Over-splitting。
2. 同一适用条件的 raw ambiguity 与 condition-derived ambiguity 因 Evidence ID 不同形成重复确认项。
3. 动作和对象逐字来自原文，但仅因 adapter 来源被错误降为 `strong_inference`。
4. 两条“中午”被上游冻结 Fact 精确化为 12:00，属于 Fact Extraction 输入错误，Planner 无权修正。
5. 两条“访谈提纲”没有进入上游 Material Fact，属于 Fact Discovery 输入缺口，Planner 不得凭 Task object 发明 Material。

候选真实改善包括：保留纯信息 Event/TimePoint、把明确参加义务组织为 Task 且保留 Event、对已有模糊时间保持空值并要求确认、保留逐字列出的材料对象。修复没有针对 caseId、学校名、比赛名、材料名或固定句子。

## 冻结契约与最小修复

冻结契约见 `entity-planner-contract-freeze.json`，Gate 见 `replay-gate-preregistration.json`。核心边界是：

- FactGraph 只表达已发现事实；原始 FactGraph 不修改。
- Task 必须绑定用户动作、明确对象、obligation 和 evidence。
- Event、Material、Milestone、TimePoint 不能因为需要“保留事实”而自动变成 Task。
- Planner 不能改变时间角色或时间值，不能猜测 Condition/Ambiguity。
- Normalizer 只能处理引用与无业务含义的格式，不得增删或改写业务事实。

最小修复只作用于隔离 Planner：

- 当 obligation 的动作谓词相同、对象仅有标点/非语义连接词差异，并且共享 Event 或逐字证据重叠时，只在 Planner view 中合并为一个 Task；原 obligation 全部保留。
- 同义适用性 ambiguity 只有在原文证据区间重叠时才合并，并保留 evidence union。
- 有精确逐字证据的动作维持 `explicit`，不因 adapter provenance 自动降级。

生产 Worker、正式 recognition runtime 与 Workspace v8 没有接入 R9 路径。

## 通用回归测试

新增 19 项通用测试，覆盖用户要求的 18 类测试族及连接词等价的反例边界：纯信息 Event、参加义务、Event/Task 去重、Material/Milestone/TimePoint 不冒充 Task、提交材料 Task、同一动作限制条件、独立交付物拆分、四类时间角色、局部 Condition、Ambiguity 保留、Normalizer 权限、Task obligation/evidence 绑定、Fact Loss、Unsupported Task 与 Over-splitting。

测试文本均为匿名改写的通用业务样例，没有使用冻结样例完整固定句子。

## 16 条零生产模型回放

输入为 R7/R8 已冻结的 16 个 observation，覆盖 8 个 source case，每条完整执行同一 R9 隔离管线。候选先生成、冻结并哈希，之后才由另一个评分阶段读取 Expected。

- candidate checkpoint canonical JSON SHA-256：`f8a7ea4d138ecb7effd42ae239b6962feb4a0633d9b896c2534d96d2085df608`
- source manifest SHA-256：`115b43f98d0ca56cac522d0272ed10894fa0cc2a185562d0c10ce4bff7aca12f`
- frozen checkpoint SHA-256：`0886afb941eeb74d80d9ed35601ee50447c0e4b464310ac197fd39df006fa336`

### 契约保真指标

| 指标 | Baseline | R9 Candidate | 变化 |
| --- | ---: | ---: | ---: |
| Fact Coverage | 87.50% | 100.00% | +12.50pp |
| Fact Loss | 17 / 136 | 0 / 136 | -17 |
| Obligation Coverage | 82.50% | 100.00% | +17.50pp |
| TimePoint Coverage | 90.24% | 100.00% | +9.76pp |
| Time Role Accuracy | 90.24% | 100.00% | +9.76pp |
| Event Coverage | 83.33% | 100.00% | +16.67pp |
| Condition Coverage | 0.00% | 100.00% | +100.00pp |
| Ambiguity Coverage | 88.24% | 100.00% | +11.76pp |
| Unsupported Task | 0 | 0 | 不增加 |
| Vague-time False Precision | 3 | 0 | -3 |
| Evidence Coverage | 100.00% | 100.00% | 不退化 |
| Severe Error | 0 | 0 | 不增加 |

这里的 Fact Coverage 是“冻结 FactGraph 经 Planner 后是否保留”的内部保真指标，不是对原文的独立 Fact Recall。

### 冻结严格评分

| 指标 | Baseline | R9 Candidate | 变化 |
| --- | ---: | ---: | ---: |
| Task Precision | 87.50% | 74.36% | -13.14pp |
| Task Recall | 87.50% | 90.63% | +3.13pp |
| Milestone Precision / Recall | 51.85% / 53.85% | 51.85% / 53.85% | 不变 |
| Material Precision / Recall | 92.31% / 92.31% | 100.00% / 92.31% | +7.69pp / 不变 |
| TimePoint Type Accuracy | 86.84% | 78.57% | -8.27pp |
| TimePoint Value Accuracy | 81.58% | 78.57% | -3.01pp |
| Event Accuracy | 100.00% | 83.33% | -16.67pp |
| Ambiguity Precision / Recall | 66.67% / 71.43% | 68.75% / 78.57% | +2.08pp / +7.14pp |
| Strict Major Correction | 68.75% | 75.00% | +6.25pp |
| Strict Planning Error | 81.25% | 93.75% | +12.50pp |
| Evidence Coverage | 100.00% | 100.00% | 不变 |
| Severe Error | 0.00% | 0.00% | 不变 |

严格评分没有被隐藏：它对候选更差。主要原因是冻结 Expected 对合理等价结构、Event/Task 双表示与模糊时间的口径，和用户影响评审存在冲突。本轮没有修改 Expected 或 Scorer 来消除冲突，而是把两套结果分开报告。

## 全新 path-masked 匿名复评

全新 run `e29r9-replay-review-20260824-a` 使用全新 packet、逐 observation X/Y 映射、mapping commitment、labels、reveal 和 Gate result。

- packet SHA-256：`280277fb9d6538beca4bf8650fe6149b1f21a848647d2234f0606d5aa7dd284a`
- labels SHA-256：`d2b98781469f5bcf1ce73f49232ec53589ab67379ba2bffbf99eaeb58e77fec9`
- Gate preregistration SHA-256：`2a78229a4b33e51635aa01f1a1d1c68f09751ada8e91917445539e79894723ae`
- Gate policy SHA-256：`cb7de1d8b08a7548b69b8a84062509e407851d526fdb3e25a80859153b0ef73d`

机器身份扫描与独立 packet audit 均通过；审阅流程只向审阅者提供 reviewer packet，但没有操作系统 ACL 或访问日志可以证明技术上的强隔离。packet audit 在标签前完成，labels 在 reveal 前冻结。Expected 未进入匿名包。

| 用户影响指标 | Baseline | R9 Candidate |
| --- | ---: | ---: |
| Preferred | 1 | 8 |
| Tie | 7 | 7 |
| Major Correction | 9 | 3 |
| Planning Error | 9 | 4 |
| Fact Loss | 2 | 0 |
| Over-splitting | 0 | 0 |
| Evidence Gap | 0 | 0 |
| Severe Error | 0 | 0 |

## Gate 逐项结果

| 预注册条件 | 结果 |
| --- | --- |
| pairCount = 16 | PASS |
| determinate pairs >= 14 | PASS，16 |
| Candidate Preferred - Baseline Preferred >= 3 | PASS，7 |
| Baseline Preferred <= 3 | PASS，1 |
| Candidate Major Correction <= Baseline | PASS，3 <= 9 |
| Candidate Planning Error < Baseline | PASS，4 < 9 |
| Candidate Fact Loss <= Baseline | PASS，0 <= 2 |
| 双方 Fact Loss 均为 0 时允许零损失天花板 | 政策已启用；实现字段恒真，不作为独立成绩证据。本轮为 0 对 2，主条件已通过 |
| Candidate Over-splitting <= Baseline | PASS，0 <= 0 |
| Candidate Evidence Coverage >= Baseline | PASS，0 gap <= 0 gap |
| Candidate Severe Error <= Baseline | PASS，0 <= 0 |
| labels 早于 reveal、Expected 不入包、生产生成调用为 0 | PASS |

## Screening 申请状态

`REQUESTABLE_NOT_RUN`

`screening-request.json` 只冻结一份建议：新 protocol、新 run label、新 observation labels，建议上限 16 次生产 recognition/generation 调用。它不是调用授权，也没有触发任何模型请求。Selection 为 `NOT_RUN`，Blind 为 `NOT_CREATED`，Production 为 `NOT_DEPLOYED`。

## 修改文件

- 诊断与冻结：`docs/e2-v4-pro-benchmark-r9/R9_READ_ONLY_FAILURE_ATTRIBUTION.md`、`failure-map.json`、`entity-planner-contract-freeze.json`、`replay-gate-preregistration.json`
- 隔离实现与测试：`cloudflare/e2-r9-contract-replay-metrics.mjs`、`cloudflare/e2-r9-isolated-planner.mjs`、`cloudflare/e2-r9-tests.mjs`
- 回放与匿名复评：`scripts/run-e2-9-r9-replay.mjs`、`scripts/e2-9-r9-path-mask.mjs`、`scripts/e2-9-r9-path-mask.node.mjs`、`scripts/run-e2-9-r9-path-masked-review.mjs`
- 匿名聚合与报告：`docs/e2-v4-pro-benchmark-r9/cache-replay-result.json`、`path-masked-review-result.json`、`PATH_MASKED_REVIEW_REPORT.md`、`EXPERIMENT_AUDIT.md`、`experiment-audit.json`、`screening-request.json`、本报告
- 工程入口：`package.json`

## 剩余风险

1. 匿名裁决来自 same-family LLM proxy，不是人工或独立 Ground Truth，可能偏好同系列表达方式。
2. 严格评分与用户影响评分明显冲突；在新鲜、未见输入上是否仍成立，只能由后续获批 Screening 验证。
3. 上游两类 Fact 问题仍未修复：模糊时间被精确化、Material Fact 未发现。R9 Planner 按权限边界不改写它们。
4. 16 observations 只有 8 个唯一 source，样本量小且全部已暴露，不能代替 Blind。
5. 原始 cache、时间戳与 commitment 都是本机证据，没有外部时间戳或不可变存储见证。
6. R9 路径仍是隔离实验实现，没有 Worker/Production 集成，也没有真实 Preview/Production E2E。

## 状态冻结

- R9：`R9_REPLAY_GATE_PASS_SCREENING_REQUESTABLE`
- Screening：`REQUESTABLE_NOT_RUN`
- Selection：`NOT_RUN`
- Blind：`NOT_CREATED`
- Production：`NOT_DEPLOYED`
- E3/E4：`NOT_ENTERED`
