# 当前交接：D15 已完成冻结比较与隔离确认闭环

更新：2026-09-28。工作区 `C:/Users/Winner/.codex/worktrees/student-affairs-candidate11/比赛`，分支 `codex/e2-candidate11-blind-eval`。现行事实入口为 [D15 结果](candidate16/d15-integrated/D15_RESULTS.md)、[逐单元评分](candidate16/d15-integrated/SCORING_RESULTS.json)、[浏览器证据](candidate16/d15-integrated/BROWSER_EVIDENCE.md) 和 [验证](candidate16/d15-integrated/VALIDATION.md)；阶段规则见 [PROGRESS_POLICY](../governance/PROGRESS_POLICY.md)。

- 用户明确授权的 D13 冻结 Candidate03/Candidate16 24 次 `deepseek-flash` 请求已按顺序各发送一次，24/24 SETTLED、0 不确定、0 重试。D13 原 Manifest、Expected、请求身份、v7 评分器和旧 D11 结果未变。首个真实发送前，新 D15 产品/安全代码提交 `98c685a` 已推送。没有独立 Holdout、真人试用或默认候选替换。
- 在已见合成、单作者/模型辅助 Development 中，首次整份正确 Candidate03 为 2/12（16.7%）、Candidate16 为 3/12（25%）。整份两胜、一负、八平、一不可比。Candidate16 的 S10 修订引用无效（11/12 引用有效），S02 材料/时间严重退步，仍有 7 个 Severe；按 D13 原规则决定 `NEEDS_TARGETED_FIXES`，不能晋级或部署。标题/描述与教学例泄漏未人工裁决。Candidate15 的 D11 历史拒绝不变。
- D15 6649—6651 新隔离浏览器入口完成手动与辅助共享的正式链补验：一项任务和两个独立事件、精确/模糊开始/结束时间、来源依据、保存失败后手动重试、独立库读回及刷新；p4 Task1/Project0/Event2/TimePoint4，p3 Task0/Project0/Event2/TimePoint4。跨身份不串库；旧版本任务确认触发安全重载提示，未静默覆盖。
- 工程 low-edit-v2 有实际 editId→commitId→readback 链；p4 跨刷新计时不闭合，主动修改时间缺失。四项真人指标全 `NOT_OBSERVABLE`，真实参与者与负责人均 0；已见 Development 的 2/12 和 3/12 不是用户转化率。
- 权威账本 889 行、SHA-256 `01d6670af09175475fcdfa5aec3594d2751cfd3b03050743fb79a04a578ad4c9`，本批 49 行合法追加、完整链通过；84 历史保护和 119 冻结文件保持。最坏预算 US$7.785696 < 授权 US$7.80；真实 usage 输入 106266/输出25919 token，峰时未命中保守结算 US$0.062990，供应商实扣 `NOT_OBSERVABLE`。
- D15 定向 33/33、执行器/隔离 13/13、lint/build/security scan 与评分只读复算通过。全量 Vitest 1507过/3失败/1跳过，`npm audit` 仍 3 high/2 moderate；这些不写成 PASS，不改旧锁和冻结历史。

下一步另起 Candidate17 或经编号核验的新候选，定向修 S10 引用闭合、S02 材料/时间及 S11 旧端点 currentness，配匿名反例后重新冻结；同时完善同来源先事件后任务的版本冲突恢复引导。真正评价泛化须候选冻结后的未见材料与独立 A/B 人工参照；真人四指标须真实负责人、参与者和另行授权的试次。默认替换、合并、部署均另需证据与授权。不要用 D15 已见集反向改 Expected 或报告为独立质量。
