# E2.9-R8 隔离 Planner 修复与零模型回放报告

## 结论

R8 已完成通用失效图谱、实体契约冻结、受限 Normalizer、隔离 Planner、零模型回放和通用回归测试。修复没有接入 Production，也没有调用模型。

零模型回放证明隔离架构显著减少事实丢失，但冻结严格评分仍未通过。因此当前结论是：

`R8 VALID REPLAY FAVORS CANDIDATE / FROZEN GATE FAILED / FRESH SCREENING NOT REQUESTED`

这不是质量 Gate 通过，也不是允许 Selection 的结论。

## 第一性原理修复

旧链路把“发现事实”和“决定结构”混在一起，Normalizer 还拥有删除和改写业务事实的权限。结果是模型原始输出已经发现事件、参加义务或时间，规范化后却被删掉。

R8 将链路拆成：

`cached raw output → FactGraph adapter → frozen Fact contract → restricted reference normalizer → isolated Planner → RecognitionResult 2.0`

- FactGraph 只回答原文说了什么。
- Normalizer 只能去重引用、删除悬空引用、补齐已有双向关系。
- Planner 只能把已冻结 obligation 组织为 Task，不能发明 Task。
- 纯信息通知允许没有 Task，但明确 Event 和 TimePoint 必须保留。
- 相对或模糊时间必须保持 `normalizedValue=null` 并要求确认。

通用失效模式见 `failure-map.json`，冻结实体与权限见 `entity-contracts.json`。

## 零模型回放

输入为 R7 已冻结 Screening 的 16 个 observation，使用既有 raw cache；模型调用数为 0。Expected 只在统一评分阶段读取，未被修改。

### 事实契约保真

| 指标 | 旧规范化结果 | R8 隔离 Planner | 变化 |
| --- | ---: | ---: | ---: |
| Fact Coverage | 86.76% | 100.00% | +13.24pp |
| Fact Loss | 18 / 136 | 0 / 136 | -18 |
| Obligation Coverage | 80.00% | 100.00% | +20.00pp |
| TimePoint Coverage | 90.24% | 100.00% | +9.76pp |
| Time Role Accuracy | 90.24% | 100.00% | +9.76pp |
| Event Coverage | 83.33% | 100.00% | +16.67pp |
| Condition Coverage | 0.00% | 100.00% | +100.00pp |
| Ambiguity Coverage | 88.24% | 100.00% | +11.76pp |
| Unsupported Task | 0 | 0 | 不增加 |
| Vague-time False Precision | 3 | 0 | -3 |

架构保真检查全部通过，Evidence Coverage 为 100%，Severe Error 未增加。

这里的 100% 是“FactGraph 进入 Planner 后不再丢失”的内部保真率，不等于对原文的独立 Fact Recall。FactGraph 来自既有模型 raw output 加通用逐字动作抽取，尚未经过新的独立人工事实标注。因此它足以验证 Normalizer/Planner 是否删事实，但不足以单独证明最终用户质量已经达标。

### 冻结严格评分

| 指标 | 旧规范化结果 | R8 隔离 Planner | 变化 |
| --- | ---: | ---: | ---: |
| Task Precision | 87.50% | 72.50% | -15.00pp |
| Task Recall | 87.50% | 90.63% | +3.13pp |
| Material Precision | 92.31% | 100.00% | +7.69pp |
| TimePoint Type Accuracy | 86.84% | 78.57% | -8.27pp |
| Event Accuracy | 100.00% | 83.33% | -16.67pp |
| Ambiguity Recall | 71.43% | 78.57% | +7.14pp |
| Major Correction | 68.75% | 75.00% | +6.25pp |
| Planning Error | 81.25% | 93.75% | +12.50pp |
| Evidence Coverage | 100.00% | 100.00% | 0 |
| Severe Error | 0.00% | 0.00% | 0 |

严格 Gate 未通过。主要冲突是：冻结 Expected 将部分“纯信息 Event/TimePoint”和“事件本身 + 用户参加义务”的双表示判为多余，而 path-masked 同族 LLM 代理审阅口径认为这些事实不应丢失。该代理审阅不是人工 Ground Truth。R8 不修改 Expected，也不以契约分覆盖严格分。

## 为什么暂不申请 Screening

申请新 Screening 需要零模型回放同时满足：

1. 架构保真门槛通过；
2. 冻结严格分不出现无法解释的 Precision、Planning Error 或 Major Correction 退化；
3. 如两种口径冲突，先由未接触模型映射的独立审阅者对匿名 before/after 结果确认用户影响。

前三轮匿名包分别因固定 quality/内部 ID、格式风格、内部歧义代码造成路径可关联，均按规则作废且没有选择性补评。第四轮使用统一语义展示层、自动关联扫描、Expected-key 防火墙和标签前映射承诺，匿名审计通过。

有效第四轮共16个 observation、8个唯一来源：R8候选胜9组、旧流程胜1组、平6组；候选重大修改3对10、规划错误6对10、事实遗漏0对0、过度拆分1对0。预先冻结的8项 Gate 通过6项、失败2项：事实遗漏要求严格更低但双方同为0；候选过度拆分多1例。

因此新 Screening 状态为 `NOT REQUESTED`，Selection 为 `NOT RUN`，Blind 为 `NOT CREATED`，Production 为 `NOT DEPLOYED`。

## 下一步

下一步不再是申请 Screening，而是只读归因盲评中候选的规划错误与过度拆分，提炼通用 Planner 原因并做最小隔离修复。修复后必须用全新匿名包、全新映射和全新标签再次进行零模型回放盲评；只有新 Gate 通过，才创建全新 Screening protocol、run label 和 labels。

不得选择性补跑旧标签，不得直接进入 Selection、Blind 或 Production。

## 验证结果

- `npm run lint`：PASS
- `npm run test`：PASS；Vitest 50 个文件、213 个测试，Node R8 通用回归 8/8，其他 Node/Server/Worker/Functions 测试全部通过
- `npm run build`：PASS
- JSON 解析与 `git diff --check`：PASS
- 新增生产识别/生成模型调用：0；匿名审阅由同族 LLM-as-judge 完成
- Production 接入：无

## Path-masked 盲评完整性

- 16组 X/Y 均按 observation 独立随机化。
- 匿名包不含模型、路径、Prompt、Pipeline、延迟、Token、结果哈希或映射字段。
- 前三轮机器/独立审计发现的路径关联缺陷均作废并使用全新 run、packet、mapping 与 labels 重跑。
- 修复后的扫描同时拒绝身份字段、内部 ID、固定 quality/confidence、选择状态和路径签名值。
- 独立审阅者只能读取匿名包；标签冻结后才在原运行进程中揭盲。
- Path-masked 生成链未读取 Expected，新增生产识别/生成模型调用0；独立审阅者为同族 LLM-as-judge。
