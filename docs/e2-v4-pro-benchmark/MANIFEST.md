# E2.9 Output Manifest

| Artifact | Version | Purpose | Status |
| --- | --- | --- | --- |
| `2026-08-13_EXPERIMENT_PLAN.md` | 2026-08-13 | 冻结 claim、run order、预算与早停 | FROZEN |
| `EXPERIMENT_PLAN.md` | current | 固定入口，指向时间戳计划 | CURRENT |
| `EXPERIMENT_TRACKER.md` | 1.0.0 | 执行状态与 Gate | ACTIVE |
| `e2-9-baseline-manifest.json` | 1.0.0 | S0 版本、参数、数据与代码哈希 | FROZEN_AVAILABILITY_PASS |
| `S0_BASELINE_FREEZE.md` | 1.0.0 | 基线核对、模型可用性与 Secret 轮换记录 | COMPLETE |
| `S1_PREVIEW_ENDPOINT.md` | 1.0.0 | Preview-only 安全边界与验证 | COMPLETE |
| `s2-smoke-manifest.json` | 1.0.0 | 3 条 source-only 冒烟选择与顺序 | FROZEN_BEFORE_GENERATION |
| `s2-smoke-aggregate.json` | 1.0.0 | 匿名冒烟状态、身份、延迟与 Token | COMPLETE_EARLY_STOP |
| `S2_SMOKE_RESULTS.md` | 1.0.0 | 冒烟审计与早停理由 | COMPLETE |
| `s3-screening-coverage-audit.json` | 1.0.0 | 冻结 24 条结构标签覆盖审计 | BLOCKED_PRE_CALL |
| `S3_SCREENING_PRECONDITION.md` | 1.0.0 | S3 合规选样不可满足说明 | COMPLETE |
| `2026-08-13_FINAL_REPORT.md` | 2026-08-13 | 45 项要求的早停最终报告 | COMPLETE |
| `FINAL_REPORT.md` | current | 最终报告固定入口 | CURRENT |
| `EXPERIMENT_AUDIT.md` | 1.0.0 | 独立只读完整性审计 | WARN_PROVISIONAL |
| `experiment-audit.json` | 1.0.0 | 可机读审计结论与重算值 | COMPLETE |
