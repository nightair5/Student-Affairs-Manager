# 直接接续：原D26首次比较及证据驱动修复

2026-10-03。[执行工程与结果](../recognition-optimization/d26-execution-continuation/RESULTS.md)已交付；真实宿主、只读报告、48项工具回归和同步安全核验已经完成。D27产品复用，不重建准备系统。本文件不授权新模型、账本写、真人或发布。

~~~text
继续“学生事务管家”识别优化独立支线，直接接续原D26冻结首次准确率比较。
工作区 C:/Users/Winner/.codex/worktrees/student-affairs-candidate11/比赛。
分支 codex/e2-candidate11-blind-eval。

目标：查清C18相对C17是否提高人工修改前首次整份建议正确率，
并在同包完成最多3个证据根因的产品修复；复用D27普通核对及最小安排。
不重开全仓审计、不重造执行器/空表/新24身份，不以计划外观证明正确率。

授权本地实现、匿名正反例、旧录制只读诊断、隔离库、实际浏览器、
适用测试和必要文档，Conventional Commit后立即普通推送。
不新增依赖/升级v8/读取Secret明文，不接触旧用户库或改历史冻结。
仅用户另行明确授权本批模型、原16身份、美元硬上限与唯一新grant后才付费。
缺新许可时16NOT_RUN、模型/grant/reserve/settle0、账本只读。
真人、独立Holdout、默认替换、合并、部署仍需各自证据与授权。

一、有限核验，复用已完成工程
核实际HEAD/工作区/upstream/远端，保留用户改动，不回滚历史锚点。
读当前AGENTS/PRD首次识别和确认相关章节、CURRENT_CONTEXT、活动路线，
d26-execution-continuation的RESULTS/IMPLEMENTATION/VALIDATION/授权卡，
原D26 Manifest/身份/预注册；产品受影响时再读D27对应实现/浏览器证据。
不重读全部历史。只读历史保护、账本完整链和原D26快照。
Cloudflare已只读核13相关Worker Builds无Git连接，CI无发布步骤，旧推送阻碍解除。
若发布设置或CI实际发生变化再查，不循环核验未变页面；不得触发部署。

原批 D26-C17-C18-DEVELOPMENT-R1；C17/C18；8已见D25来源×2=16；4AB/4BA。
原快照 4699d5cfdd6211299d9ab82ef7000d99fc8fe8f8。
Manifest SHA c41185c3831d35db610e5a4a563b7471b0bd60d1d92a373edd6a5c10d28f7ac2。
身份SHA 89f33327eabd2ec90f9d383ac922d56b56ca4654cfee0be47aac083eea411e89。
模型deepseek-flash，Responses，temperature0/reasoning.effort none/stream false，
max_output_tokens8192；其余及requestSha依原冻结。
145组件/7产物/16请求保持，活动D27图6文件漂移不改旧Manifest。
现成隔离快照：C:/Users/Winner/.codex/worktrees/student-affairs-d26-frozen/比赛。
若不存在，按原ref恢复managed worktree，不复制活动组件冒充快照。

从主工作区复用：
node scripts/d26-execution-host.mjs --verify --snapshot C:/Users/Winner/.codex/worktrees/student-affairs-d26-frozen/比赛
node scripts/d26-execution-host.mjs --resume-read-only --snapshot C:/Users/Winner/.codex/worktrees/student-affairs-d26-frozen/比赛
node scripts/report-d26-execution.mjs --snapshot C:/Users/Winner/.codex/worktrees/student-affairs-d26-frozen/比赛

二、仅有本批明确许可时直接执行
用户许可须明确原冻结16个deepseek-flash身份、美元硬上限、
允许且只允许一个本批新grant与逐单元reserve/settle。旧许可不得复用。
已交付预算快照US$5.190464/建议上限5.30不是当前许可或永久价格。
第一次grant前重新只读核官方路由、上下文/输出、峰时/缓存/推理与附加费，
权威账本完整链/合法追加、16个identity/request SHA和当前同步HEAD。
用官方上下文与冻结输出限证明费用上界，不用字节估token。
任一漂移、费用超上限或安全状态未知在grant前停止付费。

真实许可原文及AUTHORIZATION/PRICE_EVIDENCE只保存在本机.data，不进Git。
按已交付契约绑定当前已提交/已推送HEAD、原Manifest/身份、模型/参数、
16身份、单元上界/总硬上限及有效核价；只能为该批建一个grant。
不要更改原身份dispatchAuthorized=false；实际许可由独立执行层验证。

复用 --prepare-authorized 与 --dispatch-next，每次严格冻结ordinal：
跨进程锁/状态检查→reserve→发送前持久状态→最多一次send→
原样raw/response SHA/真实usage→settle。零自动重试/repair/verifier/探测。
发送、计费、raw或settle不确定立即封存并停止后续。
usage缺失时保守内部结算单元上界并停发，不猜实际扣费。
不以“没有raw”推断没送达；不要删除锁/孤立文件/状态来启动第二批。
只读续跑用于核现场，不自动继续不确定单元，失败仍保留16分母。

三、完成比较，按实际证据修产品
只有全部16有确定结局且账本/本地状态一致，才调用原快照v10评分。
比较不完整/锁或halt/计费未知时不判赢家；逐单元错误、未知与分母保留。
分列模型首答（经过冻结解析/adapter的边界）、转换后人工前首次展示、
人工最终处置。不能把自动raw契约评分称独立人工原答真值。
每来源列整份正确、任务/无任务、独立事件/信息、时间/材料/条件/关系，
FP/FN、Severe/Forbidden、胜平负/未知、原文和原回答依据。
参照provisional；标题/自由描述/教学例泄漏未经真实裁决NOT_ADJUDICATED。

严格用原选择规则：整份净增且无新增关键风险；目标错减少但未净增；
改善伴退步；无收益；证据不足。不临时加净增2/整体100%或删难例。
关键FN、无据新增、错误时间/关系不被总分抵消。
已见Development不证明泛化、真人省时或发布资格。
候选组件整包含Prompt/wire/转换，不能单靠整包比较归因到Prompt。

只选最多3个高价值根因：原文→原答→程序转换→首次显示→保存/安排。
优先核无任务事件/时间、条件/前置/可开始、时间与实体关系。
区分生成错、公共转换错、参照争议、UI错；不要只堆Prompt提醒。
不能猜事实、全部unknown/转人工、放宽评分制造收益。
修公共确定性问题先复用旧录制离线；改比较组件只能另版本，旧批不动。
仅必须改模型输入才提出后续候选/调用假设及预算，不默认新16/24身份。

新录制接入现有App/ReviewSession/DomainCommitPlan/Repository，
保留原回答/程序转换/用户修改及来源，不建立平行保存链。
实际浏览器在新隔离库验首次展示、必要纠正/确认、原子保存/独立读回，
检查任务/事件/材料/时间与安排影响。旧页面证据不冒充新模型回放。
D27最小安排复用，原截止与个人计划分开；不扩成全局最优计划器。

四、验证、同步与一次交付
针对改动先真实正反例和失败分支，再适用lint/test/build/security/隔离/历史保护。
只改工具时复用已通过工具检查；无新代码/疑点不重复全量产品及旧浏览器矩阵。
产品改动完成受影响路径实际浏览器及正式保存/独立读回。
全量旧4历史哈希失败与audit历史风险如实单列，不改旧锁/断言凑绿。
工程时间不叫真人省时，measurement3.2/low-edit-v2及计划计量分列保留。
四项真人指标缺实际范围、负责人接受、同意及裁决仍NOT_OBSERVABLE。
按清晰边界Conventional Commit后立即普通推送，核最终HEAD/upstream/远端/工作区。
更新现有结果入口、短交接和跟踪索引，不增加新准备阶段。

最终大白话交付：同批首次原答/首次展示的正确率及分母；具体改善/退步/未知；
产品机制哪些有新模型证据、哪些仅工程证明；实际发送/确定/不确定/停发；
真实usage/内部保守结算/实扣可观察性；页面及独立读回；测试新旧失败；
保护/账本和提交远端；最少下一授权或材料。
无新付费许可时明确“16次未运行，已交付执行工程，待本批具体授权”。
若安全未知封存付费现场，继续不相关安全工程；不开展真人/Holdout/默认替换/合并/部署。
~~~
