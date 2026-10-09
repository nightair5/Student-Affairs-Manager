# 2026-10-09：首屏局部风险及条件字段机制

本轮依据用户3小时、合计16请求/US$6预授权执行，真实授权原件只在本机.data。先条件性接续原4个发送前身份，现已4SETTLED；原grant、原AUTH、原身份和raw不改，真正UNCERTAIN旧批不动。

## 发生层与可运行修改

1. 原FRESH02/04的channel声明引用不满足逐字/归属要求；FRESH06的task-event依据漏入任务主声明，使整个来源拒绝。公共`role-local-channel-evidence-1.0.0`及`obligation-local-relation-1.1.0`仅对存在于同来源的依据不匹配建立局部风险：保留原声明和审计，不猜渠道或关系，阻止接受受影响任务，其余事实继续显示。假scope/假实体仍拒绝。严格模式保持原拒绝行为。
2. FRESH06原答已经把参与/午餐属性嵌套在实际event下，只是未重复进event.scopeIds。`authority-support-context-1.3.0`接受实际主实体的有据嵌套属性，后续既有索引阶段派生反向依据；不会凭source scope生成活动。

原四份1/4可解码变为4/4。可解码不是整份正确，渠道、对象、关系风险未被清除。原语义未知与合法组合表示争议单列，不把引用错误直接叫事实错误。

## 一个生成假设

FRESH04实际raw将同一登记的条件下字段和提醒拆成三个登记待办。新增wire契约`task-requirements-source-contract-1.0.0`：独立完成动作在tasks；条件字段/格式/办结要求在显式ownerTaskId的requirements。程序只将实际逐字要求派生为对应task详情/完成标准，条件不扩成整个task资格。领取、缴费、设备准备不得吞入requirements。

候选`task-requirements-generation-1.0.0`、Prompt`recognition-task-requirements-1.0.0`，V7原Prompt/Schema/请求不改；Workspace v8不升。新契约接已有普通App→ReviewSession→DomainCommitPlan→Repository，原响应/程序审计/首次建议/用户修改分开。原截止与D27个人安排分开。

只计划2作者匿名Development来源×当前V7/条件字段两臂4请求、AB/BA；同公共转换、参照和首屏规则。含核心登记/领取及可选报名/录取后设备的反吞并控制。参照single-author/model-assisted/provisional，不是Holdout或官方通知；在新输出之前固定。具体身份及新grant须在此代码提交推送及冻结后依据实际用户预授权绑定，不伪造逐批回复。

## 已验证与限制

真实Schema/转换/规范化保存读回：34定向测试通过；覆盖fake owner/跨来源、错误时间/关系、未知资格、独立领取、共用窗口和条件字段。复用执行器10定向离线安全测试通过。lint0错误/8旧警告；类型检查/build通过；全量42组36PASS/6旧历史FAIL，全部确定退出，不改旧断言凑绿。security及84/119/7历史保护通过。

6914全新隔离回放工程构建成功、模型路由关闭。**实际浏览器点击NOT_RUN**：官方Computer Use返回“could not determine the current browser URL on Windows with enough confidence to enforce policy”，已停止该工具，不换方式绕过拒绝。旧6913证据不是这次产品证据；保存读回测试也不冒充浏览器。

下一步仅验证上述一个生成假设，按真实输出审查，不能把工程夹具、4/4解码或用户删除重复任务算首次模型正确。最终事实诊断/费用/现场另链接回唯一RESULTS。
