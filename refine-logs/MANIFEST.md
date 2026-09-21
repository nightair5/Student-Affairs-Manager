# 规划产物索引

阶段：C13-D4零调用候选冻结；日期：2026-09-21。作者：本任务；性质：Candidate13 Prompt实现、已见错误族工程回归、绑定冻结与全新数据隔离。
A1—A5、B1、B2、Candidate12冻结、D1身份准备、D2执行、D3契约修复和D4 Candidate13冻结已完成。D4新增模型调用、Secret读取、账本写入和全新Expected均为0；没有真人标签、正式Holdout、合并或部署。

| 产物 | 版本 | 作用 |
|---|---|---|
| [时间戳计划](2026-09-21_1100_EXPERIMENT_PLAN.md) | c11-plan-0.1-draft | 本轮计划快照 |
| [C1时间戳计划](2026-09-21_1840_EXPERIMENT_PLAN.md) | c12-plan-0.5-c1-human-gate | Candidate12冻结与人工门的本轮计划快照 |
| [D1时间戳计划](2026-09-21_2051_EXPERIMENT_PLAN.md) | c12-plan-0.7-d1-provisional-paired | 临时Development 24个零调用配对身份的计划快照 |
| [D2时间戳计划](2026-09-21_2142_EXPERIMENT_PLAN.md) | c12-plan-0.8-d2-provisional-results | 24次结算、正式失败关闭和D3零调用停止点 |
| [D3时间戳计划](2026-09-21_2316_EXPERIMENT_PLAN.md) | c12-plan-0.9-d3-scorer-contract | 未来评分契约修复、Candidate13计划与全新数据停止点 |
| [D4时间戳计划](2026-09-21_2343_EXPERIMENT_PLAN.md) | c13-plan-1.0-d4-frozen | Candidate13冻结、全新数据隔离与后续顺序 |
| [当前计划](EXPERIMENT_PLAN.md) | c13-plan-1.0-d4-frozen | D4后的权威当前计划；时间戳文件保留快照 |
| [时间戳跟踪表](2026-09-21_1100_EXPERIMENT_TRACKER.md) | c11-tracker-0.1 | 本轮任务状态快照 |
| [当前跟踪表](EXPERIMENT_TRACKER.md) | c13-tracker-1.0-d4-frozen | D4真实状态；时间戳文件保留原快照 |
| [分支基线](../docs/recognition-optimization/candidate11/BRANCH_BASELINE.json) | candidate11-branch-baseline-1 | 父提交、84个保护文件、账本hash和换行处理 |
| [分支审计](../docs/recognition-optimization/candidate11/BRANCH_SETUP_AUDIT.md) | C11-P0 | 本轮检查、差异与范围 |
| [A—B2审计](../docs/recognition-optimization/candidate11/ENGINEERING_AUDIT.md) | C11-A—B2 | A1—A5、B1准备及B2执行边界 |
| [B1准备包](../docs/recognition-optimization/candidate11/b1-preparation/README.md) | candidate11-b1 | 六份参照、24身份、消融、计价、预算和验证入口 |
| [B2结果包](../docs/recognition-optimization/candidate11/b2-development-20260921a/README.md) | candidate11-b2 | 24次结算、raw、账本绑定、评分、错误分类和拒绝决定 |
| [Candidate12冻结](../docs/recognition-optimization/candidate12/c1-freeze/DEVELOPMENT_FREEZE.md) | candidate12-freeze-1 | 先于Holdout Expected冻结的四类Development修正 |
| [C1人工准备包](../docs/recognition-optimization/candidate12/c1-holdout-preparation/README.md) | candidate12-c1 | 双审协议、12空槽、重合检查、预注册与预算草案 |
| [Codex临时Development包](../docs/recognition-optimization/candidate12/c2-provisional-development/README.md) | candidate12-provisional-development-1 | 12份合成来源与provisional参照；只用于结构检查并加入排除库 |
| [D1临时配对准备包](../docs/recognition-optimization/candidate12/d1-provisional-paired-preparation/README.md) | candidate12-d1-preparation-1 | 24个零调用配对身份、Expected隔离、预算草案与拒绝型runner |
| [D2临时配对结果包](../docs/recognition-optimization/candidate12/d2-provisional-development-20260921a/README.md) | candidate12-d2-results-1 | 24次结算、评分接口事件、失败关闭与透明事后诊断 |
| [D3评分契约包](../docs/recognition-optimization/candidate12/d3-scorer-contract/README.md) | candidate12-d3-scorer-contract-1 | v3参照/评分接口、48夹具、历史兼容报告、Candidate13计划与验证 |
| [D4 Candidate13冻结包](../docs/recognition-optimization/candidate13/d4-freeze/README.md) | candidate13-d4-freeze-1 | Candidate13、28类已见工程夹具、绑定Manifest、新数据隔离与验证 |
| [短交接](../docs/recognition-optimization/CURRENT_CONTEXT.md) | C13-D4 | 下一轮恢复入口；候选已冻结，只能准备全新Development或等待真实独立人工Holdout标签 |
