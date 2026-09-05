# I1-R1 Edge实际浏览器与下载证据

状态：本轮登记补验已执行，待独立复核和适用工程门后决定交付。旧I1 NOT_ACCEPTED不改。
源码改动0：19个实现文件从起始至本记录均与REJECTED_SNAPSHOT一致，没有修改App导出或扩大范围。
浏览器：官方Computer Use选定Edge，id2，主标签763114430；另建同库标签检查并发。未访问既有用户/API标签。
唯一新库：rco-mainline-01-02-i1-a95225c8-344b-4dbc-baee-1c140a0fa84a；origin http://127.0.0.1:11829。
旧I1 origin12998及旧库保留、未访问。启动器随机新端口与新库明确绑定，不声称恢复旧库。

## 操作与实际读回

1. 新入口mount真实App，初始schema8、0来源0任务；首页录入旧multi，真实面板两项一次批量确认，从0变2任务/2时间。不是直接库里造任务。
2. 首次导出监听先注册后click；10秒超时。明确Enter再测仍10秒超时。随后Downloads取得本次workspace (2)/(3).json，各18036字节，与真实canonical全对象JSON摘要均为aaeddf1d1a935da912c8b89201566b23ef93cf2a0a1eb5f5921628aa926d94f2。
3. Downloads原有无后缀/(1)两份文件，身份属于旧I1测试库、7305字节，未用于本轮通过，也不覆盖旧报告。新发现仅追加记录。
4. 再录入旧no-date，用户确认后共3任务2时间0提醒；无日期任务无timePoint，实际buildBrowserReminderJobs返回0。首页该任务不增加缺日期异常分，仍显示原文未说明。
5. 再录入同一旧no-date作为独立操作场景（不是新数据集）。打开真实V2编辑，Control+A后pressSequentially输入“保存活动手册（逐字核对）”。未保存时确认不可用。
6. 工程按钮设置下一事务故障，点击标题保存：INJECTED_ATOMIC_FAILURE，明确失败，无自动重试；保存按钮仍可用、确认仍不可用、缓冲文字保留。实际库与故障前全对象逐JSON相同，原历史7条无增加、任务仍3。
7. 用户主动再次保存标题成功。截止输入pressSequentially逐字“2026-09-18”并明确保存；增加2条confirmation_v2_edit，原来源和首次recognitionRuns完全相同，正式任务仍3。
8. 再设置下一事务故障后确认：INJECTED_ATOMIC_FAILURE。全库与确认前逐JSON相同，两条已保存编辑历史保留，任务仍3，不撤销用户已保存操作。
9. 第二个Edge新标签以同origin/run、不带new=1打开，真实Inbox恢复待确认草稿，显示已保存标题和仅日期。第一标签逐字改标题为“保存活动手册（跨标签核对）”并明确保存。
10. 第二标签仍旧标题时确认：CONFIRMATION_V2_STALE，明确无自动重试，面板读回新标题；确认前后全库逐JSON相同，任务3、编辑历史3，无覆盖。
11. 用户在第二标签重新核对后主动确认：共4任务/3时间/0提醒。日历9月18格及即将到来列表均显示“仅日期”，不显示该任务假08:00；真正无日期任务仍在独立列表。课程说明与另外两个有时刻任务的开工建议08:00不冒充该date-only时间。
12. 最终真实App导出按钮Enter，下载监听仍超时，但获得workspace (4).json，34166字节。实际文件解析与同库canonical全对象摘要一致；读取只用于比较，不用DOM JSON代替下载文件。
13. 最终文件调用既有validateWorkspaceV8：valid=true、issues=[]；旧multi按原42字段口径42/42，评分在文件读回后，不进入产品链。完整文件含3来源/3草稿/4任务/3时间/3用户编辑历史/0提醒。
14. 用户补日期节点normalizedValue/rawText为2026-09-18，precision=date_only、isAllDay=true、timezone=null，extractionMethod=manual；原文和首次响应仍是无日期，不伪装成来源原有日期。
15. 第二标签reload后同库canonical与刷新前逐JSON全等；无日期任务对象全等。刷新epoch只打开指定库、current读取3、写入0；localStorage/fetch/XHR/WebSocket/通知权限/通知发送尝试0。提醒真实jobs0。

## 诊断结论和边界

- 已有实现无需修补导出。观察到“监听超时”与“真实文件成功”同时成立：监听不是可靠的成功判据。不能据此断定所有IAB/Edge下载机制；新成功不改历史I1当时未取得文件的结论。
- Edge日志两标签曾有message-channel异步监听错误（A listener indicated an asynchronous response...），没有源栈可归因；保留此非零观测，不擅称控制台全零或确定是扩展。主链存储/文件结果不受观察到的损害，待审查判断。
- 辅助edge://downloads被工具安全策略拒绝，未重试或改用其他界面绕过；文件核验仅在已授权Downloads精确同名路径进行。tab.content.export也不支持，未使用替代隐藏状态接口。
- 验证脚本首次命令有PowerShell换行转义错误，第二次直接从draft读取sourceId字段错误；修正为实际Draft→Run→SourceVersion归属后才计42字段。没有修改旧测试、Expected、fixture或产品决策，两个诊断执行错误不冒充产品失败。
- 工程证据工具仍有Sidebar局部遮挡，使用官方键盘操作；没有声称该辅助面板鼠标布局已经修好。实际产品录入/确认/日历仍用真实组件。
- 本轮补验只用multi/no-date和重复旧no-date操作，旧I1八类场景只读复用，不声称本轮重新跑8类。
- 已跑本轮错误默认选、未确认正式写入、重复、覆盖、关键丢失0；故障保存/故障确认/过期请求都是预期安全拒绝，不计误选，也不计模型失败。
- 仅本机隔离确认、查询和备份工程证据，不代表稳定入口、正式任务编辑/执行/ICS/真实提醒、Chrome/手机、真实材料/真人/商业上线通过。
- 模型准确率：本轮未测量；模型/verifier/Repair/retry/模型网络/费用/密钥与剪贴板访问0。

补充身份与覆盖：同库并发标签763114444；辅助空标签763114431（下载管理器访问被拒绝后未绕行）。主标签最终effects为current读取38/写入尝试17，均只限同库；包含故障事务尝试，不当成17笔成功。先前multi两任务、sourceVersions与recognitionRuns在最终库中逐对象不变。
