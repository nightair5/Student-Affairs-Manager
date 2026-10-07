# 普通首次建议、保存和独立读回
2026-10-07。官方Computer Use IAB浏览器2；工程作者操作，不是真人探索/模型成绩。旧6880/用户数据库没动。唯一当前入口http://127.0.0.1:6886/；构建base1c9a9d7433fd / source4bb12420d16e，全新库rco-mainline-01-02-i1-d27-plan-recorded-obligation-final-r2。4实际旧录制+8作者/已有工程wire明确区分，模型POST403。

[最终页面](FINAL_PAGE.png)、[最终逐步页面及canonical](BROWSER_FINAL_CAPTURE.json)、[完整独立事实摘要](CANONICAL_FINAL_READBACK.json)、[三故障及部分关联](BROWSER_6885_CAPTURE.json)。完整DOM/Workspace原件保留本机.data/obligation-authority/browser-originals，SHA见EVIDENCE_INDEX；公共文件去除重复的大段PRE，没有伪造动作/时间。

| 路径/来源 | 实际操作、首次页面与canonical | 分支与结论 |
|---|---|---|
| 设备/录取unknown，工程equipment | 首屏准备笔记本独立任务，unknown资格未选/不可加入；研修关联该任务，11/18 09:00 exact、结束未公布null。保存独立活动0Task/0Project/1Event/2Time；任务继续待核对 | 6885源69afd435fbdb。人工测试标题单独计修改，不作为首次正确。PASS |
| 检查点失败 | 编辑标题“准备笔记本（人工恢复检查）”→注入检查点失败→页面RECORDED_INJECTED_CHECKPOINT_FAILURE、“输入仅在本页，刷新可能丢失”；输入在。手动重试→关闭→刷新→重开，真实检查点恢复同标题，CAS会话接管保护保留 | 不用注入函数返回冒充浏览器。checkpoint-failure-input-retained/checkpoint-retry-refresh-restored有页面证据；此阶段无正式任务。PASS |
| 报名关联/部分接受 | 原答已有报名制图讲座、11/6 17:00截止、11/9 14:00—15:00事件。取消任务选择→保存事件：累计0Task/2Event/4Time，event.sourceTaskRelations为pending T1；不造占位任务。随后确认任务，引用解析为正式任务 | 6885部分路径PASS；6886再次不改字整份正式保存1Task/1Event/3Time增量，relation draft与Task temp对应。PASS |
| 正式事务失败 | 同报名待办勾选保留→注入正式保存失败→点击接受→显示正式提交未完成/没有半份。独立库仍0Task/2Event/4Time及前次partial receipt。手动重试没有重复此前事件 | formal-save-failure/formal-failure-no-half-facts。PASS |
| 提交成功但读回失败 | 重试前注入读回失败→提交成功→“已提交，读回尚未验证”，commit ada1c2bb持久，重复提交按钮禁用。独立库1Task/2Event/5Time。刷新仍待读回，点击“重新读回并核验”而非再提交，同commit，数量不变 | source:6b06ec24:draft:1 pending key source-review:pending-readback；重新读回后同commit sourceReviewReadback verified。PASS |
| 双动作窗口，工程shared-window | 两任务都显示办理窗口11/10 09:00—11/12 17:00，0deadline；普通一次接受。6885累计3Task/2Event/7Time；两窗口节点均两个task owner，legacy sourceTimeRole保留window_start/end | 不变个人计划/原截止。PASS |
| 无任务事件，最终no-task | 原文“网络服务在周五晚上维护，结束时间尚未公布。不需报名，不需提交说明。”首屏0Task/1Event/2Time，事件精确原文名，起止null。点击确认信息并保存独立事件→页面已保存并独立读回；0Task/0Project/1Event/2Time，不造日期 | 初始非连续作者标题被保护，修作者夹具后6886正式验收。未知null不是缺失。PASS |
| 分行日期clock，endpoint-test | “设计讨论\n2026年11月20日\n09:30-11:00”→首屏11/20 09:30—11:00，不改字正式确认；同Event owner、2 exactTime | 6886累计0Task/2Event/4Time。PASS |
| 精确截止/PDF/命名，deadline控制 | 递交器材清单、11/6 15:20前、PDF、学院姓名；直接接受。Material unverified（没有文件准备实测），format/naming和任务关联保留，时间deadline不是个人计划 | 6886增量1Task/1Material/1Time。PASS |
| 坏owner局部，已有bad-owner | 三活动首屏显示时间归属与对象不一致风险；保存只收无关联丙组讨论11/14 16:00，甲/乙继续待核对；没改引用或删难例 | 增量0Task/1Event/1Time，draft partially_confirmed，accepted E3/P3。PASS |
| 资格与前置，已有dependency | 填写→提交借用记录，资格未公布的领取钥匙另待核对。前两项接受，领取未选且加入禁用。独立2Task，提交dependencyIds指填写，前置没写完成；首页提交在受阻栏 | 页面已保存2Task，partial而非全部完成；增量Time0。PASS |
| D27安排/刷新/测量 | 接受三个个人时段10/8 09:00、09:30、10:00，3个planned_start另存。原清单deadline11/6 15:20没变，提交仍前置受阻。报名最终确认后刷新独立数量4Task/4Event/12Time/1Material/0Project，12Time含3个人计划。六draft receipt及依据/owner可查 | final-refresh-canonical是最终证据；早期异步PRE旧值单列不当失败或最终证明。6报告40trace；无字段编辑无editId；四真人NOT_OBSERVABLE。PASS |

6885三故障复用依据：后来仅修改no-task作者标题、定向测试及尚未运行比较状态页文案；App/ReviewSession/DomainCommitPlan/Repository/恢复代码未变。6886重新验关系正式保存，并验剩余受影响场景；不将6882/6883白屏过程当最终通过。过程白屏真正修复见RECOVERY_FAILURE_PROCESS及IMPLEMENTATION。

浏览器原始连接错误：首次6885就绪前goto出现net::ERR_CONNECTION_REFUSED；同error页再次导航遇data URL策略拒绝。沿官方browser-troubleshooting诊断一次，在同browser2取得新tab恢复成功；没有SendKeys/盲坐标/替代隐藏读库。最终console error/warn=[]。本轮未新跑双标签不同字段/同字段矩阵；CAS/三向合并实现未改，相关适用产品测试通过，旧证据不冒充新操作。没有新模型raw可回放，新生成首答验收NOT_RUN。
