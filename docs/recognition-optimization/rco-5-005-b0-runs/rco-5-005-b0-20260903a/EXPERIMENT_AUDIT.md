# RCO-5-005-B0 Experiment Audit

**Date**: 2026-09-03

**Auditor**: GPT-5.6-Sol ultra, fresh same-family agent, read-only, provisional

**Overall Verdict**: `FAIL`

**Reason Code**: `INVALID_RUN_SCHEMA_CONTRACT_FAILURE_WITH_SCORER_AND_AUTHORITY_STATE_DEFECTS`

## Executive finding

`INVALID_RUN` 是正确且已预注册的决定。计划要求三臂均达到 12/12 Schema 合格；实际为 facts-first `10/12`、proposition graph `0/12`、semantic verifier pipeline `0/12`。

36 个请求均得到 HTTP 200 和可解析 JSON，但“接口返回”不等于“结果符合契约”。本轮不能比较三臂质量，必须保持 `NO_PROMOTION / DO_NOT_LAUNCH`。

## A. Ground Truth Provenance: PASS

- 数据明确为 12 个匿名、人工标注的合成 Development 案例，不是 Holdout 或 real GT。
- dataset/runner/prompt 哈希在首次调用前冻结并提交；冻结提交时间早于 checkpoint 首次调用。
- 请求构造不读取 `fixture.expected`；Expected 未进入模型请求，也未从本轮模型输出生成。
- 局限：Expected 没有独立标注者或双人裁决来源，只能称 `manually labeled anonymous synthetic Development proxy`。

## B. Score Normalization: FAIL

未发现除以模型自身最大值/均值的 self-normalization，逐例聚合数值也可复算；但存在以下计分缺陷：

- `requiresActionAccuracy` 没有评分模型顶层 `requiresAction`，而是由 `activeTasks.length > 0` 推导。case 10 的模型顶层值错误为 false，结果却记录 `requiresActionCorrect=true`。
- Schema 无效任务被置为空，3 个负例机械获得正确，使 graph/verifier 显示 25% requiresAction；该值不可解释。
- `missedSafeDefaults` 虽被计算为 `3 / 9 / 9`，却不进入 Complete Case、decision 或自动报告。
- time/material/event/location 只在 Expected task 循环中计分，未匹配 FP 上的幻觉附属字段可能不受罚。
- Evidence 已先被 Schema 限制为原文子串，Evidence validity 因而接近结构性 100%/N/A，不能单独证明语义依据充分。

独立复算与原文件一致：facts TP/FP/FN=`10/0/2`，P/R/F1=`1/.833333/.909091`；后两臂为 `0/0/12`，Precision/F1 为 null。它们是原执行器的可复算输出，不是有效三臂正确率比较。

## C. Result Existence and Consistency: FAIL

通过项：

- checkpoint 有 36 个唯一 `case × role` 条目，每臂 12 个，全部 HTTP 200、completed、可解析 JSON；返回模型名一致。
- 没有 Repair 或重复条目；模型原始输出中没有 `selected`。
- Token 精确复算为 `25,535 + 8,954 = 34,489`。
- 保守费用精确复算为 `0.2305468 CNY`；Provider 账单仍为 `NOT_OBSERVABLE`。
- result 记录的 checkpoint SHA 与实际文件一致；dataset 和 runner SHA 与 freeze 一致。

失败项：

- 审查开始时 CURRENT_CONTEXT 和 OPTIMIZATION_LOG 仍停在 0/36，和完成结果冲突；必须在本次封存时订正。
- 自动报告漏掉预注册要求的 Missed Safe Default。
- checkpoint/result 没有绑定 freeze/plan/request hash/provider request ID；temperature 只能证明客户端请求值，API 响应没有回证。
- `attemptedCalls` 一般情况下等于 checkpoint entries 数量而不是已发请求数；本轮 36 条均有 HTTP 200，所以未实际造成数量错报。

## D. Dead Code and Reachability: WARN

- validator、scorer、aggregate、decision 和 report 路径都实际执行。
- 每例 verifier 确实在相应 graph HTTP 响应之后调用。
- 但 graph Schema 校验在全部调用完成后才执行；因此 12 次 verifier 都审查了结构不合格 graph。
- result 的 verifier `schemaValid` 是 `graphValid && verifier completed && validateVerifier` 的复合值，不能单独表示 verifier 自身 Schema。
- 独立离线检查发现 verifier 自身也 12/12 不合格：它复制了候选的非法枚举，部分案例还多输出禁止字段。

## E. Scope and Claims: PASS

- Plan、result 和报告都明确限定在 12 个合成 Development 案例。
- 没有把结果宣称为真实材料、真人修改时间、浏览器验收、商业质量或上线证据。
- “独立语义复核”只表示同一个模型的第二次独立调用，不是独立模型或独立供应商。

## F. Evaluation Type: PASS

`simulation_only / manually labeled anonymous synthetic Development proxy`

不是 `real_gt`，不是 human evaluation，也不是由模型输出生成 Expected 的自我评分。

## Root Cause of 0/12 Graph Schema

- graph prompt 没有在本次独立调用中完整列出语义枚举，却引用不可见的 facts-first 契约；模型普遍输出 `学院/用户`、`positive`、`active`、`valid`、`obligation` 等不合法值。
- 模型把 time/material/location 直接放入 directive/event 节点，违反冻结契约要求的独立节点与关系。
- verifier prompt 要求部分语义“与候选一致”，于是复制了候选的非法枚举。
- facts-first 的两例 Schema 失败是漏掉必填顶层 `ignored`。

这些主要是模型对冻结输出契约的系统性违例；同时，prompt 的跨调用隐含引用、缺少严格结构化输出，以及执行器缺少 graph-valid 前置门，使实验设计放大并延续了失败。没有证据表明 graph validator 本身恒假。

## Action Items

1. 原 run 按 `INVALID_RUN` 封存，不使用同一 run-id 重试，不事后修改 Expected、freeze、dataset、checkpoint 或 result。
2. 修正 scorer 与报告口径，再用 0 调用测试证明 requiresAction、Safe Default、无效臂和 verifier-own/pipeline Schema 分层正确。
3. 每次独立 prompt 完整携带 canonical 枚举；优先使用严格 JSON Schema，不依赖“同上”。
4. graph Schema 不合格时不得调用 verifier；checkpoint 恢复、实际请求数和证据哈希需加固。
5. 若要再次付费运行，必须新冻结版本、新 run-id 和新授权；本轮不支持 RCO-6 或上线。

## Claim Impact

- **Supported**: 36 个 HTTP/JSON 返回；facts Schema 10/12；graph pipeline Schema 0/12；触发预注册 INVALID_RUN；usage 与保守费用算术。
- **Needs qualification**: verifier 0/12 是 composite pipeline 值；independent 只指同模型第二次调用。
- **Unsupported**: graph/verifier 相对 facts 的质量或安全收益、真实泛化、真人效率、浏览器验收、商业候选、发布或上线。

Trace: `.aris/traces/experiment-audit/2026-09-03_run15/`
