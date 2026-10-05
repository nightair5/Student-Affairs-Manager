# 当前交付：4份真实首答已完成，两个程序误挡已修

2026-10-05。CURRENT_C19_REAL_NOTICE_DIAGNOSED_WITH_EXPLICIT_REMAINING_ERRORS。本批C19-CURRENT-REAL-NOTICE-DEVELOPMENT-R1原4身份全部一次发送、确定结算，0不确定、0重试。Candidate19生成契约、原来源/参照/身份/Manifest和旧成绩未改。

**人工修改前，确认整份正确0/4；原答3份有事实错误、1份未知。** 这是single-author/model-assisted/provisional的4份Development诊断，未知保留分母；不代表每个字段都错，不是独立真值或泛化成绩。[原始判断](current-notice-diagnostic/paid-evidence/ADJUDICATION.json)、[冻结首次报告](current-notice-diagnostic/paid-evidence/FROZEN_FIRST_REPORT.json)。

| 层 | 整份正确 | 有错误 | 未知 | 分母与含义 |
|---|---:|---:|---:|---|
| 本批实际模型原答事实 | 0 | 3 | 1 | 4，包含合法表示判断及争议 |
| 原冻结公共转换后的首次展示 | 0 | 4 | 0 | 4，两处程序误挡也进入错误 |
| 修复后用相同raw重新展示 | 0 | 3 | 1 | 4，后验程序兼容，非新版模型成绩 |
| 真人最终处置 | 0 | 0 | 4 | 4，无真人试次/裁决，NOT_OBSERVABLE |

[新转换判断](current-notice-diagnostic/paid-evidence/POST_REPAIR_REPORT.json)与原报告并存，没有回填原成绩。标题/自由描述未决不满分，单臂不判候选赢家。原v11 C17 2/6、C19 1/6、MIXED_PROGRESS及旧后验4暂定2错/5暂定1争议保持。

## 用户少卡在哪一步

1. 暑假登记：原答已有“学工系统应用＋精确URL”，程序却因https被分成相邻scope、登记角色表达不同而清空渠道。公共material-channel-role-grounding-1.4.0只在同对象、真实相邻引用、相同URL及肯定角色成立时保留入口。基本项可直接部分确认，离校/外出资格unknown仍待核对；不用为原答已有入口补录。
2. 暑期学校：原答已有活动结束2026-07-10，但原文区间省略第二次年份，程序误置null/vague；标题跨相邻引用也被换成“待核对事件”。首次组装1.2.0验证既有唯一事件的闭区间端点、类型、值和依据后保留原值与标题。错日期、错owner、多区间、倒序省略跨年及缺事实仍拒绝，不补模型漏项。

[实现与反例](current-notice-diagnostic/paid-evidence/IMPLEMENTATION.md)、[发生层](current-notice-diagnostic/paid-evidence/ROOT_CAUSES.md)、[原转换](current-notice-diagnostic/paid-evidence/BEFORE.json)、[新转换](current-notice-diagnostic/paid-evidence/AFTER.json)。两处均接普通App→ReviewSession→DomainCommitPlan→Repository，未建立平行保存链；旧13实际录制首屏事实逐份相同。

## 仍然存在的真实错误

| 来源 | 原答问题 | 修复后仍需处理 |
|---|---|---|
| 01 新生预注册 | 时间窗口当deadline；T2 coverage引用时间，但owner只有T1 | 图矛盾仍阻断，原文保留，不猜接关系 |
| 02 暑假登记 | 条件拆分、总截止传播和整体自由描述有争议 | 基本项可保存，个人适用待核对；整份UNKNOWN。标题“完成相关信息登记相关信息”重复仍列页面问题 |
| 03 暑期学校 | 一个活动拆成4独立事件，证书结果也变事件 | 起止已正确，多余事件仍错。普通事件入口目前整体保存，未提供逐个拒绝，不能宣称正确单事件处置完成 |
| 04 讲座 | 漏12:30开始，结束类型/日期关联错；coverage与边矛盾，兴趣写true | 仍拒绝，不自动补开始、资格或关系 |

本包仅收口两个公共根因，没有用猜事实、全部unknown或静默合并提高分数。下一输入假设优先减少coverage与owner重复声明造成的矛盾，必须另版本实证，旧C19不改。

## 唯一内部入口与实际保存

[http://127.0.0.1:6855/](http://127.0.0.1:6855/)，ORDINARY_APP_FIXED_RECORDING / ENGINEERING_REPLAY；本批4份Candidate19固定录制，浏览器模型路由机械403关闭。实际运行构建d8fde20f94f9 / source d226a74a307a；独立库rco-mainline-01-02-i1-d27-plan-recorded-current-real-final1005。构建在提交前形成，内容hash对应最终验收代码；不冒称最终Git HEAD。

展开“本批真实录制·选择来源与独立读回”，选来源，复制原文到普通“新事务”→核对首屏→确认有依据的项→独立canonical读回。01/04真实失败并保留来源；02可先保存基本项；03应观察并记录多余事件，不把工程保存成功当语义通过。

实际验收：02渠道/date_only部分保存；正式事务故障没有新半份事实，手动重试成功；提交后读回失败显示已提交但未验证，刷新后只重新读回，无重复提交。03工程事务读回E1开始2026-07-06、结束2026-07-10，均date_only、同一owner，刷新一致；另3事件仍错误，不能算正确处置。01/04没有新增正式任务。[浏览器及独立证据](current-notice-diagnostic/paid-evidence/BROWSER_EVIDENCE.md)。

最终Task2/Material2/TimePoint4/Event4/Project0，包含02正常来源和新故障来源各1任务，非重试重复。3来源部分确认、2失败。D27保留7月原截止，10月回放已逾期，不猜新日期或可行时段。pageEditIds均[]，3commit已核验；刷新/未闭合计时为null和missing。旧ordinary.partial=false不能覆盖canonical部分状态。四项真人NOT_OBSERVABLE。[工程汇总](current-notice-diagnostic/paid-evidence/BROWSER_SUMMARY.json)。

## 调用、验证与保护

4send/4settle、1grant/4reserve/4settle，零retry/repair/verifier；许可已用完，不沿用剩余上限扩样本。真实usage输入20,490、输出12,040、合计32,530；忽略缓存优惠的内部保守结算US$0.020598，服务商账单实扣NOT_OBSERVABLE。US$1.30是授权硬限。[执行与原样SHA](current-notice-diagnostic/paid-evidence/EXECUTION_SUMMARY.json)。授权原文/PRICE/AUTH仅本机.data，未入Git。

lint/build/scan通过，8既有lint警告、旧大chunk警告保留。定向3文件78PASS（本轮18），新只读3PASS；权威全量原41组35PASS/6FAIL，新增只读组另跑PASS，合计42独立组36PASS/6历史FAIL，未因入口新增重跑无影响41组。server/worker/functions本次PASS，server旧bad port本次未复现。六历史哈希/末尾账本快照失败及audit5H2M/production0单列，未弱化旧断言或改锁。[完整验证](current-notice-diagnostic/paid-evidence/VALIDATION.md)。

84保护/119冻结/7归档通过；账本1000→1009仅本批9条合法追加，完整链及原1000/996前缀不变，之后只读。SHA c730854da5eabbef8c6c62d1da2dea6511ecf2f586fa9872fd2c9b4a1baa140f。旧公开封存批1SETTLED/1UNCERTAIN/2NOT_SENT未恢复或重发。[保护与追加](current-notice-diagnostic/paid-evidence/HISTORY_AFTER.json)。用户.audit-2026-10-05/8文件均保留；7份哈希不变，README在本轮期间另有更新，本包未编辑或回滚。仅本机Git exclude忽略，均未提交。

Conventional Commit后立即普通推送，最终SHA以交付消息为准。[短交接](../CURRENT_CONTEXT.md)、[下一工作包](../../governance/NEXT_STAGE_EXECUTION_PROMPT.md)。下一步先本地处理有实证的生成关系一致性与单活动边界，形成可运行版本后才决定最小新输出及另行许可；不先招募真人、造24身份或改默认。本包未开展真人/Holdout/default替换/合并/部署。
