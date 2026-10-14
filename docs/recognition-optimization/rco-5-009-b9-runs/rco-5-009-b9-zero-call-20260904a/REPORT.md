# RCO-5-009 B9 首次零调用结果

- 状态：COMPLETED
- 门：FAIL
- 决策：B9_ZERO_CALL_DIRECT_CANDIDATE_GATE_FAIL_RETAIN_RESULT_AND_USE_B10_FOR_ANY_FIX
- 批次：rco-5-009-b9-zero-call-20260904a
- 调用边界：模型 0、网络 0、verifier 0、Repair 0、retry 0、Secret NONE。
- 证据边界：单作者匿名合成 Development；响应是冻结的本机闭集夹具，只检验架构可表达性。
- 已知标签限制：B9-12 原文已说明条件发生，但冻结答案仍按“条件未知”检验当前实现边界；不得把该项满分说成语义正确率。
- B9 自本次批次尝试开始即为已见；若失败只能保留结果并转到 B10。

## 固定指标

| 指标 | 结果 |
|---|---:|
| caseIdentityExact | 1 |
| sourceFingerprintExact | 1 |
| candidatePolicyVersionExact | 1 |
| candidateIdentityExact | 1 |
| candidateDispositionExact | 1 |
| actionSpanExact | 1 |
| singletonOrEmptyObjectSpanExact | 1 |
| inputFixtureTransportExact | 1 |
| ledgerDispositionExact | 1 |
| acceptedCandidateTaskBijectionExact | 1 |
| taskSemanticExact | 1 |
| taskSelectedExact | 1 |
| requiresActionExact | 0.9166666666666666 |
| responseContractCompletenessExact | 1 |
| semanticCoverageCompletenessExact | 1 |
| expectedIssueCodesExact | 1 |
| materializerValidationExact | 1 |
| revisionUncertaintyExact | 1 |
| resolvedRevisionRelationExact | 1 |
| unresolvedActionScopeExact | 1 |
| outOfVocabularyUnresolvedActionExact | 1 |
| conditionUnknownExact | 1 |
| safeDefaultRecall | 1 |
| siblingSurvivalRate | 1 |
| unsafeDefaultSelections | 0 |
| extraDefaultSelections | 0 |

## 逐例

| 案例 | 状态 | 失败项 |
|---|---|---|
| rco-task-b9-01 | PASS | - |
| rco-task-b9-02 | PASS | - |
| rco-task-b9-03 | PASS | - |
| rco-task-b9-04 | PASS | - |
| rco-task-b9-05 | PASS | - |
| rco-task-b9-06 | PASS | - |
| rco-task-b9-07 | FAIL | requiresActionExact |
| rco-task-b9-08 | PASS | - |
| rco-task-b9-09 | PASS | - |
| rco-task-b9-10 | PASS | - |
| rco-task-b9-11 | PASS | - |
| rco-task-b9-12 | PASS | - |

## 不变量

- 正式稳定路径未改动。
- RCO-6 未启动。
- 未部署。
- 多对象能力：NOT_EXPRESSIBLE_BY_POLICY_1.2.0。
