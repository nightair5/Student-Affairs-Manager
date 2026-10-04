# 原12次比较完成，已有事实的首次展示修复已交付

2026-10-04。C19-C17-C19-DEVELOPMENT-R1，6匿名Development来源、C17/C19两臂、3AB/3BA。**12发送、12 SETTLED、0未发送、0不确定；本次仅续ordinal3–12，前2未重发，沿用唯一原grant。** 原冻结整份结构化通过率：C17 **2/6=33.3%**，C19 **1/6=16.7%**；原选择器MIXED_PROGRESS，净变化−1，不能采用C19为更好候选。

数字是**provisional开发参照下，冻结解析/编译/评分链的整份通过率**；包含输出契约拒绝及表示差异，不是独立人工裁决的所有文字正确率，更不是总体用户正确率。标题、自由描述、教学例泄漏NOT_ADJUDICATED，真人四指标NOT_OBSERVABLE。后验程序修复另列，原成绩不回写。

## 完整比较和具体问题

[原冻结完整报告](paid-evidence/completed/FROZEN_COMPARISON_REPORT.json)：原回答契约、人工修改前首次展示两层均为C17 2正确/4错/0未知，C19 1正确/5错/0未知，每臂固定分母6。0胜、5平、1负；风险集合新增S01/S03/S04/S05不能全称真实事实退步，须追到原答和转换层。

| 来源 | 原冻结C17 / C19 | 原答、发生层和产品影响 |
|---|---|---|
| S01 停止查询、无需登记或邮件 | 错 / 错 | C17确实漏事件/周日晚间时间；C19已有事件/未知时间，negative动作却在冻结桥生成两张受阻待办。1.0.1直接禁止转换后首屏0任务1事件。缺事件仍不补猜。 |
| S02 两事件、精确起止、恢复未公布 | 错 / 错 | C19已有两事件四时间，11:40结束继承同事件日期正确，未知恢复null；v11部分截取/表示差异判为时间风险。C17另有网络开始类型和未公布结束遗漏。争议不直接改满分。 |
| S03 填写→递交，领取资格未知 | 正确 / 契约拒绝 | C19三个动作及依赖/unknown资格已有，重复支持引用触发SOURCE_CONTRACT_INFORMATION_ENTITY，整份首屏无法生成。新转换恢复事实，前两项可保存，领取仍待核对。 |
| S04 未获准不能申请、保存编号 | 错 / 错 | 两臂都留下不应直接执行的申请项；C19negative/false仍受阻，无关保存编号可用。条件性禁止不能套直接禁止删除规则，本包未称已修。 |
| S05 上传统计表、PDF/命名/办结、说明会 | 错 / 契约拒绝 | C19材料、办结标准、起止时间主事实已有，附属信息引用导致整份拒绝。新转换恢复建议及保存。v11另有原文边界/命名表示争议，原成绩保持。 |
| S06 核对编号，无截止/附件/活动 | 正确 / 正确 | 普通控制两臂均通过，不补时间或事件。 |

v11输出逐事实riskUnits和引用/传输拒绝。[旧子评分风险读数](paid-evidence/completed/FROZEN_RISK_SUMMARY.json)：C17有6/6、C19有4/6可评legacy.severity，观测Severe/Forbidden均0；C19另2份契约拒绝未评，不能补0。这些旧计数不覆盖全部新增riskUnits，也不等于独立人工判定全批无严重风险。自由描述及未裁决不填0，拒绝同样占分母。[全部12原答/冻结分数/新转换并列](paid-evidence/completed/PRODUCT_DIAGNOSTIC.json)保留原文、responseSHA及争议。

## 实际修复和边界

复用source-grounded-nonaction-projection-1.0.1，直接禁止/无需动作不增加待办；提醒、前置限制、问句、双重否定及关联端点保留核对。

新source-support-accounting-projection-1.0.0只转换已由真实主事实承担的支持性材料格式、命名、完成标准和资格说明；要求真实owner、同来源/片段和原文值。资格仍unknown，前置未完成不改completed。假ID、错类型、跨来源/片段、缺主事实、错办结标准、图冲突继续拒绝，不为模型补遗漏。

真实Schema→公共转换→普通App/ReviewSession→DomainCommitPlan→Repository已运行。S03/S05两份原拒绝录制现在不补录即可首次显示已有事实；两臂各6/6可解码**不是6/6正确率**。原raw/wire、冻结semantic/首屏、新转换审计、用户纠正分别保存。没有Prompt/候选/默认替换、评分放宽或新付费样本。[代码与反例](IMPLEMENTATION.md)。

## 浏览器、保存和四指标

唯一内部入口 **http://127.0.0.1:6820/**；构建6abc47a8d192 / source 194d64cb84ec；新库rco-mainline-01-02-i1-d27-plan-recorded-c19complete1004；12份固定实际录制、ENGINEERING_REPLAY、实时派发关闭。旧6817/6809和旧用户库未操作。

[BROWSER_EVIDENCE](BROWSER_EVIDENCE.md)、[独立值检查](paid-evidence/completed/browser/CHECK.json)：S05首屏1任务1事件1材料3时间，正式失败0事实，手动重试及刷新正确。S03保存2项todo及依赖，领取未确认；S01未知事件时间null/vague，提交后读回失败只重新读取，没有重提；S02两事件四时间，模糊开始和恢复未公布null。累计Task3/Project0/Event4/TimePoint8/Material1；D27个人安排不覆盖原文截止。

页面4来源均有commit/readback，无字段修改因此editId为空、不造纠正链。闭合只读2份：阅读35.787s/67.887s，主动编辑0；部分未结束及刷新断点2份时间null保留。旧outcomes.partial=false不能代替canonical的partially_confirmed，明确分列。最终正确、低修改正确未经裁决不算成功；ENGINEERING_REPLAY墙钟含工具等待，不称真人省时。[测量原记录](paid-evidence/completed/browser/MEASUREMENT.json)。四真人指标仍NOT_OBSERVABLE。

## 恢复、费用和保护

恢复代码5d395c3a7dbd6e0d2257ce275f415941b592768f先测试提交立即推送。先核owner终止、ordinal3无reserve/presend/raw/receipt/settle和孤立写入，保全原现场；独立guard内比锁身份后原子改名保留旧锁。补充绑定当前同步HEAD、原authSHA/snapshot/身份/grant/cap和新核价；缺日志/残留guard/状态更新/未决发送封存，一次独立复核后补实际故障测试。

[COMPLETION_PROOF](paid-evidence/completed/COMPLETION_PROOF.json)：原AUTH和raw01/02字节未变，audit CONSISTENT、无活动锁/HALT；1grant12reserve12settle，总25行，本次仅20合法追加。账本996行SHA c58231633b8da1b87e9106f92d0dd457f00e4789e5e5fa03de780fb377dc8750，完整链/原前缀有效，后续工程只读。真实授权原件只在.data不入Git。

预算上界US$3.892848≤3.90；真实input54270/output14511/total68781/cached43520/reasoning0。内部保守结算US$0.033699，供应商实扣NOT_OBSERVABLE。前2不重发，续10均HTTP200，零额外样本/自动重试/repair/verifier；全部身份耗尽，余款不是新许可。[费用](BUDGET_AND_AUTHORIZATION.md)。

84保护/119冻结/7归档、原D26 145组件/7产物/16请求及raw、D17/D26旧分数保持，原Manifest/身份SHA不变。[验证](VALIDATION.md)：产品965PASS/1SKIP，全量39组33PASS/6历史FAIL，lint/build/scan通过；audit5high/2moderate开发工具风险仍在，production-only0。代码两边界已立即推送，文档证据再推并现场核HEAD。

## 下一步

用这12份原答优先分开等价表示与真实事实错误（S02/S05），再处理S04条件性禁止的首次展示，原冻结成绩不改。不先付费排查程序/评分争议，不默认Candidate20或新12/24身份。只有生成机制确须改变且旧raw无法验证时，才提最小两臂假设和新费用授权。

停止状态：C19_FROZEN_COMPARISON_COMPLETE_PRODUCT_COMPATIBILITY_DELIVERED。原2/12 EXECUTION_REPORT/BATCH_STATUS和ZERO_CALL_REPORT仅历史快照，原文件不改；当前以completed证据为准。C19未证实净收益，新程序兼容不称新模型准确率提高。没有真人/Holdout/默认采用/合并/部署。
