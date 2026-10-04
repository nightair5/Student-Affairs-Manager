# 当前结果：2次实际回答已封存，首次展示修复已交付

2026-10-04。批次`C19-C17-C19-DEVELOPMENT-R1`。**12个计划请求中，2个已发送并结算、10个未发送、0个发送状态不确定；比较未完成，不能判赢家或报告两臂整批首次正确率。** 本地产品修复已交付，付费现场保留锁。原许可已用于本批唯一grant，不能重新prepare、建第二grant或另扩样本。

## 真正发生了什么

用户明确授权本批12个deepseek-flash身份和US$3.90硬上限。第一次发送前重新核官方价格、身份、完整账本链、已提交并推送HEAD。ordinal1/2分别得到C17/C19的同一来源S01回答并settle。ordinal3在**reserve/send之前**查询Git远端时发生Windows schannel TLS握手失败。执行器按冻结协议保留跨进程锁；没有第3次reserve或模型发送。随后远端已恢复、只读对账CONSISTENT，但不能把恢复网络等同于获准删除锁。

[完整现场报告](paid-evidence/EXECUTION_REPORT.json)、[实际计数](paid-evidence/BATCH_STATUS.json)、[原始错误与代码位置](paid-evidence/EXECUTION_FAILURE.json)。完整报告的评分summary是未通过完整性门的占位输出，不代表已经发送的两份是NOT_RUN；发送状态以units/scene和BATCH_STATUS为准。固定分母仍每臂6、合计12；ZERO_CALL_REPORT是**之前冻结准备时的历史零调用快照**，保持原字节，不能作为当前调用计数。

## 一份实际来源能看出的改善与问题

原文：校园失物查询网站将在周日晚间暂停查询。此前登记的信息保持不变，不需要重新登记，也不要发送补充邮件。

| 层 | C17实际回答 | C19实际回答及修复 |
|---|---|---|
| 原回答 | tasks/events/timePoints均空，把全文作为information；遗漏独立事件和时间 | 有暂停查询事件及周日晚间/null/vague时间；另有两条polarity=negative动作记录 |
| 冻结编译/首次展示 | 无事件、无时间，程序不补猜 | 否定动作仍被投影为两条未选中且受阻的待办，用户需要额外核对；不是原答要求用户发邮件 |
| 原冻结v11的局部诊断 | 此1份整份不正确：EVENT_MISSING、INDEPENDENT_TIME_WRONG | 此1份整份不正确：任务presence FP2、相关信息覆盖缺失；存在表示/转换影响，不能都称模型事实错 |
| 比较后产品转换1.0.1 | 仍不替原答补遗漏事件 | 将同片段有明确禁止/无需依据、无关联且状态一致的否定动作保留为信息；首次页0任务1事件1未知时间，无需用户拒绝两条多余待办 |

这里只观察到**1/6来源、1个配对**，两个局部冻结诊断均0/1，不作为整批0%或C19赢家结论。标题/自由描述/教学例泄漏与人工语义裁决仍NOT_ADJUDICATED。新转换是看到录制后的版本化工程修复，不回写冻结成绩，不称新版模型首次准确率提高。[原答/冻结转换/局部判错](paid-evidence/PARTIAL_REPLAY_DIAGNOSTIC.json)、[raw01](paid-evidence/raw-01.json)、[raw02](paid-evidence/raw-02.json)。

## 用户少动手的具体变化

新`source-grounded-nonaction-projection-1.0.1`检查动作、对象、同来源同片段依据、否定状态及全部引用。明确的“不要发送”不再作为当前待办；“不要忘记发送”、条件性“不要在审批前发送”、问句、双重否定、错对象、关联端点和共享主片段保留阻断。已有材料、依赖、精确截止及事件关系不变；没有自动补主实体或猜时间。原raw、冻结semantic、冻结首屏、新程序决策审计、人工修改分别保留。

实际接入普通App→ReviewSession→DomainCommitPlan→Repository；没有平行保存链、默认候选替换、新Prompt候选或新付费样本。原D27最小安排继续复用，个人计划不覆盖原文截止。[代码路径与边界](IMPLEMENTATION.md)。

## 实际页面、保存与测量

唯一推荐内部入口以[BROWSER_EVIDENCE](BROWSER_EVIDENCE.md)最终构建为准：新回环端口与全新隔离库，只有本批2份真实固定录制，实时派发0。C19无需人工填事件即可首屏0任务1事件；正式读回Task0/Project0/Event1/TimePoint1，周日晚间normalizedValue=null、precision=vague、needsConfirmation=true。正式保存失败未留下半份事实；提交后读回失败保留commit并阻止重提，关闭弹层后只重新读回；刷新数量和关键值一致。

真实页面测量保留commit→独立readback、失败记录、0人工纠正和0主动编辑。至少10秒只读实测；墙钟含自动化/工具等待，不能据此称真人省时。旧中途刷新场景缺失null保留；没有editId就不制造纠正。首次语义正确与最终语义正确未裁决，低修改正确处置不可观察。四项真人指标全部NOT_OBSERVABLE。

## 费用、保护和结论边界

峰时/全缓存未命中/full-context保守预算US$3.892848，硬上限US$3.90。已收到真实usage：input8940、output1507、total10447、cached input3840、reasoning0。内部按实际usage和保守单价结算US$0.004491；供应商实扣NOT_OBSERVABLE。1grant/2reserve/2settle；账本971→976，仅5条合法追加；工程阶段没有追加。[核价/结算](BUDGET_AND_AUTHORIZATION.md)。

历史保护84、冻结119、归档7通过；本批Manifest与12身份SHA不变。原D26 145组件/7产物/16请求及raw保留，D17原1/12、2/12及MIXED_PROGRESS不动；D26原0/8、8拒绝及EVIDENCE_INCOMPLETE不动。新组件另文件，不动原候选/原冻结。授权原件、价格绑定、Secret和真实映射不进Git。

[验证](VALIDATION.md)区分当前产品通过与全量6个历史失败；audit开发工具链5high/2moderate仍在，production-only0。提交后立即普通推送，最终本地/upstream/远端SHA现场核验；运行构建与后续文档HEAD分别报告。

## 最少剩余动作

本批比较被执行锁封存，不是缺新的12次授权，也不是预算超限。**只缺一次具体的安全恢复授权**：允许对第3单元发送前Git核验遗留锁进行有证据的恢复，保留唯一原grant、原12身份与US$3.90总上限，只续原10个未发送身份，前2个绝不重发。先制作版本化恢复绑定和离线故障证明；只读证明任何未决发送均不释放，核价/HEAD/链/身份一致才恢复。原AUTHORIZATION不得覆盖，不能直接删锁后dispatch。[下一执行](../../governance/NEXT_STAGE_EXECUTION_PROMPT.md)。

本轮状态：`C19_PRODUCT_CONVERSION_DELIVERED_PAID_BATCH_SEALED`。未完成整批模型效果比较；没有真人、Holdout、默认采用、合并或部署。后续继续准确率主线，不重新造执行器、候选编号或空表。
