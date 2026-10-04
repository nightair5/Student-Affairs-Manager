# 事实诊断与条件性禁止首次展示：本地交付完成

2026-10-04。本轮只处理两个根因，使用原C17/C19全部12录制，无新模型、grant、reserve、settle或账本写入。S04当前明确不适用的申请不再多出一张核对卡；S02/S05按事实值、类型、对象、关系和依据区分合法表示与真错误。没有改Prompt、候选、默认或旧分数，没有用户补录来获得首次正确。

## 原比较与新诊断分开

原C19-C17-C19-DEVELOPMENT-R1，6匿名已见Development×2臂、3AB/3BA，12确定发送/SETTLED、0不确定、唯一原grant已耗尽。原冻结v11仍为 **C17 2/6=33.3%，C19 1/6=16.7%，MIXED_PROGRESS**，0胜5平1负、净−1。[原完整报告](paid-evidence/completed/FROZEN_COMPARISON_REPORT.json)及原Expected/raw/Manifest/身份不改。

[新只读诊断](paid-evidence/fact-followup/FACT_DIAGNOSTIC.json)为 recorded-source-fact-diagnostic-1.0.0；[新事实参照](paid-evidence/fact-followup/FACT_REFERENCES.json)诚实标 SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL / POST_HOC。全部12固定分母、双臂同规则，原模型wire、旧分数、此前程序转换、新转换审计、新诊断和用户修改分列。标题、自由描述、教学例泄漏 NOT_ADJUDICATED；整个用户输出的独立人工正确率 NOT_OBSERVABLE。

| 口径 | C17 | C19 | 能说明什么 |
|---|---|---|---|
| 原冻结v11整份通过 | 2正确、4错 / 6 | 1正确、5错 / 6 | 原解析、编译及契约评分的实际结论；不改写。 |
| 旧raw经当前程序转换，结构化最小事实诊断 | 4暂定通过、2事实错误、0未知 / 6 | 5暂定通过、0已确认事实错误、1争议 / 6 | 事后诊断程序兼容与事实，不是新模型准确率，不据此判C19获胜。 |

| 来源 | 本次诊断C17 / C19 | 原答→转换→页面的证据及剩余问题 |
|---|---|---|
| S01 无任务、暂停查询 | FACT_ERROR / 暂定通过 | C17真的漏事件及“周日晚间”时间，程序不补猜。C19已有事实，沿用直接禁止1.0.1后0任务1事件，未知时间null。 |
| S02 两事件四时间 | FACT_ERROR / 暂定通过 | C17网络开始写planned_start且漏恢复未公布结束；是真类型/完整性错误。C19同事件“11:40结束”合法继承已明示日期，两事件四时间完整，截取边界不是错时间值。 |
| S03 填写→递交、领取资格未知 | 暂定通过 / 暂定通过 | 已有依赖和unknown资格，支持引用转换继续复用。首次3项，2项真实待办可保存；递交等待前一步，领取未确认为可执行。 |
| S04 未获准不能申请 | 暂定通过 / 暂定通过 | 原raw各2项，新条件性转换仅在同对象资格、禁止、negative/false和无关联风险一致时转信息。首次1项“保存活动联系编号”，禁止申请仍在原文和审计中。 |
| S05 截止、材料、完成标准、说明会 | 暂定通过 / UNKNOWN | C17命名/标点/同日时间截取属于合法表示。C19核心字段已有，但“平台”是否是提交渠道原文没有明确交代；保留争议，不能给整份满分。 |
| S06 普通控制 | 暂定通过 / 暂定通过 | 只核对储物柜编号，不增加截止、附件或事件。 |

新诊断允许同对象无损截取、明确的材料/命名同义和顺序变化；错日期、错类型、跨对象、缺必要时间、矛盾依据、坏端点和图冲突继续判错。未决仍占分母。此参照不是独立真值，旧已见6来源不是Holdout。

## 用户现在少卡在哪里

新公共组件 source-grounded-conditional-nonaction-1.0.0 接入现有普通App，不另建保存链。S04粘贴→拆分后只核对并接受“保存活动联系编号”；不再要求核对或拒绝一张当前不允许执行的申请卡。原任务、条件、对象和依据留审计，inferredFacts=0。未知资格、前置未完成、提醒、双重否定、错对象或依赖/修订关联不能套删除规则。

同时检查任务声明与实际材料/时间/事件owner、反向关联、父项和依赖。错挂关系只阻断声明有错的任务，正确的独立事件仍可单独保存；程序不猜接端点。不改变原截止，也不扩大D27最小安排。[实现与正反例](IMPLEMENTATION.md)。

S04从原raw/旧转换2张卡变成当前1张卡有程序和首次页面证据；没有同口径旧路径点击计时，不估算节省百分比。没有真人数据，不能称真人更快或识别已泛化。

## 最终浏览器与独立读回

唯一推荐内部入口 **http://127.0.0.1:6825/**。全新库 rco-mainline-01-02-i1-d27-plan-recorded-c19factsfinal1004，12固定录制、ENGINEERING_REPLAY、实时派发关闭。实际页面构建标记95537dfb55d4 / source bb002e92f3e1；构建时尚未提交的新源码与已推送代码 **4598b59c7c695133c7532e7a05e6adf1b225ada8** 精确同hash，不把旧HEAD标签冒充最终HEAD。[构建及保护证明](paid-evidence/fact-followup/PROTECTION_AND_BUILD_PROOF.json)。旧6820及旧库未操作。

六来源最终构建实际首屏、确认、正式事务失败手动恢复、提交后只重新读回、刷新完成。[操作证据](BROWSER_EVIDENCE.md)、[逐来源canonical核值](paid-evidence/fact-followup/browser/final/CHECK.json)：累计 **Task5 / Project0 / Event4 / TimePoint8 / Material1**，5来源confirmed、S03 partially_confirmed。三份模糊/未公布时间为null；前置任务todo，资格项未保存，无重复/半份正式事实。S05渠道争议未因保存成功变成正确。

[真实页面测量](paid-evidence/fact-followup/browser/final/MEASUREMENT.json)6个commit/readback可查，无字段编辑则editId为空。4闭合只读记录主动编辑0；S03未闭合、S05恢复断点的时间null，不补0。两次故障成本/状态保留，旧outcomes.partial=false与canonical部分确认分列；不改历史计算器或回填旧时间。四项真人指标 NOT_OBSERVABLE。

## 验证、保护与费用

[VALIDATION](VALIDATION.md)：最新定向11PASS；全量39组确定退出，33PASS、6旧历史哈希/账本快照FAIL，产品Vitest976PASS/1既有SKIP及server/worker/functions适用组通过。最后局部图阻断修正后重验11定向、lint/build/security及最终浏览器；没有弱化旧断言或全局提高timeout。lint0错误8既有警告，build既有chunk警告，scan通过。audit5high/2moderate开发工具风险保留，production-only0，不称全量全绿。

84保护/119冻结/7归档、原12请求/raw及v11保持。账本完整链996行，前后 SHA **c58231633b8da1b87e9106f92d0dd457f00e4789e5e5fa03de780fb377dc8750** 一致，工程写入0。原历史840快照之后156合法追加已定位，其中原C19完成25行；本轮没有追加，不将历史快照当永久断言。[原字节与完成证明](paid-evidence/completed/COMPLETION_PROOF.json)。

本轮新付费0。原耗尽批次仅作历史：input54270/output14511/total68781/cached43520/reasoning0；内部保守结算US$0.033699，实扣NOT_OBSERVABLE，原上界3.892848≤3.90不是新许可。[原费用记录](BUDGET_AND_AUTHORIZATION.md)。

## 下一步与停止

本次程序修复无需再付费验证才能交付。真实未解决的是C17 S01漏事件、S02错时间类型/漏结束，及C19 S05渠道争议；不再花一批费用重复排查已经解决的显示或表示问题。只有下一轮确需改变模型输入、验证新的首次生成，才先定最小必要配对假设/新版本/参照与请求，再申请具体模型、身份、次数、费用及唯一grant。没有默认Candidate20或新16/24身份。

停止状态 **C19_RECORDED_FACT_DIAGNOSIS_AND_CONDITIONAL_DISPLAY_DELIVERED**。原模型成绩保持，新工程与事后诊断已交付；无真人、Holdout、默认替换、合并或部署。代码已按边界提交立即推送；证据文档独立提交后同样推送，最终Git现场核验见本次交付回复。
