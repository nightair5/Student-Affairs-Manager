# E2.9-R8 隔离 Planner 修复与零模型回放报告

## 结论

R8 已完成通用失效图谱、实体契约冻结、受限 Normalizer、隔离 Planner、零模型回放和通用回归测试。修复没有接入 Production，也没有调用模型。

零模型回放证明隔离架构显著减少事实丢失，但冻结严格评分仍未通过。因此当前结论是：

`ARCHITECTURE REPLAY PASSED / FRESH SCREENING NOT REQUESTED`

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

严格 Gate 未通过。主要冲突是：冻结 Expected 将部分“纯信息 Event/TimePoint”和“事件本身 + 用户参加义务”的双表示判为多余，而既有 path-masked 人工口径认为这些事实不应丢失。R8 不修改 Expected，也不以契约分覆盖严格分。

## 为什么暂不申请 Screening

申请新 Screening 需要零模型回放同时满足：

1. 架构保真门槛通过；
2. 冻结严格分不出现无法解释的 Precision、Planning Error 或 Major Correction 退化；
3. 如两种口径冲突，先由未接触模型映射的独立审阅者对匿名 before/after 结果确认用户影响。

当前仅满足第 1 项。因此新 Screening 状态为 `NOT REQUESTED`，Selection 为 `NOT RUN`，Blind 为 `NOT CREATED`，Production 为 `NOT DEPLOYED`。

## 下一步

唯一合理的下一步是生成不含模型身份、Expected 和历史结论的 R8 path-masked replay packet，由独立审阅者判定新增结构究竟是必要事实还是用户不需要的过度拆分。只有该 Gate 通过，才创建全新 protocol、run label 和 labels，申请一次小规模 Screening。

不得选择性补跑旧标签，不得直接进入 Selection、Blind 或 Production。

## 验证结果

- `npm run lint`：PASS
- `npm run test`：PASS；Vitest 50 个文件、213 个测试，Node R8 通用回归 8/8，其他 Node/Server/Worker/Functions 测试全部通过
- `npm run build`：PASS
- JSON 解析与 `git diff --check`：PASS
- 模型调用：0
- Production 接入：无
