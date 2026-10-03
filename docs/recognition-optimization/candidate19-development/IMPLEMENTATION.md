# 新生成契约与来源生命周期

2026-10-04。本包不更改默认候选，不改旧C17/C18、D26身份、raw和分数，不授权付费。

| 用户场景/根因 | 实际修改 | 正确性边界 |
|---|---|---|
| C18已有事件/时间，却因null和重复账目生成不了首屏 | Candidate19使用真正的explicit-source-contract-4.0.0生成Schema、四态coverage、主/附属引用和单份scopeAccounting；候选/Prompt独立版本 | present须有实体与依据；unknown不变成没有；缺主实体、错类型、跨scope、矛盾仍拒绝；没有自动补事件 |
| 条件“完成后”被写成当前已完成 | 复用有来源证据的prerequisiteStates校验，资格/前置/可开始分开 | 依赖任务可以保存为等待；资格unknown相关项阻断；不推断完成 |
| 纯事件关闭/刷新后显示核对0项，部分确认提前完结 | sourceWorkflow用canonical实际accepted/rejected身份计待核对任务/事件；Inbox直接显示二者；sourceReviewD26不将未选事件当作拒绝 | 留在同一App/ReviewSession/DomainCommitPlan/Repository；CAS及原子事务继续；不新增平行保存 |
| 录制RecognitionRun误写成通用或本地Prompt | App在capture前记录实际候选、原Prompt、构建、录制/夹具角色、来源基准时间；手动模式仍manual-entry且Prompt=null | 工程夹具明确非模型；原回答、转换、首屏与人工输入分开，来源ID可逆映射 |
| 老评分把明确错deadline类型、格式与办结标准报争议 | 新v11复用v10，添加本批原文明确时间类型、coverage、前置状态、材料格式/命名、办结标准遗漏检查 | 旧v10不动；无损时间截取、完整/简称材料、合法事件标题作为输出前参照替代表达；争议仍保留 |

主要代码：src/experiments/realInput01/candidate19.ts；src/recognition/sourceContractV4.ts；src/lib/sourceWorkflow.ts；src/pages/InboxPage.tsx；src/App.tsx；src/domain/v2/sourceReviewD26.ts；src/experiments/d26Recorded/browser.tsx。

新来源及provisional参照来自generationFixtures.ts和candidate19-reference-data.mjs。值由原文先写，不从adapter输出抄真值。新增6份匿名Development，2份无任务事件、2份条件/依赖、1份精确截止+材料+事件图、1份普通无时间任务。不是独立Holdout。Schema、转换、首屏与Repository往返及合法表示/最小语义反例均在模型输出前校验。

执行器复用旧D26的持久锁、写前receipt、reserve/presend/raw/settle、只读续跑与HALT协议，因旧冻结文件不可改而做版本化参数提取scoped-execution-core/host-2，将固定16改为绑定batch/count。Candidate19宿主只接新12身份；旧D26入口不接新批。凭证分支仅在单独本批授权、同步HEAD、价格、身份及账本门全部通过后可达。本轮未进入该分支。离线故障测试只用系统临时目录中的假账本/假传输。

真实首答契约分数、经过冻结公共转换的人工前首屏和人工最终结果分列。可展示率、工程oracle、旧raw转换成功率都不能写成新模型准确率。v11参照为单作者/model-assisted/provisional；自由描述与泄漏没有真实裁决仍NOT_ADJUDICATED。

普通产品沿用D27最小安排、measurement3.2/low-edit-v2及语义edit/checkpoint/commit/readback，不改阈值、不升级v8或增加依赖。最终浏览器、验证和付费状态在同目录唯一RESULTS入口报告。
