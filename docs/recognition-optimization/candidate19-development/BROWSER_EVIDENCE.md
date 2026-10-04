# 完整原批录制：普通产品路径实际验收

2026-10-04。官方Computer Use/IAB实际点击，未读取隐藏React/IndexedDB状态，不用单测代替浏览器。唯一推荐 **http://127.0.0.1:6820/**。构建6abc47a8d192 / source 194d64cb84ec；全新库rco-mainline-01-02-i1-d27-plan-recorded-c19complete1004；12份实际原批录制、ENGINEERING_REPLAY。source-support-accounting-projection-1.0.0 / source-grounded-nonaction-projection-1.0.1 / explicit-source-contract-4.0.0。模型派发机械关闭，旧6817/6809及旧用户库未动。

来源原referenceTime 2026-10-03T09:00:00+08:00，回放不按当天重解释。Source/Version/Run/Draft先保存；普通App、ReviewSession、DomainCommitPlan和Repository共用正式链，D27个人安排继续复用。

[机械停发证据](paid-evidence/completed/browser/MECHANICAL_DISPATCH_GUARD.json)：向本机/api/deepseek发送空工程请求返回403/C19_MODEL_AND_EXTERNAL_ROUTES_DISABLED；没有上游模型请求。

## 实际场景

| 场景 | 真实操作 | 独立结果 |
|---|---|---|
| S05 原拒绝录制已有材料、截止、说明会 | 选择C19→快速粘贴原文→智能拆分；无补录，首屏1任务1事件，底部1材料3时间→注入正式失败→接受 | [首次截图](paid-evidence/completed/browser/S05_FIRST.png)/[字段](paid-evidence/completed/browser/S05_FIRST.txt)；[失败页](paid-evidence/completed/browser/S05_SAVE_FAILURE.txt)/[失败读回](paid-evidence/completed/browser/S05_FAILED_READBACK.json)：Task/Event/Time/Material均0、Source/Draft保留，没有半份事实。 |
| S05 手动恢复及刷新 | 关闭→收件箱重开→手动再次接受→独立canonical按钮→刷新→另Repository重新读回 | [成功读回](paid-evidence/completed/browser/S05_SUCCESS_READBACK.json)Task1/Project0/Event1/Time3/Material1；PDF、文件名包含小组编号、接收成功完成标准保留，deadline11/13 09:25和event11/14 14:20→15:35分离，无重复事实。 |
| S03 真实资格与前置 | 原拒绝C19现在首次显示3动作，默认仅2可选；点击一次接受2，无手动修事实 | [首次](paid-evidence/completed/browser/S03_FIRST.txt)/[部分成功](paid-evidence/completed/browser/S03_PARTIAL_CONFIRMED.txt)；[读回](paid-evidence/completed/browser/S03_PARTIAL_READBACK.json)本来源2Task todo，递交dependencyIds指填写，领取未创建，草稿partially_confirmed，弹层留剩余1项。 |
| S01 无任务事件及读回失败 | 首屏0任务1事件，周日晚间未知；注入提交后读回失败→确认 | [首次](paid-evidence/completed/browser/S01_FIRST.txt)、[已提交/勿重提](paid-evidence/completed/browser/S01_READBACK_PENDING.txt)，按钮disabled，保留提交记录。关闭弹层→仅重新读回并核验，没有再次正式提交。 |
| S01 恢复与刷新 | 独立canonical读回→reload→再次独立读回 | [恢复](paid-evidence/completed/browser/S01_REREAD_RECOVERED.json)/[刷新](paid-evidence/completed/browser/S01_REFRESH_READBACK.json)数组一致；本来源0Task/0Project/1Event/1Time，raw周日晚间/null/vague/needsConfirmation true，正确事件归属。 |
| S02 两事件和未知结束 | 首次无补录0任务2事件，四时间可核→确认→独立canonical | [首次](paid-evidence/completed/browser/S02_FIRST.txt)、[最终](paid-evidence/completed/browser/FINAL_CANONICAL_READBACK.json)：event1 2026-11-12 10:10→11:40，event2周五夜间/恢复未公布均null，原文精度/依据保留。 |

[机器可核值与来源关系](paid-evidence/completed/browser/CHECK.json)基于浏览器按钮呈现的独立Repository输出，最终累计Task3/Project0/Event4/Time8/Material1。S01不是另添待办或空项目；事件未知不造确定日程。S03资格未知不能变符合、前置不能变完成。没有用户补录换取首次正确。

## 计时和真实失败记录

[页面测量](paid-evidence/completed/browser/MEASUREMENT.json)：4来源均有真实commit/readback，未编辑字段所以pageEditIds=[]、checkpointStageCount0，不能制造editId。2闭合只读记录阅读35.787s/67.887s，主动编辑0；系统等待122ms/134ms，另2份有刷新断点/未闭合区间，时间null不补0。S05正式失败、S01读回失败各1个failureEvents保留。

S03 canonical是partially_confirmed，旧计算器未结束时outcomes.partial=false；该历史布尔值不能替代真实终态，CHECK并列保留。没有真实裁决，firstWholeSuggestionCorrect/correctDisposition为NOT_ADJUDICATED、低修改正确为NOT_OBSERVABLE，真人四指标NOT_OBSERVABLE。自动化墙钟包含工具操作，不称真人省时或在线服务速度。

浏览器console error为空。验收中的两处控制脚本问题留在CHECK：异步读回点击后立即读取pre会暂时拿到上次失败快照，按后续可见值及刷新重新核对后保存正确证据；部分确认本就留弹层，等待其隐藏的脚本超时不是产品保存失败。没有因此重发模型或重复正式提交。

## 尚未解决的体验和范围

读回恢复按钮位于弹层外，仍需先关闭；资格风险摘要重复、诊断细节较多，不称界面已经最简。S04条件性禁止仍留受阻申请卡，相关模型事实/表示风险待定向修，未在本轮冒充已验收。过期clear、双标签和双匿名身份底座本轮未修改，复用既有D21/D22及当前隔离测试，不把那些旧截图称本构建新点击。

旧6813工程夹具、6814/6815/6817仅两录制过程文件保持原字节；本轮以completed/browser为准，旧过程不代替以上受影响路径验收。
