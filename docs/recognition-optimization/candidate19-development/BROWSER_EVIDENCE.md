# 当前实际录制产品验收（最终1.0.1）

2026-10-04。官方Computer Use/IAB真实点击，未读隐藏页面状态/存储或用单测代替浏览器。**唯一推荐：http://127.0.0.1:6817/**；构建`196e7a2ad33a / source 0655b375b834`；隔离库`rco-mainline-01-02-i1-d27-plan-recorded-c19paid1004final`；候选C19固定实际录制/explicit-source-contract-4.0.0→比较后程序转换1.0.1，ENGINEERING_REPLAY。实时模型派发0、回环、原先6813/6809及旧用户库未动。

仅实际2份已SETTLED录制供选，余10未发送不伪造。所有Source/Version/Run/Draft先保存，普通App/ReviewSession/DomainCommitPlan/Repository/D27安排共享产品路径。输入使用来源原基准2026-10-03T09:00+08，不用回放当天重新解释相对时间。

| 实际路径 | 操作与页面证据 | 独立结果/边界 |
|---|---|---|
| 最终C19首次建议 | 本批诊断区选择C19→普通快速粘贴同匿名原文→智能拆分；首屏“0项任务、1个事件”，不要求拒绝重新登记/发邮件；没有编辑或补录 | [首屏截图](paid-evidence/browser/v101-first-display.png)；事件名、周日晚间未知时间来自实际原答，新转换另有审计 |
| 最终仅阅读 | 弹层仅阅读至少10秒后确认，无字段输入 | [实际页面测量](paid-evidence/browser/v101-measurement.json)：activeEditMs0、semanticFields[]、pageEditIds[]，failureEvents1且commit/readback完整；墙钟含工具等待，不称真人省时 |
| 最终提交后读回失败 | 注入一次故障→确认信息并保存独立事件；页面“已提交，读回尚未验证”，提交记录保留，重复确认disabled | [失败截图](paid-evidence/browser/v101-readback-failure.png)。关闭弹层→重新读回并核验；只读回，不再提交 |
| 最终恢复/正式事实 | UI报告“正式事实已保存，独立读回已验证”后，另一个Repository通过诊断按钮读取 | [正式canonical](paid-evidence/browser/v101-saved-canonical.json)：Task0/Project0/Event1/TimePoint1；时间raw周日晚间/normalizedValue=null/precision=vague/needsConfirmation=true；时间指event、event.startTimeId指该时间 |
| 最终刷新/幂等 | reload→诊断区独立canonical读回 | [刷新canonical](paid-evidence/browser/v101-refreshed-canonical.json)：Event/TimePoint数组逐值相等，正式事实没有增长；console error/warn为空。[刷新截图](paid-evidence/browser/v101-refresh-complete.png) |
| 本阶段正式事务失败过程证据 | 新6814库c19paid1004a，0任务1事件首屏→注入正式失败→页面明确未提交→关闭弹层独立读回→重开手动确认 | [失败页](paid-evidence/browser/formal-failure.png)/[失败canonical](paid-evidence/browser/failed-canonical.json)0正式实体；[成功](paid-evidence/browser/saved-canonical.json)及[刷新](paid-evidence/browser/refreshed-canonical.json)均0Task0Project1Event1Time；只复用不受1.0.1否定前缀收紧影响的相同领域提交/失败分支，**不称这是6817最终构建的截图** |
| 本阶段1.0.0读回失败过程 | 6815/00c50d5，同实际录制、独立新库 | final-*文件保留过程证据；最终状态以上v101-*为准，不与运行构建混用 |

最终commit=`source-review:source:ac9951dc:draft:1:fnv1a32:6fc1f57c`；measurement同ID包含commit和独立readback。原模型响应/原semantic/冻结bridge/new projection各存，用户纠正为空。正式时间的canonical timezone=null因为时刻未知；来源provenance仍Asia/Shanghai，不能据此编一个日历日期。

[旧过程measurement](paid-evidence/browser/measurement.json)中刷新/恢复未闭合时间为null及缺失，不回填0。无真实编辑则没有editId/checkpoint成本，不能制造纠正链；最终只读完成0active有实际终态与readback。首次/最终语义正确未由负责人裁决，四项真人指标NOT_OBSERVABLE。

剩余体验限制：提交后恢复需先关闭核对弹层，再点页面恢复；核对页泛化“多个时间、材料或阶段”的既有提示仍不够精确，不能称已最简。两项均未造成事实丢失/重复，但可以根据后续真实体验排优先级，不能用这一工程回放证明普遍省时。C17漏事件不补猜，双臂整批效果因封存仍未知。

## 历史准备阶段工程浏览器证据（原6813，非当前实际模型比较）

以下是此前新生成契约本地交付的过程记录，原文件/evidence不改。6工程oracle并非Candidate19模型输出；此前0调用状态只属于当时阶段，当前付费数看RESULTS/BATCH_STATUS。

### 原6813准备阶段构建实测

2026-10-04。官方Computer Use/IAB实际操作，未用盲坐标、后台UI脚本或单测冒充浏览器。入口6813，新库c19final1004c，最终代码ce97b325f388/source e2c33d4806d9。六份夹具明确ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT；另三份原D26 C18回答为只读真实旧录制，均ENGINEERING_REPLAY。旧6809未操作。

步骤：录制诊断区选择来源→读取该匿名原文→普通快速粘贴→普通智能拆分首屏→核对/修改或局部确认→现有领域事务→诊断按钮从Repository独立读回。没有平行工程保存链。所有输入均Source/SourceVersion/Run/Draft先落库。

| 场景 | 实际操作/首屏 | 独立结果与失败证据 |
|---|---|---|
| S01 无任务停查+模糊时间 | 首屏0任务1事件，周日晚间null/vague；关闭刷新收件箱仍核对0任务1事件；编辑事件名为原文完整表达，关闭刷新、接管、无需再改字保存 | [首屏截图](evidence/S01-final-first.png)。[失败时canonical](evidence/S01-failed-canonical.json)0任务0事件0时间0项目；手动重试后[正式读回](evidence/S01-committed-canonical.json)1事件1时间0项目，标题保留恢复后的完整输入，原首次短标题仍在草稿原答 |
| S02 两事件/开始结束 | 首屏0任务2事件；说明会11/12 10:10→11:40，调试周五夜间→恢复未公布均null | 注入提交后读回失败，页面[已提交/勿重提](evidence/S02-readback-failed.txt)；只重新读回，[之前](evidence/S02-before-reread-canonical.json)/[之后](evidence/S02-after-reread-canonical.json)均累计Event3/Time5，无重复 |
| S03 资格未知与前置 | 填写、递交、领取3任务；领取资格未知局部阻断，其余2任务可选；递交解释等待前一步 | [首屏](evidence/S03-first.txt)、[部分读回](evidence/S03-partial-canonical.json)：T1/T2 todo，T2.dependencyIds指向T1，未凭空completed；第三项未保存，draft.partially_confirmed；刷新仍核对1任务 |
| S04 否定资格 | 尚未获准不能申请；仅保存联系编号1任务；没有错误新增申请 | 同页只读至少10秒后确认，实际阅读88362ms/等待86ms；[计量](evidence/S04-measurement.json)主动编辑0、无缺失、commit/readback完整。不是人类省时数据 |
| S05 材料/截止/事件图 | 1上传任务+1说明会；deadline11/13 09:25，独立说明会11/14 14:20→15:35；PDF、小组编号与接收成功办结保留 | [实际首屏](evidence/S05-first.png)、[字段快照](evidence/S05-first.txt)、[正式读回](evidence/S05-canonical.json)：材料1，PDF/naming小组编号；task.deadline与event_start/end各归正确对象 |
| S06 普通控制 | 核对储物柜编号1任务，原文明示无截止/附件/活动 | 首屏不造时间/事件；确认成功后累计Task5/Event4/Time8/Project0，完整值见最终canonical |
| 旧C18 S05 拒绝后换provider | 原答缺合法主引用，普通生成SOURCE_CONTRACT_PRIMARY_REFERENCE拒绝；保留Source/Run/Draft failed；随后S06正常处理 | 最终canonical同时保留failed来源且无它的正式事实；拒绝没有污染下一provider。不是把所有拒绝改unknown |
| 旧C18 S01/S02 兼容 | 原raw已有事件和周三晚/周四晚；无需补录首次展示0任务1事件，各确认 | 原C18 Prompt、来源原referenceTime、raw及projection各存；模糊时间null。只是旧回答转换/产品证据，不是Candidate19新模型输出 |
| 额外检查点故障 | 同匿名S01新工程Source开编辑时注入失败；输入保留、正式确认disabled；手动重试保存同输入，再保存草稿，不正式确认 | [失败页面](evidence/checkpoint-failure.txt)/[恢复页面](evidence/checkpoint-retry.txt)：准确区分“未持久化”“未确认输入已保存”；累计正式事实数量不变；来源10中该草稿needs_review，不当作完成 |

最终刷新后独立完整读回见[canonical](evidence/final-canonical.json)、[简表](evidence/BROWSER_SUMMARY.json)：Task5/Project0/Event6/TimePoint10/Material1，来源与Run/Draft各10。六工程来源、两旧合法录制、一旧拒绝、一额外检查点故障全部保留；该数量是累计库数量，不当单场景数量或新模型分母。未确认资格项与额外草稿未被归档为成功。

## 编辑与时间链

[S01实际测量](evidence/S01-measurement.json)：editId `b1db2ab2-3cba-4c45-875b-71f98a469d1c`→checkpoint history `0cea796e-3ef9-4024-b348-b3e43968eaa3`→commit `source-review:source:0255e9aa:draft:1:fnv1a32:4402ff6f`→独立readback。一次input episode/一个source:events语义变更，失败1次，手动重试没有新增纠正。现有语义计量将source:events整组变更记录为结构变更，同时保留叶路径；没有声称细粒度事件字段计量已完全解决。

只读S04主动编辑0。S01刷新恢复、S02重开以及首次未闭合只读记录保守标missing，时间null，不补0；[未闭合示例](evidence/read-only-10sec.json)明确缺terminal commit/readback。S04实际阅读总长包含工具处理时间，不能写成恰好10秒或人类效率。工程时间/语义尚未裁决，四真人指标全部NOT_OBSERVABLE。measurement3.2/low-edit-v2与新版语义报告并列，未改阈值。

控制台[error/warn记录](evidence/console.json)为空。文件[SHA索引](evidence/EVIDENCE_INDEX.json)对应实际保存的DOM/截图/Repository/测量记录；AX返回“没有变化”的217字节差分不作为完整页面证据。受影响路径均在最终ce97构建操作；前两个旧构建过程不冒充最终验收。

## 用户操作与边界

在6813下方诊断区选匿名来源，将显示的原文粘入普通录入，核对任务/事件摘要，必要时编辑，再一次正式确认。模糊时间可以保持未知，前置未完成可以保存为等待；资格未知须核准后才能确认相关项。若仅检查点保存仍需正式确认；若已提交但读回失败只重新读回。

没有同口径旧步骤实测，不估算点击/时间下降百分比。恢复接管多一步是防止覆盖他人或较新输入，不要求重填。未重新执行无关全A—L、双真人、账号同步、通知外发与完整取消/替代关系；同事务/CAS/身份隔离已有定向和现行安全组证据，本轮不把旧证据冒充新真人验证。
