# Experiment Audit Response

- overall_verdict: `FAIL`
- reason_code: `INVALID_RUN_SCHEMA_CONTRACT_FAILURE_WITH_SCORER_AND_AUTHORITY_STATE_DEFECTS`
- acceptance_status: `provisional`
- review_independence: `same-family`

## A–F

- A Ground truth provenance: `PASS`。12 个匿名合成 Development 标签在调用前冻结，Expected 未进入请求；不是 real GT。
- B Score normalization: `FAIL`。没有 self-normalization，但 requiresAction 实际按 active task 推导；无效臂由空任务得到 25% 假象；missedSafeDefaults 不进入 Complete、decision 或 report。
- C Result consistency: `FAIL`。36 条 HTTP 200/JSON、模型记录、哈希、token 与 0.2305468 CNY 算术均复算一致；但 tracker/context 审查时仍为 0/36，自动报告遗漏 Missed Safe Default。
- D Reachability: `WARN`。计分与决策代码实际调用；verifier 在对应 graph 响应后发送，但未等 graph Schema 合格，其 0/12 是 composite pipeline 指标。
- E Scope/claims: `PASS`。文档正确限定为 12 个合成 Development 案例，没有真实材料、真人时间、浏览器、商业或上线证据。
- F Classification: `PASS`。`simulation_only / manually labeled anonymous synthetic Development proxy`。

## Decision

`INVALID_RUN` 正确：预注册要求三臂均 12/12 Schema 合格，实际为 facts `10/12`、graph `0/12`、verifier composite `0/12`。

Graph 主要因系统性非法枚举与载荷位置失败；verifier 自身也复制非法枚举，部分案例额外输出禁用字段。评估器没有把本应有效的 graph 错杀，但无法分层表达 verifier 失败，并存在 requiresAction、空结果信用、Safe Default 和附属字段计分缺陷。

必须保持 `NO_PROMOTION / DO_NOT_LAUNCH`；不支持质量收益、真实泛化或商业候选声明。

完整审查报告：`docs/recognition-optimization/rco-5-005-b0-runs/rco-5-005-b0-20260903a/EXPERIMENT_AUDIT.md`。
