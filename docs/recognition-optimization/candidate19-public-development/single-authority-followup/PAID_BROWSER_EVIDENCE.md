# 确定录制的最终普通产品验收

2026-10-06。唯一当前入口 http://127.0.0.1:6871/；产品提交87eb70021c8fad1b2bf85b1e781268d96f36b44a，构建87eb70021c8f / source b513046c8715。全新隔离库rco-mainline-01-02-i1-d27-plan-recorded-authority-paid-final-1006。最终代码构建已提交推送后验收；随后只有证据/交接文档变更，运行代码及构建未变。

模式ORDINARY_APP_FIXED_RECORDING / ENGINEERING_REPLAY，只回放原冻结批已结算ordinal1 Candidate19与ordinal2 SingleAuthority。原8身份2SETTLED/1UNCERTAIN/5NOT_SENT，未取得录制仍保留分母，不以旧页/手写wire代替这些新输出。页面模型POST403，无新业务模型请求。原用户库及6869过程/旧入口不修改。

实际路径为普通App粘贴原文→智能拆分→人工前卡片→ReviewSession→DomainCommitPlan单事务→独立Repository读回。真实来源、参考时基和可逆scope映射沿原冻结请求，不按回放当天重新解释；原答、转换审计、首屏和选择操作分开保存。

| 项目 | 实际页面操作与结果 | 证据：.data/single-authority/paid-browser/final-6871/ |
|---|---|---|
| 初始隔离 | 读取新库，Task/Project/Event/Time/Material全0 | 00-empty.json |
| C19人工前首次页 | 原文复制到普通新事务→拆分，0任务1事件；开始/未公布结束、在线及作品讨论存在，卡片学习证明缺失。无补字 | 01-C19-first.txt/png |
| C19正式保存 | 一次确认，独立读回0Task/0Project/1Event/2Time | 02-C19-canonical.json |
| SingleAuthority人工前首次页 | 相同原文选另一原录制→普通拆分，0任务1事件；在线、作品讨论、完成学习后提供学习证明直接显示。原答真实嵌套属性由新公共程序派生依据索引，无补录 | 03-Authority-first.txt/png |
| 检查点失败 | 关闭弹层→注入下一检查点失败→重开选择暂缓；输入仍在，“尚未保存、刷新可能丢失”准确，正式确认阻断；手动“恢复并保存事件选择”成功 | 04-checkpoint-failure.txt |
| 刷新恢复 | 刷新→待确认重开，暂缓仍在；不随便改字。为了继续确认主动改回保留，选择操作审计独立，不当新增事实 | 05-refresh-recovery.txt |
| 正式事务失败 | 注入正式保存失败→确认，真实错误RECORDED_INJECTED_FORMAL_SAVE_FAILURE，草稿/选择保留；独立库仍只有先前C19的1事件2时间，无半份Authority事实 | 06-transaction-failure.txt、07-failed-canonical.json |
| 提交后读回失败 | 手动重试前注入下一读回失败→正式事务成功；保留commitId，显示“已提交，读回尚未验证”，确认按钮关闭 | 08-committed-readback-pending.txt/png |
| 已提交只重新读回 | 关闭弹层→“重新读回并核验”；显示正式事实保存且独立读回已验证；未再正式提交 | 09-reread-verified.txt |
| 刷新及独立最终值 | 刷新→独立canonical读取，0Task/0Project/2Event/4Time/0Material，两个来源各1事件2时间、两草稿confirmed；没有重复或半份 | 10-final-canonical.json |
| 页面测量 | 2报告29trace，选择editId/检查点/commit/readback关联；失败记录保留，缺失时间null，重试不重复事实纠正 | 11-final-measurement.json |
| 控制台和路由 | warn/error=[]；本机GET manifest200、POST /api/deepseek 403，机械关闭；不发上游请求 | 12-console.json、13-routes.json |

独立值逐源核对：C19 source:8473037d、SingleAuthority source:8f611413。事件均“影像叙事工作坊”，各自开始2026-12-03T13:30 / exact；结束normalizedValue=null / vague，rawText保留“结束时间暂未公布”（另一臂含句号）。start/end节点eventId和sharedEventIds指向各自事件，事件反向端点一致，scope原依据保留；没有时间跨来源错挂。SingleAuthority描述含学习证明，C19没有；原文显示不等于模型事实已出现在建议卡片。

页面加载/保存安全PASS与语义正确分开：C19首屏遗漏仍INCORRECT，原答是否单独信息范围已构成完整证明仍UNKNOWN。SingleAuthority本例原答及后验首屏暂定正确，原冻结编译器拒绝仍保留。每臂4分母，不将1份已返回算100%，全批EVIDENCE_INCOMPLETE_NO_WINNER。

SingleAuthority无事实字段补录，恢复及保留/暂缓操作保留叶路径event:event-0001:disposition；最终语义纠正0、非结构修改。刷新导致time discontinuity，主动编辑/墙钟/阅读/等待/隐藏/空闲等全部null并注明missing，不能补0或称用户省时。C19本例无编辑，activeEdit0，wall23448ms/read23412ms/wait36ms，仅工程记录。measurement3.2/low-edit-v2历史不改；四真人NOT_OBSERVABLE，无注册/同意/真人裁决或模拟人的时间。

未变多活动、共享时间、坏owner局部阻断、窗口安排及旧03人工拒绝沿已提交[BROWSER_EVIDENCE.md](BROWSER_EVIDENCE.md) A—J复用：本次公共属性索引只影响已声明嵌套属性的依据，26定向反例核跨对象/错scope/非法时间owner仍拒绝。原事件选择、事务、安排实现未变，本次三失败仍在最终6871重新实操。SA02—04模型输出缺失NOT_RUN/UNKNOWN，不用旧工程证据冒充。

6870仅过程证据，不作为最终构建替代。末尾收起工程明细时Computer Use的role locator未匹配原生details summary；读取实际文本后改用明确文本定位，成功且无盲目重复输入，不是产品错误/未验收项。最终交付页已保留。

[机器摘要](paid-evidence/BROWSER_SUMMARY.json)保存数量/值/owner/依据和计量链接；[证据索引](paid-evidence/EVIDENCE_INDEX.json)保存本机原始证据字节SHA。授权/raw/完整数据库只留本机，不进Git。封存后16执行文件逐字节未变，完整1015账本验证，无额外发送/恢复/settle；[只读现场](paid-evidence/FINAL_READ_ONLY_SCENE.json)。
