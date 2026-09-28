# 当前交接：D17 冻结 Development 比较完成，结论为混合进展

更新：2026-09-28。现行入口为 [D17 结果](candidate17/d17-development/D17_RESULTS.md)、[逐单元评分](candidate17/d17-development/SCORING_RESULTS.json)、[追加式选择器诊断](candidate17/d17-development/POSTHOC_DECISION_AUDIT.md)与[预算结算](candidate17/d17-development/BUDGET_SETTLEMENT.md)。用户授权的 Candidate03/Candidate17 24 次冻结请求全部各发送一次并结算，0 重试、0 不确定；Candidate03 整份正确 1/12，Candidate17 2/12，但 Candidate17 仍有 9 个 Severe、S08 新材料错误及 S10/S11 修订关系失败。预注册分层结论 `MIXED_PROGRESS`，不得替换默认候选或部署。账本 938 行、SHA `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`，原 D16 冻结字节、84 份历史保护和 119 份冻结文件保持；本批 grant 已耗尽。四项真人指标仍 `NOT_OBSERVABLE`。以下是派发前及更早历史快照。

# D17 派发前历史快照

更新：2026-09-28。现行入口为 [D17 前置记录](candidate17/d17-development/PREFLIGHT.md)。Candidate03/Candidate17 的 D16 冻结 24 身份保持 `NOT_RUN`；D17 专用执行器、账本只读核验、离线故障注入和预注册选择器已就绪，无授权派发被阻断，0 新模型请求、0 grant/reserve/settle。官方价格本次只读核验，逐单元取整保守上界 US$7.785696；US$8.00 仅是建议硬上限，尚未获得用户对本批模型、24 次和美元上限的明确授权。四项真人指标仍为 `NOT_OBSERVABLE`。以下 D16 内容保留为历史快照。

# D16 历史交接：本地修复与零调用新比较已准备

更新：2026-09-28。当时入口为 [D16 结果](candidate17/D16_RESULTS.md)、[新 Manifest](candidate17/d16-development/MANIFEST.json)、[浏览器证据](candidate17/BROWSER_EVIDENCE.md) 和 [预算草案](candidate17/FUTURE_BUDGET_CARD.md)。Candidate17 为独立 Prompt 版本，针对 D15 S02/S10/S11 的真实错误增加材料/时间归属、取消替代端点闭合和状态约束；没有新模型输出，效果仍未知。D15 C03 2/12、C16 3/12 及 `NEEDS_TARGETED_FIXES` 是历史 Development 决定，不更改。

D16 在 6652/p5 隔离浏览器完成任务与两个独立事件、旧版本重载、确认、读回和刷新；p5 Task1/Project0/Event2/TimePoint4。p6 6653 新身份开始为空库，随后另做未保存动作字段的冲突恢复和失败后手动重试，读回 1/0/1/0；正式事实未串库。12 份新写但旧模板衍生的 provisional Development 参照完成正负往返；Candidate03/Candidate17 的 24 个身份 6 AB/6 BA，全 `NOT_RUN`、`dispatchAuthorized=false`。无 grant/账本写入、无真人、无默认替换。四项真人指标均 `NOT_OBSERVABLE`。旧账本只读核验为 889 行、SHA `01d6670af09175475fcdfa5aec3594d2751cfd3b03050743fb79a04a578ad4c9`；调用前重核官方价格与账本。

下面的 D15 内容保留为历史交接快照，不作为 Candidate17 效果或本批授权。

# D15 历史交接：已完成冻结比较与隔离确认闭环

更新：2026-09-28。工作区 `C:/Users/Winner/.codex/worktrees/student-affairs-candidate11/比赛`，分支 `codex/e2-candidate11-blind-eval`。现行事实入口为 [D15 结果](candidate16/d15-integrated/D15_RESULTS.md)、[逐单元评分](candidate16/d15-integrated/SCORING_RESULTS.json)、[浏览器证据](candidate16/d15-integrated/BROWSER_EVIDENCE.md) 和 [验证](candidate16/d15-integrated/VALIDATION.md)；阶段规则见 [PROGRESS_POLICY](../governance/PROGRESS_POLICY.md)。

- 用户明确授权的 D13 冻结 Candidate03/Candidate16 24 次 `deepseek-flash` 请求已按顺序各发送一次，24/24 SETTLED、0 不确定、0 重试。D13 原 Manifest、Expected、请求身份、v7 评分器和旧 D11 结果未变。首个真实发送前，新 D15 产品/安全代码提交 `98c685a` 已推送。没有独立 Holdout、真人试用或默认候选替换。
- 在已见合成、单作者/模型辅助 Development 中，首次整份正确 Candidate03 为 2/12（16.7%）、Candidate16 为 3/12（25%）。整份两胜、一负、八平、一不可比。Candidate16 的 S10 修订引用无效（11/12 引用有效），S02 材料/时间严重退步，仍有 7 个 Severe；按 D13 原规则决定 `NEEDS_TARGETED_FIXES`，不能晋级或部署。标题/描述与教学例泄漏未人工裁决。Candidate15 的 D11 历史拒绝不变。
- D15 6649—6651 新隔离浏览器入口完成手动与辅助共享的正式链补验：一项任务和两个独立事件、精确/模糊开始/结束时间、来源依据、保存失败后手动重试、独立库读回及刷新；p4 Task1/Project0/Event2/TimePoint4，p3 Task0/Project0/Event2/TimePoint4。跨身份不串库；旧版本任务确认触发安全重载提示，未静默覆盖。
- 工程 low-edit-v2 有实际 editId→commitId→readback 链；p4 跨刷新计时不闭合，主动修改时间缺失。四项真人指标全 `NOT_OBSERVABLE`，真实参与者与负责人均 0；已见 Development 的 2/12 和 3/12 不是用户转化率。
- 权威账本 889 行、SHA-256 `01d6670af09175475fcdfa5aec3594d2751cfd3b03050743fb79a04a578ad4c9`，本批 49 行合法追加、完整链通过；84 历史保护和 119 冻结文件保持。最坏预算 US$7.785696 < 授权 US$7.80；真实 usage 输入 106266/输出25919 token，峰时未命中保守结算 US$0.062990，供应商实扣 `NOT_OBSERVABLE`。
- D15 定向 33/33、执行器/隔离 13/13、lint/build/security scan 与评分只读复算通过。全量 Vitest 1507过/3失败/1跳过，`npm audit` 仍 3 high/2 moderate；这些不写成 PASS，不改旧锁和冻结历史。

下一步另起 Candidate17 或经编号核验的新候选，定向修 S10 引用闭合、S02 材料/时间及 S11 旧端点 currentness，配匿名反例后重新冻结；同时完善同来源先事件后任务的版本冲突恢复引导。真正评价泛化须候选冻结后的未见材料与独立 A/B 人工参照；真人四指标须真实负责人、参与者和另行授权的试次。默认替换、合并、部署均另需证据与授权。不要用 D15 已见集反向改 Expected 或报告为独立质量。
