# 真实公开通知：共享提交地点修复，当前C19新来源效果待测

2026-10-04。停止状态：C19_PUBLIC_NOTICE_ENGINEERING_DELIVERED_WAITING_SINGLE_ARM_AUTHORIZATION。本轮没有新模型、grant、reserve、settle或账本写入，没有改候选或默认。当前唯一内部入口 http://127.0.0.1:6836/。

## 实际交付

一个公共转换根因：原文“将学生申请材料及学院回执扫描版（须加盖公章）和Excel汇总表发送至…”明确给三种同任务材料一个目的地。1.2.0只认单对象，前两种被清空、任务被误阻断；1.3.0识别有界、同owner的完整并列对象，三种原答已有地点均保留，新增事实0。不是从原文替模型补漏，不是新Prompt收益。[逐层证据](ROOT_CAUSE.json)、[实现](IMPLEMENTATION.md)。

普通App首屏显示三种渠道，仍保留PDF、命名、加盖公章、Excel及截止；有意向的个人资格unknown仍待核对，没有无据改true。该工程来源未正式确认，未冒称整份模型正确。另一真实暂停摘录走同一App、DomainCommitPlan和Repository保存：0Task/0Project/1Event/2Time，开始2026-05-09T15:00、结束2026-05-11T08:30。未造平行保存链。

## 材料与分母

四份独立官网通知的操作摘录：图书馆查收服务暂停、国际交流申请材料、博士中期考核、电子论文提交取消。出处/发布时间/原文SHA/匿名SHA/摘录边界见[PROVENANCE](PROVENANCE.json)。原HTML、原联系人映射留忽略的.data，提交版邮箱example.invalid。不是全文识别评价、真人或独立Holdout。[与26份旧来源及真实生成说明的重合检查](OVERLAP_CHECK.json)只证明词面不重复，不能证明统计独立。

| 证据层 | 正确/错误/未知 | 能说明什么 |
|---|---|---|
| 四份新公开摘录的模型首答 | 0已判正确/0已判错误/4 NOT_RUN | 正确率未测，不能写0%或100%。 |
| 四份新公开摘录的模型首次展示 | 0已判正确/0已判错误/4 NOT_RUN | 两个合法工程wire只能证明转换和页面，不能替代模型输出。 |
| 原12冻结v11 | C17 2/6，C19 1/6；MIXED_PROGRESS | 原结果不动。 |
| 原12后验事实 | C17 4暂定/2事实错，C19 5暂定/1渠道争议 | single-author/model-assisted/provisional；不是新模型效果，标题/自由描述未裁决。 |

[全部12新诊断](OLD_12_DIAGNOSTIC.json)：原回答SHA、首次展示事实SHA与资格修复交付逐份相等；S05“平台”仍为原模型推测、正式渠道null，完成标准/PDF/命名/截止/事件未删。没有当前C19生成错误足以支持改Prompt，不造Candidate20或无意义双臂。

## 页面与保存

[浏览器证据](BROWSER_EVIDENCE.md)、[canonical及测量检查](browser/CHECK.json)。两个公开工程来源、三个原C19录制控制共5来源：最终3Task/0Project/1Material/4Event/9Time，3confirmed/1partial/1needs_review。两处模糊/未公布时间null；递交任务真实依赖填写任务、前置todo，资格未知领取项未保存。正式失败零增量→关闭重开手动恢复；已提交读回失败→仅重读、数量不增加；刷新后事实相等。关联风险仍局部受阻。

用户做法：选择下方匿名来源，将上方原文复制到首页“快速粘贴通知”，点“智能拆分任务”，核对摘要后确认。渠道正确时不需要重新输入三个地点；未知个人资格仍要由用户核对。本例没有同口径旧页面点击测量，不估算省时比例。

四次正式commit/readback、0字段edit；失败与等待保留。5份工程计时中2份区间完整、主动编辑0，3份缺失/未闭合；部分终态按canonical单列，旧计量布尔不改。人工首次/最终正确、低修改收益及真人时间均NOT_OBSERVABLE，不把保存成功算语义正确或真人省时。

## 验证与下一步

[VALIDATION](VALIDATION.md)：50定向产品反例及4冻结/分母Node检查通过；lint0错误/8旧警告、build、security通过。全量40组34PASS/6旧历史FAIL，当前产品1040PASS/1skip；6旧失败、audit5H2M开发工具链/production0单列。84保护/119冻结/7归档及原12身份/raw/成绩保持，996行完整账本SHA前后同为c58231633b8da1b87e9106f92d0dd457f00e4789e5e5fa03de780fb377dc8750。

需要新输出来回答“当前C19对陌生实际通知究竟错什么”，只准备这四份C19单臂诊断，复用既有安全执行器；不是相对提升比较。冻结和具体新授权见[BUDGET_AND_AUTHORIZATION](BUDGET_AND_AUTHORIZATION.md)。未有新授权不得付费。真人、Holdout、默认替换、合并和部署均未做。
