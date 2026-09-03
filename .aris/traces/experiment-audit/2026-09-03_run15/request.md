# Experiment Audit Request

- reviewer: `/root/rco5_005_b0_integrity_audit`
- model: `gpt-5.6-sol`
- reasoning: `ultra`
- mode: fresh same-family / read-only / provisional

只读审查 RCO-5-005-B0 的 runner、冻结 Development 数据与 Expected、freeze、plan、checkpoint、result、自动报告、日志和短上下文。

检查 A–F：Ground Truth 来源、Score normalization、结果存在与一致性、dead code/reachability、scope/claim、evaluation type；独立复算逐例聚合、token、费用、调用数量、Repair/retry；诊断 graph 与 verifier 0/12 Schema 根因，并判断预注册 `INVALID_RUN` 是否正确。

禁止编辑文件、调用业务模型、访问 Secret、部署或修改受保护产物。
