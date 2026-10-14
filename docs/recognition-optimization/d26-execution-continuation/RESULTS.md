# D26 冻结首次比较与证据修复结果

2026-10-03。**D26_AUTHORIZED_COMPARISON_COMPLETE_PRODUCT_REPLAY_DELIVERED**。原16身份已各发送一次并结算，许可用尽。没有证据证明C18提高首次整份正确率；本轮可用的程序修复另列交付。

## 首次究竟准了多少

| 观察层 | Candidate17 | Candidate18 | 边界 |
|---|---|---|---|
| 原回答，经冻结解析/adapter/v10 | 确认整份正确0/8；7错、1 UNKNOWN | 0/8；8份契约拒绝，自动开发契约率0% | 不是独立人工原答真值；未知不删分母 |
| 冻结转换后、人工前首次展示 | 确认整份正确0/8；7错、1 UNKNOWN | 0/8；8份未能生成有效首次建议 | 原冻结与上行分列，不用事后修复回填 |
| 新程序转换的录制回放 | 8份可解析，不表示整份正确 | S01/S02可进产品；6份仍拒绝 | 事后工程诊断，不能称新模型2/8正确率 |
| 真人最终处置/低修改/时间 | NOT_OBSERVABLE | NOT_OBSERVABLE | 无真实试次或裁决 |

C17不能写确定正确率0%：已确认正确占固定分母0/8，另1份未知，按暂定参照可能为0–1/8。C18的0%是**本批完整管线没通过**，不表示每个事实都错。S01/S02原答已有明确事件及模糊时间，被主实体/附属时间引用约定拒绝；S03等存在null覆盖歧义。参照single-author/model-assisted/provisional；标题、自由描述、教学例泄漏未经真实人工裁决均NOT_ADJUDICATED。

原选择器 **EVIDENCE_INCOMPLETE**：净整份变化0，7平/1未知，逐来源风险退步标记8。执行完整，语义证据仍不完整，不能判赢家。旧D17 C03 1/12、C17 2/12及MIXED_PROGRESS不改。C18包含Prompt/wire/转换整包，不能单归因Prompt。[完整结果](authorized-20261003/COMPARISON_REPORT.json)、[逐单元摘要](authorized-20261003/COMPACT_RESULTS.json)。

## 逐来源

| 来源 | C17冻结观察 | C18冻结观察 | 修复与剩余 |
|---|---|---|---|
| S01图书门户停机 | 无任务正确，但漏事件/时间 | 有事件及周三晚，accounting事件+时间引用被拒 | 新程序保留已有事实；普通页一次确认，0任务0项目1事件1未知时间 |
| S02实验预约维护 | 漏事件/时间 | 有事件及周四晚，同类契约拒绝 | 同页直接显示；提交后读回失败可只重读恢复 |
| S03先填再提交 | 两任务存在；把未知前置满足写true，无支持事实；材料视图争议 | 前置unknown/资格not_applicable方向合理；null覆盖无时间/事件仍拒 | 不猜null为not_stated；需下一版输出契约 |
| S04两步登记 | 完成标准/条件判错，材料及覆盖争议 | null覆盖缺事实而拒 | 未见整份收益，局部合理字段不是完整正确 |
| S05资格未知/暂定办理 | 数量无据、办理时间当deadline、时间两向边冲突 | accounting缺主实体而拒 | 普通页解释资格待核对并阻断；不猜接边或改成可开始 |
| S06模糊办理 | 材料、时间/覆盖判错 | accounting缺主实体而拒 | 仍需事实生成/类型机制修复 |
| S07精确截止/PDF | 动作、截止、材料可查；信息覆盖争议，整份UNKNOWN | 无事件却coverage=null，拒 | 正式保存保留PDF、命名及截止；修改/失败重试只记一项纠正 |
| S08两项普通控制 | 材料/完成标准判错，上传任务漏收妥标准 | null覆盖缺事实而拒 | 原文混用确认单/承诺函，材料对象需人工裁决；漏完成标准仍是真风险 |

C17任务存在计数TP9/FP0/FN0，不抵消事件遗漏、条件、材料、时间和完成标准错误。C18拒绝后的任务TP/FP/FN、Severe/Forbidden为NOT_SCOREABLE，不能写零风险；C17旧v7严重度与新v10事实风险/争议在完整报告分列。

## 三类已交付修复

1. **合法表示进入产品**：recorded-source-accounting-projection-1仅投影原答已有、同片段支持的主实体及附属材料/时间，原值/边不改，引用审计保留。已有压缩事件名显示其已引用原文句。无主实体、跨scope、假ID、错类型、重复引用、缺事实null仍拒，未补模型遗漏。
2. **来源与推理时钟一致**：同原文scope-ID可逆绑定新SourceVersion，实体/值不变；相对日期用原2026-09-22时钟。原回答/转换/首次展示/用户修改分存。未知资格及图缺口仍局部阻断。
3. **失败不污染下一来源**：无效录制只拒绝当前来源，不将离线provider全局置为不可用而误走本地规则。S03失败后S05仍显示Candidate17录制。复用App、ReviewSession、DomainCommitPlan、Repository、D27安排。

[代码路径](IMPLEMENTATION.md)、[根因证据与下一决策](authorized-20261003/ROOT_CAUSES.md)、[16份离线诊断](authorized-20261003/PRODUCT_REPLAY_DIAGNOSTIC.json)。没有Candidate19或新身份，默认候选未换。

## 实际页面与测量

唯一推荐内部入口 **http://127.0.0.1:6798/**，本批C17/C18实际固定录制，ENGINEERING_REPLAY，网页模型调用0。新库rco-mainline-01-02-i1-d27-plan-recorded-actual16r6。实际构建7ce9fa204a5b / source cbf17bf22cd8，源码哈希与已推送产品提交07e1b99b6b98a4cc92058499e968bd1125aaf9ea一致；构建标签不伪改成后续文档HEAD。[绑定](authorized-20261003/CODE_BINDING.json)。旧6792入口及旧库未操作。

实际验两份无任务事件、S07正式失败/关闭恢复/手动重试、S03拒绝、S05阻断、提交后读回失败/只读恢复、刷新与独立读回。最终全库Task1/Project0/Event2/TimePoint3/Material1；事件时间null/vague，截止仍10月19日16:30。[浏览器和测量](authorized-20261003/BROWSER_EVIDENCE.md)。

editId→checkpoint→commitId→readback已形成。S01阅读约14.6秒主动编辑0；S07耗时改一次及失败重试仍一项纠正，关闭重开时间不连续为MISSING/null。没有补0或把保存成功当语义正确。measurement3.2、low-edit-v2、D27安排计量保留，四项真人指标NOT_OBSERVABLE。

## 调用、验证与同步

实发16/确定结算16/不确定0；1grant/16reserve/16settle，零重试/repair/verifier。官方峰时保守上界US$5.190464≤许可5.30；usage输入70,678/输出18,375；内部保守结算US$0.043261，供应商实扣NOT_OBSERVABLE。[已关闭费用卡](BUDGET_AND_AUTHORIZATION.md)。第14份预留前Git TLS故障停发；先核13已结算现场，恢复后仅发送14–16。

84保护/119冻结/7归档原样。账本938→971，本批仅33条授权事件，完整链一致，SHA 7b1d1935254a7d7830e1d03892d12895707b71107dfc1bfb611f3459e839367d。原身份false/NOT_RUN字段不改，实际执行状态独立保存。

lint/typecheck/build/security与最终产品9组通过。全量原37组30PASS/7FAIL；其中host测试误读真实授权状态已用隔离临时CLI修复，host31+投影8定向39PASS。余6历史组失败保留，未重跑全量冒称31/37；audit5high/2moderate。[验证](VALIDATION.md)。代码提交立即推送，文档另边界提交，最终SHA现场核。

下一步先用现有录制收口显式覆盖状态、主/附属引用契约，正反例走真实Schema→转换→普通首次页，回归未知条件/时间和材料。只有模型输入机制确实变化且需要新输出才另版本冻结、匹配假设申请具体身份/次数/美元上限；不默认新16/24次、净增2或整体100%。本批许可用尽。真人、Holdout、默认采用、合并及部署另需对应证据和授权。
