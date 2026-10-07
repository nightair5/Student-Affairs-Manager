# 当前交付：动作与日期窗口收口，当前V5真实首答待独立诊断
2026-10-07。CURRENT_MECHANISM_PRODUCT_DELIVERED_CURRENT_V5_OUTPUT_NOT_RUN。
人工修改之前完整准确仍是主线。产品提交7a155c9、c708a3e、73f94d0已立即普通推送，最终同步SHA见交付消息。没有新Prompt、候选或模型请求。
[实现](current-notice-diagnostic/current-mechanism-followup/IMPLEMENTATION.md)、[逐来源同raw诊断](current-notice-diagnostic/current-mechanism-followup/DIAGNOSTIC.json)、[实际浏览器](current-notice-diagnostic/current-mechanism-followup/BROWSER_EVIDENCE.md)、[验证](current-notice-diagnostic/current-mechanism-followup/VALIDATION.md)。

## 用户少改什么
1. 真实02原答action已经包含“相关信息”，旧标题/下一步又加一次object。首次组装1.3.0现在保留完整动作一次；普通卡片与正式nextAction同样修复，原action/object/raw不改。部分字词重合仍保留，不靠删对象改变事实。
2. V5已有window_start/window_end及真实owner，但压缩日期范围把结束也读成开始、合法展开端点变null。窗口端点1.0.0从已声明角色/逐字依据分别读取；11月6—8日正确保留11/6与11/8/date_only，不造时刻或deadline。倒序/无效/歧义/错owner继续阻断。
关联安排层用窗口计划1.1.0把明确日期用作整日范围（含结束日），个人安排与原文分别保存。最终刷新又改正文案：已采用的可用时间不再假称未确认编辑，已有安排保留。没有另建保存系统/全局计划器。

属性索引、来源信息展示、渠道/资格/禁止、逐事件处置、恢复/CAS/原子提交仍复用。补充信息没有猜成owner。回放只读reader另修通用host误拒他批合法账本追加：独立核原Git blobs、准确本批记录和完整链；通用付费gate完全没放宽。

## 首次正确率：哪些知道、哪些不知道
旧真实四份仍使用原provisional来源参照，没有重写旧成绩：
| 层/批 | 正确 | 错误 | 未知 | 固定分母 |
|---|---:|---:|---:|---:|
| 旧C19真实4原答事实 | 0 | 3 | 1 | 4 |
| 原冻结人工前首屏 | 0 | 4 | 0 | 4 |
| 当前公共程序同raw首次展示 | 0 | 3 | 1 | 4 |
| 当前V5新真实诊断 | 0 | 0 | 4 | 4，NOT_RUN |

真实01：办理窗口被写deadline及coverage/owner不一致，仍拒绝，不自动改模型声明。
真实02：完整动作不重复，核心项可部分接受；资格拆分、总截止及自由描述仍未决，整份UNKNOWN。
真实03：一活动/形式/结果过拆为4活动仍真实显示，不猜合并成首次正确。
真实04：原文明示时间遗漏、个人兴趣无据true、关系矛盾仍拒绝。
窗口合法表示与安排的正反例是手写工程wire，不能算V5模型准确率。标题修复是旧raw程序证据，不是模型原答提高。

原单权威8批每臂4：原答C19 0/0/4、SingleAuthority1暂定/0/3；原冻结首屏两臂0/1/3；属性/信息程序后当前首屏C19 0/0/4、SingleAuthority1/0/3。本轮对其已知两份首屏事实无新增变化。C19学习证明归属仍UNKNOWN。
原v11 C17 2/6、C19 1/6、MIXED_PROGRESS；12后验C17 4暂定2错、C19 5暂定1渠道争议保持。这些不能拼成统一胜率或新模型成绩。参照single-author/model-assisted/provisional；标题/自由描述/泄漏未独立裁决NOT_ADJUDICATED，Development不证明泛化。

## 普通页面、确认、安排与恢复
唯一[内部入口](http://127.0.0.1:6876/)，最终产品构建73f94d0dbf62/source d5a886e1ca34，隔离库rco-mainline-01-02-i1-d27-plan-recorded-mechanism-restore-final-1007。普通App、固定录制ENGINEERING_REPLAY；4旧真实录制+3手写wire+2已有控制，模型POST403。
展开来源选择→选一份→粘对应原文→智能拆分→核对一次→接受正确项；未确认风险留草稿；可在首页查看/调整并接受个人安排。普通用户不填ID/scope/ISO，不静默正式写入。

6875完整功能构建验首次/部分确认/坏关系局部阻断/三类故障手动恢复/刷新读回；最终总Task5 Project0 Event3 Time16 Material2，4个人计划原截止不变。后来只改恢复文案，6876新库复验窗口→确认→安排→刷新：Task1 Project0 Event0 Time3 Material0；原11/6与11/8/date_only，另存个人11/6 09:00，receipt verified=true。无半份事实、已提交失败只重新读回、模糊/未公布null保留。受文案影响路径最终构建实测，其余未变代码明确复用6875证据，不冒充新模型回放。
[canonical与证据SHA](current-notice-diagnostic/current-mechanism-followup/EVIDENCE_INDEX.json)。

页面10报告57trace；真实终态分栏：confirmed4、partially_confirmed2、needs_review1、failed3；额外provider绑定拒绝是操作反例，不是新样本。事件选择edit→检查点→commit/readback可查，事实纠正0，无字段编辑不造editId。刷新/未闭合/缺终态保持null，旧ordinary.partial=false不覆盖canonical。产品操作墙钟仅工程；没有同口径旧路径，不估省时。measurement3.2/low-edit-v2不改，四真人NOT_OBSERVABLE。

## 必要的当前版本新输出
V5生成契约已可运行，但只取得一份匿名作者的确定输出；没有上述4份官方节选的V5首答。因此下一步是**独立当前版本四来源单臂诊断**，复用既有来源/参照/时基，不先造候选、输入假设或两臂费用，不替代封存ordinal3、不填原八次未知。
批V5-CURRENT-REAL-NOTICE-DEVELOPMENT-R1，现成安全执行器的薄绑定；相同未改V5 Schema/Prompt。来源、七类事实参照、request身份/SHA、参数/公共层、评分/停止规则在任何输出前冻结；NOT_RUN/dispatchAuthorized=false。冻结核验和本批具体申请随最后交付收口，本轮没有付费许可，不prepare/dispatch。

## 保护、费用、验证与资产
本轮模型/grant/reserve/settle全0，账本只读。1015行SHA25f32a95eb28a264c3bec20500cf0b439ab33ad445dddfe8eba243c469c948d9前后相同；996/1000/1009字节前缀核验。84保护119冻结7归档PASS，原封存16文件逐SHA全同。[只读现场](current-notice-diagnostic/current-mechanism-followup/READ_ONLY_SCENE.json)。
原8身份2SETTLED1UNCERTAIN5NOT_SENT，1grant3reserve2settle；03进入TRANSPORT_ENTER后OTHER_FAILURE，无raw不能判未送达；锁/HALT保留，不恢复/补settle/重发。原2份真实usage输入9405/输出2207，内部US$0.005471，实扣NOT_OBSERVABLE。03reserve上界不是消费，旧2.60不是新许可。
旧公开封存也没动；需原03特定响应/usage/送达或可靠未送达材料才判断恢复，支线不阻当前独立产品工作。

定向真实Schema/事务正反例、最后19Vitest及12只读/绑定Node通过；当前产品9组/当前安全24记录PASS且确定退出；全量整体exit1、六旧历史失败如实保留。最后lint0error8旧warning，build/scanPASS。旧D17账本、D9/RCO-5-007/C11哈希断言及audit5H2M/production0没改凑绿。新相关失败0。无疑点不循环全量。
用户CODEX_DESKTOP_HANDOVER.md及15审计资产保留；不读Secret/旧库、不新增依赖或升级v8、不改旧raw/Expected/成绩/Manifest/锁/断言。代码可独立revert；既有付费/不确定行为不能借代码回退当未发生。

未测当前V5四份真实首答、原完整8比较/第三实扣、独立真值/泛化/真人省时。下一最少主线授权为这一个新四身份诊断的明确模型/总硬限/唯一grant；旧封存材料另列，不设真人/账号/全局规划/发布前置。本轮不真人/Holdout/default替换/合并/部署。
