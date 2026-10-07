# 实际普通页面与独立读回
2026-10-07。全部 ENGINEERING_REPLAY，不是新模型成绩或真人试次。实时模型派发机械关闭。旧6872等库未改。

## 构建和复用边界
完整受影响路径在6875的最终功能构建 c708a3e45a33 / source 9cb0479bb1d8 完成，新库 rco-mainline-01-02-i1-d27-plan-recorded-mechanism-complete-1007。
随后只改 PersonalPlanPanel 的恢复状态文案（三行，不改变转换、保存、测量和安排规则），在6876新库复验受影响的日期窗口→确认→安排→刷新路径：
73f94d0dbf62 / source d5a886e1ca34，新库 rco-mainline-01-02-i1-d27-plan-recorded-mechanism-restore-final-1007。
**唯一推荐入口 http://127.0.0.1:6876/**。它提供4份旧真实录制、3份本轮手写wire、2份已有控制；固定回放，不能声称任意通知实时AI。工具增加未启用V5回放分支没有改变该模式的普通JS。

## 操作与结果
| 路径 | 实际操作及关键结果 | 证据 |
|---|---|---|
| 真实02首次动作 | 选录制、粘原文、智能拆分；3任务，资格未知的两项不冒充可执行，核心任务部分接受；标题和正式nextAction均“完成相关信息登记”，不重复“相关信息” | real02-first.png、canonical-6875.json |
| 压缩日期窗口 | 手写V5仅声明既有task及window_start/end；11月6—8日显示11/6、11/8/date_only，没有截止；事务失败→保留选择→关闭重开→手动接受；无半份 | compact-first.png、formal-failure.png、canonical-6875.json |
| 展开日期窗口/已提交只读 | 同原文合法展开两个端点，保持11/6和11/8；提交后独立读回故障，保留commit，确认按钮关闭；“重新读回并核验”后恢复，无第二次提交 | expanded-first.png、readback-pending.png、canonical-6875.json |
| 完整动作控制/精确截止 | 首屏和正式下一步不重复对象；11月6日17:00截止另存，个人安排不覆盖 | whole-action-first.png、canonical-6875.json |
| 两事件/部分确认与恢复 | 系统维护选暂缓→检查点故障→输入及丢失边界提示→“恢复并保存事件选择”→刷新重开；先接受任务+讲解会，再不改事件文字保留维护→正式保存 | checkpoint-failure.png、checkpoint-restored.png、canonical-6875.json |
| 模糊与未公布 | 系统维护开始“周五晚上”/null/vague，结束“结束时间尚未公布”/null/vague；未造日历时刻，各自owner/依据正确 | canonical-6875.json |
| 坏关系局部阻断 | 甲乙组共享开始时间owner冲突保持待核对；无关丙组16:00独立保存；源草稿partially_confirmed | bad-owner-first.png、bad-owner-partial.png、canonical-6875.json |
| 真错不补、来源拒绝不污染 | 真实01/04均SOURCE_CONTRACT_COVERAGE_ENTITY，原文及failed草稿保留、零新增正式事实；随后真实03仍显示本来源原答4个活动，不猜合并 | real01-refused.png、real04-refused.png、real03-first-existing-errors.png |
| 窗口安排 | 范围外真实提示保留待办；浏览器原生日期选择器选11/6，两个窗口任务进入10:00和10:30个人时段；4项安排提交并独立读回 | window-inside-plan.png、window-plan-saved.png、canonical-6875.json |
| 最终刷新状态 | 新6876首屏确认窗口任务，范围外未排入；选11/6→个人09:00/30分钟→保存→刷新；显示“可用时间与估计已恢复。已保存安排仍保留”，不称已采用设置为未确认编辑 | final-restored-settings.png、canonical-6876.json |

窗口日期选择使用官方Computer Use的本机原生日期控件和键盘；没有DOM状态写入、盲坐标或后台按键脚本。早期日期fill未触发React的过程未冒充完成，最终原生选择与canonical已验证。
6875自动化曾误填旧控制原文与另一provider，绑定保护拒绝并保留failed来源；这是操作反例，不是额外模型样本。10草稿=4真实来源+5夹具+该额外拒绝来源，不能变成10个模型分母。

## 最终canonical
6875独立读回并刷新：Task5 / Project0 / Event3 / TimePoint16 / Material2。原13节点为12个来源时间和1个个人计划；先前1计划被新的4项方案替换，最终16时间。1坏关系来源、真实02为部分确认；真实03待核对、真实01/04和provider错配failed。两个日期窗口原事实保持11/6与11/8，不改成截止。四项个人时段11/6 09:00、09:30、10:00、10:30；receipt 0c073880-609a-4ee9-8309-7f944fa877b0 verified=true。
最终6876：Task1 / Project0 / Event0 / TimePoint3 / Material0；date_only 11/6 window_start和11/8 window_end，owner同一办理申请；planned_start=2026-11-06T01:00:00.000Z/AsiaShanghai/09:00，30分钟为明示产品估计，非原文时刻。正式receipt verified=true。重新读回/刷新一致、console=[]、模型POST403。
数量外，还核rawText、值、精度、time角色、owner、原文及反向依据；公开证据是读回摘要，不是可导入工作区备份。完整读回与SHA留本机.data。

## 测量与未测
6875页面10报告57trace；两次事件处置edit→检查点→2commit/readback可查，语义事实纠正0，叶路径保留。没改字段的来源没有editId。刷新时钟断点、缺终态commit/readback保持null，未补0。canonical部分确认与旧ordinary.partial=false分别记录。
完整动作控制主动编辑0、阅读1026ms、等待174ms、墙钟1200ms；展开窗口主动编辑0、阅读46203ms、等待71ms、墙钟46274ms。工程操作时长不是真人省时。两次选择/故障成本保留；重试没有制造同次纠正或重复事实。
[逐来源计量](MEASUREMENT_SUMMARY.json)、[新构建计量](browser/measurement-6876.json)、[证据SHA](EVIDENCE_INDEX.json)。

未取得当前V5四真实来源的模型输出；不能拿手写wire证明其首答正确。单活动边界/资格/禁止等未改代码复用已提交前轮证据，真实03过拆保留为生成风险。当前页面回放无真人，四指标NOT_OBSERVABLE。无同口径旧操作实测，不报省时比例。
