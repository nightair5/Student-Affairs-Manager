# 当前交付：原答补充信息可见，原批不确定继续封存

2026-10-06。SOURCE_INFORMATION_PRODUCT_DELIVERED_COMPARISON_EVIDENCE_INCOMPLETE。产品代码9c8159bac227e6c4e1fe44cb7e2370bda850d89c已提交并立即普通推送；本次证据提交SHA以最终交付消息为准。首次整份建议准确、用户少修改仍是主线。

**原冻结8身份：2SETTLED、1UNCERTAIN、5NOT_SENT。第三请求进入传输后状态不确定，按许可立即停发、保留锁和HALT。不是8次已完成，不判候选赢家。** 原执行包曾获用户“授权原冻结8次，硬上限US$2.60”；不是授权重发或恢复不确定现场。

## 首次正确率到底知道多少

每臂固定4份，参照single-author/model-assisted/provisional。本批只有SA01两臂有确定原答；其他来源失败/未运行仍在分母。以下整份判断不把保存成功或人工补录当正确。

| 层 | C19：正确/错误/未知 | SingleAuthority：正确/错误/未知 | 含义 |
|---|---|---|---|
| 原始模型首次事实 | 0/0/4 | 1/0/3 | C19 SA01学习证明仅在信息范围、没有活动关系，合法表示仍争议；SingleAuthority SA01逐事实暂定正确 |
| 原冻结人工前首屏 | 0/1/3 | 0/1/3 | C19卡片漏学习证明；SingleAuthority已有属性被冻结编译器拒绝 |
| 前一版同raw、公共属性索引后首屏 | 0/1/3 | 1/0/3 | 原POST_PROGRAM_REPORT保留；C19补充说明当时不可见 |
| 当前同raw、补充信息展示后首屏 | 0/0/4 | 1/0/3 | C19证明文字直接可见，但缺活动归属仍未知；不把争议改成正确 |
| 真人最终处置 | 0/0/4 | 0/0/4 | NOT_OBSERVABLE；工程确认不是人的独立正确裁决 |

不能用已返回1份的“100%”表示整批正确率，也不能把事后程序兼容叫新版模型提高。原冻结和后验报告分开：[冻结判断](single-authority-followup/paid-evidence/FROZEN_ADJUDICATION.json)、[冻结报告](single-authority-followup/paid-evidence/FROZEN_REPORT.json)、[上一程序报告](single-authority-followup/paid-evidence/POST_PROGRAM_REPORT.json)、[本轮展示诊断](single-authority-followup/source-information-followup/DIAGNOSTIC.json)。旧报告/参照原字节不改，结论EVIDENCE_INCOMPLETE_NO_WINNER，不改变原预注册选择规则。

旧真实4份仍首答0正确/3错误/1UNKNOWN，原首屏4错、后验3错1UNKNOWN；旧v11 C17 2/6、C19 1/6、MIXED_PROGRESS及旧12后验4暂定2错/5暂定1渠道争议不改。原raw、Expected、旧分数和冻结保持；Development不是独立Holdout、泛化或真人省时证据。

## 用户具体少改什么

SingleAuthority SA01原答已有“全程在线”“作品讨论”“完成学习后提供学习证明”，但冻结编译器要求它们的依据再复制到事件scopeIds，报SINGLE_AUTHORITY_ATTRIBUTE_EVIDENCE。这是程序生成反向索引的责任，不应迫使用户补录已有事实。

已交付single-authority-attribute-index-1.0.0仅从真实嵌套声明且逐字有据的属性派生事件证据索引，再走原严格编译器。跨对象、假依据、错scope和非法时间owner仍拒绝，新增事实数0。SingleAuthority已有属性无需补字即可确认1个事件及2个时间节点。[原实现与边界](single-authority-followup/IMPLEMENTATION.md)。

本轮定位一个普通页面根因：C19原答已有学习证明信息，公共转换也保存在ignoredContent，但首屏没有展示。新增source-information-preview-1.0.0仅显示已有、当前来源版本逐字有据的信息；未建立活动owner，明确“未关联到具体事项”。学习证明现在首次可见，用户不用为了看见它再补录；没有增加强制点击。已有SingleAuthority活动属性不重复展示，无据/跨来源/过期信息不冒充当前事实。firstSourceInformationDisplayed连版本/来源/依据/审计保存在既有草稿事务，原答和人改分开。没有新生成假设、Prompt、候选或模型请求。[本轮实现](single-authority-followup/source-information-followup/IMPLEMENTATION.md)。

V5权威owners/程序覆盖、活动附属属性、逐事件保留/暂缓/拒绝、共享时间和D27窗口安排沿既有产品链保留。Schema/Prompt/候选和冻结编译器未为这次后验修复改写，不默认Candidate20。原回答、程序转换审计、人工前显示及用户操作分别持久化；正式确认仍ReviewSession→DomainCommitPlan→Repository单事务，CAS不关闭。原截止与个人计划分开，不扩全局计划器。

## 唯一内部入口和最终读回

[打开当前内部入口](http://127.0.0.1:6872/)。普通App / ORDINARY_APP_FIXED_RECORDING / ENGINEERING_REPLAY，代码构建9c8159bac227 / source2531a3ab070f；全新隔离库rco-mainline-01-02-i1-d27-plan-recorded-source-info-final-1006。只载入经过独立核验的01/02原确定录制；页面不发送实时模型请求，POST /api/deepseek为403。旧6871等库不改。

展开“本批真实录制 · 选择来源与独立读回”→选C19或SingleAuthority SA01→复制该原文到“新事务”→智能拆分→核对一次→“确认信息并保存独立事件”→“本批独立canonical读回”。普通用户不填ID/scope/ISO；不要把这个固定回放入口当任意通知在线AI。修复后SingleAuthority本例无需事实编辑，正式写入仍由用户确认。

| 最终构建验收 | 结果 |
|---|---|
| 新库初始为空、两份原录制各自普通首次显示 | PASS；C19原答信息可见，但归属争议仍未知，页面PASS不等于整份正确 |
| 检查点失败→保留选择→手动恢复→刷新重开 | PASS；“尚未保存/刷新可能丢失”提示准确，暂缓选择恢复后可继续 |
| 正式事务失败→手动重试 | PASS；失败时只保留先前C19的1事件2时间，没有半份新事实 |
| 已提交、独立读回失败→只重新读回 | PASS；保留commitId、显示“已提交，读回尚未验证”，确认按钮关闭，不盲目重发 |
| 刷新后独立Repository数量/值/依据/owner | PASS；总Task0/Project0/Event2/Time4/Material0，两来源各1事件2时间、两草稿confirmed |
| 页面测量和模型机械关闭 | PASS；2工程报告27trace，原edit/检查点/commit/readback可查，缺失null，GET manifest200/模型POST403，console=[] |

两来源都是“影像叙事工作坊”；开始2026-12-03T13:30/exact，结束normalizedValue=null、rawText“结束时间暂未公布”、precision=vague，各自指向正确事件，原依据保留。SingleAuthority描述含学习证明，C19描述不含但来源补充说明/草稿首次快照含该原文；C19没有自动补owner。总2事件来自两臂不同来源，不是同一来源重复提交。未公布时间不生成确定结束日程。

本次最终6872实际页面与独立值：[浏览器证据](single-authority-followup/source-information-followup/BROWSER_EVIDENCE.md)、[摘要](single-authority-followup/source-information-followup/BROWSER_SUMMARY.json)、[本机证据SHA](single-authority-followup/source-information-followup/EVIDENCE_INDEX.json)。原已提交A—J仅复用未变多活动/共享/窗口/坏owner等路径；不冒充未取得的SA02—04新模型验收。6871旧证据保留，不冒充新构建。

无字段补录，不制造事实纠正。SingleAuthority故障/恢复选择留两个editId/检查点与一个正式commit及readback，最终语义纠正0；刷新时钟断点使主动编辑/阅读/等待/墙钟等null并注明缺失，不能算0。C19无editId、主动编辑0，墙钟59282ms、阅读59248ms、等待34ms，仅工程记录。重试没有重复正式commit或计入事实纠正。[当前测量](single-authority-followup/source-information-followup/MEASUREMENT_SUMMARY.json)。无同口径旧路径实测，不报省时百分比。measurement3.2/low-edit-v2不改，四真人指标NOT_OBSERVABLE。

## 发送、费用和封存

[执行摘要](single-authority-followup/paid-evidence/EXECUTION_SUMMARY.json)：1grant/3reserve/2settle；3传输入口、0重试/repair/verifier。01/02HTTP200及原样raw/usage/结算确定。03在TRANSPORT_ENTER之后STOP_UNCERTAIN，OTHER_FAILURE，无raw/usage/settle；是否送达和计费未知，不能以无raw判没发送。04—08未发送。锁/HALT/16现场文件封存，产品回放和报告后所有字节原样，[只读核验](single-authority-followup/paid-evidence/FINAL_READ_ONLY_SCENE.json)。原公开封存批也未动。

两份确定usage输入9405/输出2207/合计11612；内部峰时保守结算US$0.005471，实扣NOT_OBSERVABLE。第三请求保留单元上界US$0.324404的reserve，没有伪造settle；这不是实际消费。官方核价全批最坏上界2.595232≤授权2.60，不用字节估token。[官方价格](https://api-docs.deepseek.com/quick_start/pricing/)原取证SHA在本机授权文件。后验工程新模型/grant/reserve/settle均0，账本只读；整个本包包含此前授权的真实追加，不能称全包0调用。

原冻结182组件/5产物/8请求、c780eb生成快照、Manifest b3f49a424ccd7b3c740c4009f30d1708e3bf4b5399ded3c0a4c768a0c65c9b29、identity1651fe39ada86fbcecb298b93c72574f2b4401956f4124be0b3dc79a5b3f8459未改。现在产品组件已更新，旧付费gate检测漂移并拒绝；没有放宽gate或将新代码伪装原批，专用读取器只验证原Git blob并读取两份SETTLED，无发送/恢复API。

## 验证、资产和下一步

本轮10定向Vitest、4匿名只读Node、9当前产品独立组和24当前安全记录（含carrier构建）全部确定退出PASS；lint0error/8旧warning、build和security:scan PASS。无新相关失败。全量旧6历史FAIL及audit5H2M/production0明确复用，不重跑无关矩阵、不称全绿；未弱化断言或排除套件。[当前验证](single-authority-followup/source-information-followup/VALIDATION.md)、[上一全量验证](single-authority-followup/VALIDATION.md)。

84保护/119冻结/7归档PASS；权威链1015行、最近6条为前一授权批合法追加，1009原字节前缀及996/1000保持，SHA25f32a95eb28a264c3bec20500cf0b439ab33ad445dddfe8eba243c469c948d9。本轮前后账本未变、模型/grant/reserve/settle0；[16封存文件只读核验](single-authority-followup/source-information-followup/READ_ONLY_SCENE.json)。授权/原件/raw/数据库留本机.data不进Git。用户未跟踪CODEX_DESKTOP_HANDOVER.md及15审计文件保留，不碰旧用户库/Secret/依赖/v8/冻结/锁/断言。代码可用独立revert回退，已结算和不确定请求不能借代码回退当未发生。

下一最少材料是**原ordinal3的请求特定送达/响应/usage证据，或可靠未送达证据**。无该证据不循环查供应商、不重发、不解锁、不补settle、不建替代批。证据一致后再判断是否确需具体恢复授权；现有US$2.60不是额外请求/重试许可。可继续有证据的本地产品修复，不用供应商支线阻挡全部进展。

未测：整批候选胜负及剩余来源首次质量、第三请求实扣、独立人工真值/泛化、真人、复杂全局安排、默认采用和发布。本包不真人/Holdout/default替换/合并/部署。[短交接](../CURRENT_CONTEXT.md)、[路线](../../governance/PROJECT_EXECUTION_ROADMAP.md)、[接续执行](../../governance/NEXT_STAGE_EXECUTION_PROMPT.md)。
