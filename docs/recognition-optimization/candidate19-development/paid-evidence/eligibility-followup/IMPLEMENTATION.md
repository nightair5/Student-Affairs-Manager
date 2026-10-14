# 一个根因：已声明且可证明的资格被普通转换误阻断

用户场景：社团已经获准，可直接递交申请；页面却要求再查资格。该错误发生在公共转换，并非本轮证实的模型漏项。

| 链路 | 实际表达与变化 |
|---|---|
| 原文最小事实 | 申请仅限获准/获得许可的社团；你的社团已获准/已经获得许可；还有PDF材料、截止和两个独立事件。 |
| 原wire | 当前明示任务，condition=true，规则/获准事实各引用真实scope；材料、时间有真实owner，工程输出原字节前后相同。 |
| 旧adapter | 非not_applicable资格一律生成condition representation gap，连true也阻断。 |
| 新adapter | source-proven-eligibility-1.0.0检查规则对象、许可谓词、本人事实、当前required义务及全来源相同主体的否定/撤销；仅原答已有true且证明完整才解除此gap。 |
| 首次普通页面 | 合法两例显示1任务+2事件，一次接受通知可用；unknown及矛盾例任务待核对，无关事件可部分保存。 |
| 正式保存/安排 | 同一DomainCommitPlan原子写入，条件原值和审计在sidecar；Repository独立读回，D27个人安排不改原截止，前置待办保留等待。 |

实际路径：[资格检查](../../../../../src/recognition/eligibilityGrounding.ts)→[普通转换](../../../../../src/recognition/firstSuggestionD26.ts)（semantic-ordinary-bridge-1.1.0）→现有普通App确认。返回PROGRAM_SOURCE_CHECK_NOT_NEW_MODEL_OUTPUT、inferredFacts=0；不将unknown/false提升true，不静默补模型缺事实。不改变wire Schema、Prompt、Candidate19或Workspace v8。

[14项链路反例](../../../../../src/recognition/eligibilityGrounding.test.ts)走真实Schema/公共转换/普通首次捕获/sidecar槽位/DomainCommitPlan/独立Repository；覆盖语序变化、幂等、缺证明、错对象、其他社团、撤销、未引用否定、未知/false、已取消及资格成立但前置unknown。条件值前后保留；缺证明仍Schema CONDITION_PROOF_REQUIRED，unsupported语法仍待核对。

4混合通知来自[匿名夹具](../../../../../src/experiments/candidate19Recorded/eligibilityFixtures.ts)，各含不同申请名/许可措辞、材料、精确截止、模糊/未公布事件及精确事件。反例角色与原12模型录制分明；原response/转换审计/首次capture/用户history分别持久化。复用[录制入口](../../../../../scripts/serve-candidate19-recorded.mjs)和[普通App宿主](../../../../../src/experiments/candidate19Recorded/browser.tsx)，GET只读录制服务无模型派发端点，不创建平行保存链。

边界：精确匹配有限的同对象社团许可表达，不声称理解全部资格。提示词或原raw未提供的资格不补猜；独立事件/模糊时间、依赖、修订、渠道grounding1.2.0与覆盖保护保持。旧12首次事实SHA/后验诊断逐份不变，S05渠道争议不满分；没有新生成假设或付费比较需要。
