# 真实通知定向收口：两项公共时间修复

2026-10-05。本轮状态：LOCAL_FIRST_SUGGESTION_TIME_FIXES_DELIVERED_NO_NEW_MODEL_OUTPUT。
用户授权本地产品工程；新模型、grant、reserve、settle均0。不改Candidate19输入、旧成绩、旧raw、旧冻结或schema v8。供应商第2请求仍是独立封存支线，不阻挡本地工程。

## 发生层及前后行为

| 用户场景与独立原文事实 | 合法工程输入 | 原转换 | 本次公共机制及普通页面 | 保存/安排影响 |
|---|---|---|---|---|
| FRESH-06：日期单独一行2026年10月12日，下一行12:30–14:00 | 已有E1/P0/P1；端点与唯一事件都引用日期、时段 | 两端normalizedValue=null；用户面对不必要时间核对 | grounded-first-suggestion-1.1.0只接受同来源、同唯一owner、唯一日期、紧邻时段的真实引用。首次卡直接显示10月12日12:30→14:00 | 无补录，一次确认保存0任务/1事件/2时间，依据和owner保留 |
| FRESH-07：报名截止2026年6月30日24:00 | 已有注册义务及截止P0 | normalizedValue=null | source-time-semantics-2.1.0将单一合法日终24:00解释为次日00:00，并记录END_OF_DAY_24_00；rawText不改 | 正式截止2026-07-01T00:00；当前10月回放呈逾期，安排不擅自改截止 |

[BEFORE](BEFORE.json)和[AFTER](AFTER.json)使用同一合法手写wire，非模型回答。2条工程输入的3个时间端点从未确定变为正确确定，**不是2/2模型整份正确率**。手写报名夹具仅取截止/动作片段，省略全通知中的资格、审核、缴费；不得把其无条件表示用作完整FRESH-07答案。讲座夹具只测日期布局，标题“活动信息”来自节选，不声称完整讲座识别。

模型原答有事实才能转换；本次不生成缺失任务/事件/端点，不重接坏关系。错误类型、缺日期引用、非owner日期、重复/矛盾日期、跨事件共享端点、24:01/24:30/带秒/无日期/无效日期仍不能得到确定时刻。暂定及明确未公布仍保留待核对/null。不同日期反例产生不同时间值，无场景ID特例。

## 实际代码路径

- src/lib/timeSemanticsD26.ts：版本化日终解释，旧timeSemantics解析器和冻结调用者不动。
- src/recognition/firstSuggestionD26.ts：semantic与ordinary共用引用日期规则及审计；不扫描无关全文日期。
- src/components/OrdinarySourceFacts.tsx：已可靠确定的事件时间显示完整中文日期，仍展示原文；未知时间保留解释。
- src/experiments/candidate19Recorded/currentNoticeFixtures.ts：两份标ENGINEERING_FIXTURE的合法契约。
- scripts/serve-candidate19-recorded.mjs的新--current-notice-fixtures模式：复用普通App、ReviewSession、DomainCommitPlan、CanonicalWorkspaceRepository和D27安排。
- src/recognition/currentNoticeTimes.test.ts：真实解码/转换/正式事务/独立读回，以及不同日期和最小语义反例。

原回答→转换审计→首次RecognitionResult→草稿→正式commit/readback分别保留。工程envelope为解析器兼容带模型身份和零usage，但页面/RecognitionRun明确非模型、tokenUsage=null，不能称真实usage或模型成功。

## 六份实际通知及未测范围

[出处](PROVENANCE.json)、[原文节选及最小事实](SOURCES.json)在任何新模型输出前建立。均为PUBLIC_OPERATIONAL_DEVELOPMENT_NOT_HOLDOUT；single-author/model-assisted/provisional，已见于本轮开发。正文是明确边界的文字节选，排除联系人、付款账户和图片；不声称全页完整识别。

| 来源 | 当前覆盖 | 本轮实际模型原答/整份首次展示 |
|---|---|---|
| FRESH-01，统一认证维护 | 无任务事件、跨午夜、2小时；普通提醒不拆待办 | NOT_RUN / UNKNOWN |
| FRESH-02，迎新预注册 | 日期窗口、新窗口优先、资格未知；旧日期缺失不猜端点 | NOT_RUN / UNKNOWN |
| FRESH-04，离留校登记 | 核心义务、明确系统入口、条件字段、日期精度 | NOT_RUN / UNKNOWN |
| FRESH-05，暑期学校 | 线上活动日期、报名截止、录取前置、二维码不可读取 | NOT_RUN / UNKNOWN |
| FRESH-06，讲座节选 | 分行日期/时段、报名截止、午餐数量不是听众上限 | NOT_RUN / UNKNOWN |
| FRESH-07，夏令营节选 | 24点截止、审核/缴费/通知依赖、工作日与资格 | NOT_RUN / UNKNOWN |

FRESH-07面向中学生，超出普通在校学生主使用人群，仅作时间及条件边界控制，不证明主用户代表性。FRESH-01是2021历史通知，referenceTime固定原发布时间，不能当当前活动。FRESH-03抓取返回但本机receipt未成功保存，明确排除；不补造来源、不重复抓取凑数。静态抓取及浏览器运行均不涉及业务模型。

当前还缺新的明确未公布/真正取消通知完整模型输出；已有旧录制仅回归。跨午夜不带时段的“次日1点”及工作日推导未在本次两项修复中验完整语义，不宣称已修。二维码/海报内容未读，不猜链接。资格、渠道争议和教学泄漏仍未独立裁决。

## 是否需要新候选/付费

本轮选择A：两项公共转换确定性缺口已有合法输入、源码前后和正式读回证据，不需要新模型验证其代码行为。旧13份实际录制的首次事实[逐份相同](OLD_RECORDING_REGRESSION.json)，仅公共审计版本改变。不能据此说模型效果提高。

不改Prompt，不建Candidate20，不建新16/24身份，不提交授权申请。若下一目标是测当前C19在这六份真实通知上的首答，采用独立目的的最小单臂诊断，另先冻结实际请求/公共规则/评价、核价并取得新批具体授权；不是恢复或替代原不确定身份。若实际输出证明生成根因，再考虑一项输入假设及配对比较，而非先造候选。

## 当前必要操作与剩余限制

普通路径：粘贴列出的原文→智能拆分→看摘要→一次接受。5个验收来源均0字段编辑/补录；来源区选择和复制是内部录制工具步骤，不是正常产品必填字段。安排需再点“接受这份安排”，不会静默保存。事件/材料/未知资格无需填写ID、scope、ISO。旧路径未同口径实测，不报告减少比例或真人省时。

测量仍按旧版本记录：本次5commit/5readback/0edit，2失败，4来源完整确认、1来源canonical部分确认。部分来源尚未闭合，旧ordinary report.outcomes.partial=false不能作为终态真值；本轮[汇总](ENGINEERING_SUMMARY.json)直接列canonical状态并保留原报告。另1故障恢复来源时间缺失；不补0。未借测量维护另开根因。四项真人指标NOT_OBSERVABLE。
