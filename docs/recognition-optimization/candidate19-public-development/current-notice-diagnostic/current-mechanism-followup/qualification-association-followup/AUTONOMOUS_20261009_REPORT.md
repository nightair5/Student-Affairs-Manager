# 2026-10-09：条件字段生成验证与有据事实展示收口

本轮实际执行，而非只交计划。开始2026-10-09T01:25:42Z，用户预授权共享最多16请求/US$6/3小时/3轮；用了8次，全部SETTLED，0新UNCERTAIN，零retry/repair/verifier。没有默认替换、真人、Holdout、合并或部署。真实授权原件只保存在本机.data，不伪造逐批授权回复。

## 用户现在少改什么

两份不同的匿名通知，旧V7分别生成3、4张事项，新条件字段机制分别生成2、2张：设备编号/联系方式/接收单位、年级/器材型号归回对应登记或报名的要求，独立领取借用卡和准备相机仍是事项。原答已有的“录取尚未通知”、确认邮件办结和报名活动关联，不再因重复索引未写齐而整份拒绝。局部真实错误仍阻断受影响事项，正确活动可单独接受。

这是一次有收益也有退步的小Development验证。借用卡通知仍把领取办理时刻写成deadline，新机制还声明有材料却不给材料实体；这两项没有被程序猜补。官方通知中的组合对象/活动名称仍可能被逐字规则降成待核对，尚未达到用户放入任意通知就可直接接受的目标。

## 真实输出、冻结结果与后程序结果

逐份依据见[事实裁决](task-requirements-comparison/observed/FACT_ADJUDICATION.json)、[原答事实](task-requirements-comparison/observed/MODEL_OBSERVATIONS.json)、[转换前后](task-requirements-comparison/observed/PRODUCT_DIAGNOSTIC.json)。原HTTP字节留本机，公开记录绑定request/response SHA。原参考在输出前冻结，旧参考/Expected/历史成绩不改。

| 证据层 | 暂定整份正确 | 确定错误 | 未知 | 分母 |
|---|---:|---:|---:|---:|
| 本次4官方节选V7原答事实 | 0 | 2 | 2 | 4 |
| 同4份新公共程序首份建议数据 | 0 | 4 | 0 | 4 |
| 2匿名来源V7原答事实 | 0 | 2 | 0 | 2 |
| 同2来源条件字段机制原答事实 | 1 | 1 | 0 | 2 |
| 原冻结公共程序V7首份数据 | 0 | 2 | 0 | 2 |
| 原冻结公共程序条件字段首份数据 | 0 | 2 | 0 | 2 |
| 后程序V7同raw首份数据 | 0 | 2 | 0 | 2 |
| 后程序条件字段同raw首份数据 | 1 | 1 | 0 | 2 |

原答中的两份表示/归属争议保持UNKNOWN；首份数据把明确动作或事件变成泛称的事实损失可以独立判不完整，不把它倒推成模型事实错误。“解码4/4”或“8/8可组装”均不是整份正确率。首份数据来自真实普通产品函数，**本轮未获得浏览器点击证据**。

新机制原答及后程序首份各1/2暂定完整，旧V7为0/2；这不是独立真值或总体50%准确率。仅2个作者匿名来源，同源两臂共4回答，不是4个独立来源。single-author/model-assisted/provisional；REQ-02标题、自由描述和条件字段逐句对原文暂定核验，教学泄漏未独立裁决。官方4来源另为已冻结公开节选Development，不能拼成6来源的候选胜率。

结论按预注册为**MIXED_PROGRESS**：字段拆卡减少、REQ-02事实完整；REQ-01两个任务均出现材料覆盖冲突，较V7只一个覆盖冲突扩大了用户阻碍。原冻结首份两臂均0/2，后程序收益不能重写为原冻结比较收益。没有选择默认赢家，不能归因于Prompt单项；输入结构/生成说明作为一包改变。

| 来源 | 已证实改善 | 仍错或未知 |
|---|---|---|
| 官方FRESH-02 | 两项事实和日期窗口保留，渠道错引用仅局部风险 | 组合对象“账号和系统”和渠道引文范围未决；激活项仍泛称，首份不完整 |
| 官方FRESH-04 | 核心登记及日期可显示，真实组合渠道不伪装确定 | 字段与同登记条件拆成3独立卡；日前日终边界未决 |
| 官方FRESH-05 | 报名/设备/起止/形式等原有事实保留 | 组合活动名被降“待核对事件”；关联/表示争议仍在，不猜修 |
| 官方FRESH-06 | 讲座、起止、地点及附属信息恢复，事件可独立保存 | 报名对象取结构标题“活动信息”，任务仍受阻 |
| REQ-01借用登记，两臂 | 新机制3→2项，字段归登记，领取动作不丢 | 两臂领取time均task_deadline；新机制materials空而coverage present，不能计正确 |
| REQ-02工作坊，两臂 | 新机制4→2项；正确活动、二维码、回执、录取未知、相机owner保留 | V7字段子项依赖报名完成，时序倒置，且material present无实体；新机制未知资格的相机仍不能直接执行 |

子项数量本身不是无据义务的证明；REQ-02旧臂的错误依据包括反向办理依赖和覆盖矛盾。新机制的unknown录取有明确原文依据，是正确表示，不因null/unknown自动判整份未知。

## 两类发生层与版本

1. **原答真实主事实/附属要求与反向索引不一致，公共程序误阻断。** 初次局部渠道1.0.0/关系1.1.0保留同来源局部风险；实际新raw后，公共context1.4.0只从实际owner的逐字办结标准或明确unknown factScope派生遗漏依据；requirement owner projection1.1.0仅移除该owner的重复information主索引；relation1.2.0仅在已有task.eventLinks、同对象/活动和真实引用写明动作时派生活动反向依据。假owner、假scope、跨对象、错时间、缺事实、无据关系继续阻断。原回答和审计原件保留，inferredFacts=0。
2. **生成把同一办理的字段要求拆成事项。** 一个可反驳假设：显式requirements.ownerTaskId可减少字段卡且保留独立领取/准备。候选task-requirements-generation-1.0.0、prompt recognition-task-requirements-1.0.0、wire1.0.0在输出前冻结。旧V7输入原字节不变，未再造另候选。真实结果支持字段归属改善，但暴露time角色和material coverage缺口；没有用更多调用掩盖。

代码接现有Schema→公共转换→普通App→ReviewSession→DomainCommitPlan→Repository，Workspace v8未升级，默认候选未替换，原截止与个人计划仍分开。原答/程序审计/首份数据/用户改变分别留存。只有公共同raw修复的部分属于工程证据，不称模型生成能力提高。

## 正式保存、恢复及安排的工程证据

[保存回放](task-requirements-comparison/observed/PERSISTENCE_REPLAY.json)使用全新MemoryWorkspaceRecordStore和真实Capture/ReviewSession/DomainCommitPlan/Repository函数；**不是浏览器IndexedDB点击、真人试次或刷新验收**。八份原答/首份数据分别持久化，来源使用原referenceTime及可逆scope映射，无字段修改、不造editId。

REQ-02新机制：先确认事件，再工程明确接受可选报名，独立读回Task1/Event1/TimePoint4/Material0/Project0；4时间含1个D27个人planned_start。录取unknown的相机待办仍待核对，不能把未保存材料称遗漏读回。活动2026-11-25T14:00至16:00、报名2026-11-22T18:00截止不变；个人安排2026-11-20 09:00至09:30只为明确工程设置，不是模型耗时预测或真人操作。

正式事务在写入前注入失败后没有半份事实，手动同计划重试成功；提交后读回失败只重新读，commitIds不增加；检查点失败后选择值手动恢复，版本和选择一致，无字段编辑不造editId。旧V7活动和官方讲座也可部分保存，错误事项不被一起接受。另实例内存Repository加载证明独立读回，不冒充浏览器刷新。

measurement3.2/low-edit-v2不改；当前页面操作时间未采集，缺失不补0。四项真人指标NOT_OBSERVABLE，未造参与者、同意、裁决或时间。

## 浏览器阻碍与当前入口

官方Computer Use原始拒绝：

> Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy. Stop your work and send a final message noting why Computer Use ended.

已停止该工具，不用CDP/Playwright/SendKeys等替代绕过。继续独立代码/模型工作不算继续Computer Use。本轮普通页面实际点击、页面刷新和IndexedDB独立回读均**NOT_RUN**；旧6913页面证据不能充当这次验收。

最终内部入口[6915固定录制](http://127.0.0.1:6915/)，由最终产品提交构建、回环绑定、全新隔离DB实例requirements-paid-1009-v2；4配对真实raw+4官方真实raw与5工程控制分开标识。模型派发机械关闭。构建/HTTP/POST403检查和Manifest见最终现场，不将“服务器打开”称点击通过，不是任意通知实时AI。HTTP核验发现只读scene.units未被旧manifest读取，误报batchComplete=false；已修元数据读同一确定状态，历史控制明确4份，数据库初始化与实际是否打开分开，不用HTTP200声称数据库已创建。

## 调用、费用及旧封存

[执行摘要](task-requirements-comparison/observed/EXECUTION_SUMMARY.json)。原4批在用户本轮明确允许、证明全4发送前NOT_SENT且无reserve的范围下，复用唯一原grant/$1.30完成4SETTLED。修复Git TLS前置核验和严格Git对象定位，普通push使用进程级代理/OpenSSL并保持证书验证；不改全局配置。无不确定单元重发。

独立新批V7-TASK-REQUIREMENTS-DEVELOPMENT-20261009-R1：2来源×2臂4身份，AB/BA，唯一新grant，4reserve4settle，硬限$1.30。Manifest edb66b77e749514a2b5ef531efa5d2df10797c476fb7d306e4b40af6d3bcb72c；identity bb0825a4d8247a7a08350dc5f41c0baccd48c24e1281bc94bf9713c0d222bfda；请求冻结snapshot d31aafc9、执行同步HEAD a11bd4eb。原AUTH引用本轮真实授权，不伪造逐批回复。

共8实际请求，8确定结算/0不确定/0付费重试/repair/verifier，输入44924、输出22452、合计67376 token。按真实usage使用峰时非缓存价内部保守结算上界**US$0.040424**；供应商实际扣费NOT_OBSERVABLE。两批最坏费用分配合计US$2.60，未超共享US$6及16次数；不是还可支用的另一轮许可。官方上下文/8192输出上界核价，不用请求字节冒充token。

旧真正UNCERTAIN封存、raw/锁/HALT/Expected/原分数保持；没有特定供应商材料不循环等待。不恢复旧公开批、单权威批、义务批或下午不确定单元，不补settle/解锁/换身份重发。当前产品组件变更后的原付费gate会检测漂移，不能用只读reader代替派发gate。

## 验证与保护

[确定退出汇总](task-requirements-comparison/observed/VALIDATION_SUMMARY.json)。定向最终26测试通过，初始34产品及10执行器安全反例通过；这些是工程覆盖，不是模型准确率。lint0错误/8旧警告、typecheck/build通过。全量42独立组全部退出，36PASS/6既有历史FAIL，整体exit1：D19/D17账本快照、D9脚本哈希、RCO-5-007 package-lock哈希、C11 AGENTS保护及gateway、D17历史。保留原断言，不排套件、不加全局timeout凑绿。

开发依赖audit现状2critical/6high/1moderate，production0；旧5H2M不是当前状态。未新增/升级依赖；不是发布完成。最终security和只读保护另核。历史84保护/119冻结/7归档通过，74用户/封存资产逐字SHA保持，handover仍未跟踪、15审计原件保留。

账本1065行，SHA f648795b2037014e78a6fa3b45dae532230c12d9911992ef3eb996b2c06c06a7；原1048前缀c234a07e74bd1ed324e99e7915928daf11e982235c40d1dd52e3d7c772ebc9a9保持，仅本轮17条合法追加（8reserve8settle1新grant），原grant不重复创建。旧996/1000/1009/1015等前缀保留。旧v11 C17 2/6、C19 1/6 MIXED_PROGRESS及12后验不变。

## 下一步实际主线

先用这8份现成raw收口办理时间与截止的类型区分、材料覆盖的真实owner一致性，以及有据组合名称被首份降泛称的问题；按发生层修，不把这些全部叫模型错误。生成的字段归属假设已有小样本收益，可保留为开发候选；需要新输出才能验证输入改动时另按新工作包授权，不复用本轮剩余预算。优先恢复官方Computer Use可可靠识别URL后完成同构建实际页面验收；这个工具阻碍不要求重建保存系统或全局计划器。

本轮结果是产品代码/真实输出/离线保存已交付、实际浏览器未验收、全量历史失败仍在。[最终只读现场](task-requirements-comparison/observed/FINAL_READ_ONLY_SCENE.json)绑定产品提交/同期upstream及live remote、74资产、原1048前缀、两批确定现场及最终HTTP Manifest。报告证据提交随后普通推送，不修改产品构建。不能宣称所有门槛全绿。
