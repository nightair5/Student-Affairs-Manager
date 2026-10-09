# 真实录制驱动的首次数据损失修复

2026-10-09；单臂4官方公开节选，Development、single-author/model-assisted/provisional。请求与参照在输出前冻结，FactRoleAuthority输入及Schema没有改变。这里的修复是公共产品程序，不是新的模型候选或泛化成绩。

两项发生层均追过原文 → 原始响应 → 真实Schema/公共转换 → 普通首次数据 → Capture → ReviewSession → DomainCommitPlan → Repository。

1. RN-01纸质材料提交动作26字、RN-02登录动作42字/业务期选择23字，被wire完整原文直接投影为普通actionVerb（上限20），Capture抛INVALID_RECOGNITION_RESULT。grounded-first-suggestion-1.6.0只对超限且同事项原文完整支持的动作拆出已有动词；对象、完整引用、原回答与before/after审计保留，不截断原文、不发现新义务。URL在冒号处被scope分割时，仅允许从声明scope起、同proposition唯一相邻片段连续覆盖。未知动词、错对象、否定或混入第二动作仍局部requiresDecision阻断，不能靠手动勾选绕过；其他事项继续留草稿。旧短动作不改。
2. RN-04原答已有“厦门大学信息门户升级维护”及2026-04-14 00:00—03:00，程序却要求名称为连续原文、结束时间字面重复日期，变成待核对事件/null结束。source-compound-name-support-1.1.0仅接受同一原文“对实体（URL）进行明确操作”的封闭名称等价；唯一连续引用可拼回URL，跨对象、条件、否定、矛盾不适用。已有唯一event owner的同一带日期钟点范围可无损展开其已声明端点；错日期/类型/时刻、多范围、无据跨午夜及缺端点不补。旧日期范围与分行日期/钟点规则保留。

RN-01/RN-02现在都能生成有效普通草稿，渠道、适用状态及复杂窗口风险继续单独受阻。RN-04工程内存普通Repository正式确认后Task0/Project0/Event1/TimePoint2；名称和无法访问说明保留，起止均exact、不需猜日期。事务失败没有半份事实，用户主动重试原计划可成功；提交后读回故障只重读，没有第二个commit。无字段编辑的选择检查点不制造editId。

原raw-01…04.json为确定SETTLED原字节副本，授权/核价原件留本机.data。原答、投影审计、首次数据及用户修正分开。Workspace v8、默认候选、D27原截止/个人计划、旧冻结与锁均未改。旧8录制的普通首次RecognitionResult逐份deepEqual。

最终29新定向反例及相关6组共77检查通过；lint/build通过。权威全量42独立组36PASS/6旧历史FAIL；最后否定守卫的小修另跑受影响6组、lint/build，不重复无关历史。旧成绩不改。

浏览器点击/刷新/真实IndexedDB NOT_RUN_POLICY_STOP：官方Computer Use无法可靠识别当前Windows URL。内存验证不是点击证据；保留原错误，不换自动化通道绕过。尚未证明真实用户少用时、任意实时AI、独立Holdout或发布资格。
