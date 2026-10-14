# 首次建议：合法渠道保留、禁止与矛盾依据不冒充许可

2026-10-04。**C19_CHANNEL_ROLE_VARIANTS_PRODUCT_DELIVERED_NO_NEW_MODEL_BATCH_NEEDED**。
本轮修公共转换两个已复现根因，未改模型输入、候选、评分或参照，未新增模型身份。模型/grant/reserve/settle/账本写入均0。

## 用户少卡在哪里

1. 原文“器材清单请提交到星槎入口”“请把器材清单交到资料门户”“请通过资料门户提交器材清单并保留回执”有明确同对象目的地，旧规则误判缺依据、阻断任务。现在直接保留渠道，用户无需改字段即可一次确认任务、材料和两个独立事件。目的地不在固定词表也可以通过。
2. 原文“请勿/不能/不可/不应通过资料门户提交器材清单”或同对象同渠道同时肯定与禁止，旧规则可能把该渠道显示成确定许可。现在渠道不成为确定事实，仅阻断关联任务；无关联正确事件仍可单独保存。原模型值、禁止/条件及程序判断留审计，没有删除原答或猜新的目的地。

没有用C17 S01/S02旧漏项再造候选。C19原录制已有事件及模糊/未公布时间，普通页面回归仍完整。原S05“平台”只有办结回执支持，继续渠道null/未确认、PDF/命名/完成标准/截止/说明会保留，不强迫补录。该原答争议不变成满分。

## 发生层与实际修改

| 原文最小事实 | wire | 公共转换旧→新 | 首屏及正式影响 |
|---|---|---|---|
| 同对象明确目的地，包含对象前置、把字句或随后保留回执 | 已有T1/M1及channel、真实同来源scope | 1.0.0遗漏合法语序→1.1.0接受有边界的同对象角色 | 渠道直接显示，原子保存1任务/1材料/2事件/5时间，不产生人工字段editId。 |
| 同对象同目的地禁止/条件，或正反证据冲突 | wire错误地仍给channel | 1.0.0否定范围不足/只找一个肯定→1.1.0关联证据出现禁止或不确定即不确认为目的地 | 相关任务受阻，独立保存2事件/4时间；0任务/0材料/0空项目，部分状态保留。 |

路径：`materialChannelGrounding.ts`的`destinationRole → groundMaterialChannels → assembleCurrentFirstSuggestion`，接现有`App → ReviewSession → buildSourceReviewPlan → commitSourceReview → CanonicalWorkspaceRepository → verifySourceReviewReadback`。新版本 **material-channel-role-grounding-1.1.0**；审计新增`roleChecks`记录原文/对象/肯定或不确定。未修改candidateVersion/promptVersion、Schema v8、旧v11、DomainCommitPlan或保存底座。

规则仍是有限保守语法，不宣称任意表达均已覆盖。只允许原答已有值和真实owner/原文支持，不补模型漏掉的实体。跨来源、错对象、对象后缀、假owner/时间图冲突沿既有公共保护阻断。双重否定、条件和疑问不直接推导许可；无关渠道的禁止不抹掉明确合法目的地。更细的矛盾提示文案及未见表达属于剩余体验/覆盖边界，不是已证明模型错误。

## 工程证据与模型成绩分开

[修前12反例](BEFORE_VARIANTS.json)和[修后相同12反例](AFTER_VARIANTS.json)：**渠道角色判定3/12→12/12**。修前4种合法表达误阻断、4种否定误放行、1个矛盾误放行；3个控制本已符合。这是single-author/model-assisted/provisional匿名工程字段检查，**不是首次整份正确率、未见模型输出或独立真值**。生成前后fixture wire SHA一致；不同原文顺序另有真实Schema/公共转换/正式保存不变性测试。

[全部12原录制新转换](ALL_12_DIAGNOSTIC.json)双臂同口径、原wire及原分数保留：

| 口径 | C17 | C19 | 解释 |
|---|---|---|---|
| 原冻结v11整份结构化通过 | 2/6（33.3%） | 1/6（16.7%） | MIXED_PROGRESS保持，是原解析/评分边界，不是完整用户输出独立正确率。 |
| 既有后验原事实诊断 | 4暂定/2事实错 | 5暂定/1渠道争议 | POST_HOC provisional，渠道置null不增加原模型分数。 |
| 本轮新模型输出 | 0/0，NOT_RUN | 0/0，NOT_RUN | 没有输入变化、没有必须重付费的假设。 |
| 首次展示整份独立正确 | NOT_OBSERVABLE | NOT_OBSERVABLE | 标题/自由描述/泄漏NOT_ADJUDICATED；程序兼容和保存成功不等于语义正确。 |

旧12固定分母不变。原S01/S02 C17真漏/错类型仍保留；C19对应原事实保留；S03资格未知与前置等待、S04条件性禁止、S06普通控制不变。没有“后验83.3%是模型新准确率”的结论。

## 可操作入口与最终浏览器

唯一当前内部入口 **http://127.0.0.1:6833/**，全新隔离库`rco-mainline-01-02-i1-d27-plan-recorded-rolefinal1004`。构建 **44cfde802d72 / source 6bcdfd77aa2b**：HEAD是构建时提交起点，source SHA是本轮实际验收源字节；[完整构建及原字节证明](PROTECTION_AND_BUILD_PROOF.json)。固定12份原录制，另12份明确标匿名契约夹具；实时派发机械关闭，旧6831/6825及旧用户库未操作。启动：`node scripts/serve-candidate19-recorded.mjs 6833 rolefinal1004 --channel-role-fixtures`；该实例已存在，重启需新instance与未占用端口，不能覆盖原库。

普通步骤：在底部录制选择区选择来源并复制原文→首页粘贴→智能拆分→看摘要与依据→一次接受；无任务用“确认信息并保存独立事件”；关联风险用“仅保存独立事件；任务仍待核对”。故障注入区只供内部工程验收。

[浏览器证据](BROWSER_EVIDENCE.md)记录5匿名夹具与2份C19录制，7来源实际首屏/正式保存/独立读回；5confirmed、2partially_confirmed。最终 **Task4 / Project0 / Event12 / TimePoint27 / Material4**，**11未知时间null**，rawText、精度、依据及owner完整；刷新正式数组逐字一致。原截止与D27个人计划分开，没有新全局计划器。

正式失败：2任务/6事件/14时间/2材料保持不变，原建议和选择可关闭重开；手动重试后3/8/19/3。提交后读回失败：4/9/22/4已经提交，保留commitId与pending；只“重新读回并核验”后正式数组完全相同、pending消失。无自动重发、半份事实或重复创建。首次错误点击弹层外注入按钮及早读产生过未建立的故障/旧读回，不计验收；正式证据以已确认注入状态和关闭后独立新读回为准。

[页面计量](browser/MEASUREMENT.json)、[逐来源核值](browser/CHECK.json)：7个真实commit/readback、0字段editId、0伪造检查点。4闭合记录阅读均>10秒、主动编辑0；2部分未闭合及1恢复断点时间null/缺失，未补0。两失败成本留trace；既有测量partial布尔false与canonical的2partial分列，没有改历史计算器。四项真人NOT_OBSERVABLE，低修改正确/首次语义正确未裁决。没有真人试用、省时百分比或新在线时延结论。

## 验证、保护与交付边界

[验证](VALIDATION.md)：62定向PASS；全量39组全部确定退出，33PASS/6既有历史FAIL，产品Vitest1014PASS/1既有SKIP。lint0错误/8旧警告、build、security scan通过；audit仍5high/2moderate开发工具链、production-only0，兼容维护另列，不改依赖/锁/旧断言。本轮不能称全量全绿。

84保护/119冻结/7归档、12raw、原Manifest/身份/候选/原评分Git字节保持；完整链996行，前后SHA **c58231633b8da1b87e9106f92d0dd457f00e4789e5e5fa03de780fb377dc8750**。156合法历史追加已定位，非本轮写入；原12SETTLED/0不确定/唯一耗尽grant。package-lock工作区CRLF与Git LF导致字节不同，Git diff无变化；RCO旧冻结哈希失败原样报告，没有改旧断言制造通过。

本轮不需新增许可即可交付此公共修复。下一步只针对**当前C19有证据的首次生成缺口**：优先少量不同来源/对象的匿名实际通知和旧录制诊断；公共程序可复现就直接修。只有确定输入机制必须变化，才固定一个假设、最小两臂新来源及具体费用授权。不默认Candidate20、16/24身份、第三臂或新预算阶段。旧耗尽3.90许可不复用，真人/Holdout/default替换/合并/部署仍未授权。
