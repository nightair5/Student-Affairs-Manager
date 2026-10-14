# 识别优化当前跟踪

2026-09-28 D17 实测：[逐单元结果](../docs/recognition-optimization/candidate17/d17-development/SCORING_RESULTS.json)与[预算结算](../docs/recognition-optimization/candidate17/d17-development/BUDGET_SETTLEMENT.md)：24/24 `SETTLED`、0 不确定/重试；C03 1/12、C17 2/12 整份正确，结论 `MIXED_PROGRESS`，四项真人指标仍 `NOT_OBSERVABLE`。原冻结身份文件仍保留 `NOT_RUN` 作为派发前快照，实际执行状态以 D17 独立状态和账本为准。以下 D17 前置段落为历史快照。

2026-09-28 D17 派发前快照：[前置与零调用状态](../docs/recognition-optimization/candidate17/d17-development/PREFLIGHT.md)：24/24 `NOT_RUN`，0 grant/reserve/settle；安全执行器离线测试和冻结评分选择规则就绪，付费比较待新批明确授权。以下 D16 为历史快照。

2026-09-28 D16 历史快照：[Candidate17 结果](../docs/recognition-optimization/candidate17/D16_RESULTS.md)：新候选 promptVersion 1.0.0；新写模板衍生 Development 12/12 provisional 完整参照、24/24 身份 `NOT_RUN`、0 新调用；隔离浏览器 p5 正式 Task1/Project0/Event2/TimePoint4，p6 初始空库、随后实测未保存字段重基线和失败重试，独立读回 1/0/1/0。独立人工和真人指标仍缺；新模型效果未知。以下 D15 跟踪是历史快照。

2026-09-28 D15 状态：[冻结比较与产品交付](../docs/recognition-optimization/candidate16/d15-integrated/D15_RESULTS.md)：24/24 已发送结算、0 不确定；C03 2/12、C16 3/12 整份正确，S10 引用失败，结论 NEEDS_TARGETED_FIXES。隔离浏览器已验任务+两事件、精确/模糊结束时间、失败后手动恢复及独立读回；真人四指标 NOT_OBSERVABLE。全量测试与依赖审计仍有分列失败。下方 D14 状态是历史快照。

2026-09-28 D14 状态：[本地一体化工程已交付](../docs/recognition-optimization/candidate16/d14-integrated/D14_RESULTS.md)；C03/C16 0/24 新调用、真人0、四指标真人 NOT_OBSERVABLE。安全执行器11/11、隔离2/2、相关产品定向9/9，浏览器与独立读回已验。手动完整字段未就绪，正式真人仍 NOT_RUN。下表 D14“待执行”和“预算未决”为本阶段开始前快照，不代表当前状态。

更新：2026-09-28。工程交付、开发观察、探索准备、独立质量和发布分开。

| 工作 | 状态 | 证据/下一步 |
|---|---|---|
| D11 24次 C03/C15 | 历史已运行、不晋级 | 原Expected/raw/v6结果和拒绝决定不改 |
| D12 治理与异常修复 | 已交付 | 原3个评分异常diagnostic保留 |
| D13 v7参照/评分 | 定向验证通过 | 12完整、0部分/未决，provisional有限契约；20项Node检查 |
| D13 Candidate16 冻结 | 已在 D15 完成 24 次配对调用 | 原 Prompt/身份未改；最小动作、条件/证据、取消替代仍有 S10 风险 |
| D13旧输出同口径诊断 | 已完成，非新版输出 | 分母24；C03 1/12、C15 2/12；C15引用10/12 |
| D13确认/计时 | 核心浏览器与12项产品测试通过 | 无任务、事件、部分确认、失败恢复、拒绝计纠正；真人指标缺失 |
| D14一体化本地工作包 | 已交付、未付费调用 | 有限契约复核、US$7.785696峰时上界/安全执行器、隔离两条件入口、浏览器/读回；手动补逐字完成标准/材料及纯信息事件/模糊时间，重复夹具阻断 |
| 新C03/C16配对 | D15 24/24 已结算，NEEDS_TARGETED_FIXES | C03 2/12、C16 3/12；C16 S10 引用失败、S02 退步；具体见 D15 结果 |
| 探索体验 | 工程入口、混合/多事件和跨身份已验，真人NOT_RUN | 真实负责人/3—5参与者/同意和范围授权仍缺；跨刷新计时缺失不填 0 |
| 全量验证 | FAIL，定向通过 | D15 Vitest 1507过/3失败/1跳过；旧 carrier、5秒超时和 D9 Node 收集；`npm audit` 3 high/2 moderate |
| 独立Holdout/默认替换/发布 | NOT_RUN_NOT_AUTHORIZED | 真实独立A/B、未见材料及另行授权 |

[D13验证](../docs/recognition-optimization/candidate16/d13-development/VALIDATION.md)；[旧跟踪存档](../docs/governance/archive/2026-09-28-d13/refine-logs/EXPERIMENT_TRACKER.md)。
