# 单一权威关系与逐事件处置实现

2026-10-06。原真实4首答仍0正确/3错误/1UNKNOWN；相同raw的后验展示亦0/3/1，分母4。下方原工程及冻结准备记录保留；本批获授权后的状态见本节和paid-evidence/EXECUTION_SUMMARY.json。

## 实际回答驱动的后验程序修复

本批原8身份只取得SA01的两臂确定录制，ordinal3传输不确定即封存，4—8未发送；1grant/3reserve/2settle，无重发。没有整批赢家。原Manifest、身份、请求、参照、V5/C19及两份raw原字节不改。

SA01 SingleAuthority原答已有在线、作品讨论及学习证明三个嵌套属性，各有真实原文scope；冻结编译器却要求这些依据在event.scopeIds再次复制，报SINGLE_AUTHORITY_ATTRIBUTE_EVIDENCE。该要求与单一权威声明及程序生成索引的目的冲突。`singleAuthorityProduct.ts`另版本single-authority-attribute-index-1.0.0，仅从已经嵌套声明且逐字有据的属性派生反向event证据索引，再走原严格编译器与普通保存链。假依据、另一对象主归属、非法时间owner不因扩展索引被放行；没有补原答遗漏的事实。

普通App录制provider接新程序版本，原raw、可逆scope重绑定、转换审计、首次显示及用户处置独立持久化。C19 SA01未附着到活动的学习证明不自动补录；原答表示争议保留UNKNOWN，首屏缺该信息为错误。新程序只是让SingleAuthority已有事实进入首次卡片，不是新模型输出或原冻结成绩改善。

`single-authority-observed-readonly.mjs`是已封存批的只读录制读取器：核原Git blob/182组件、5产物、8身份，核本机授权哈希、ledger前缀/完整链、唯一grant、逐单元receipt/raw/usage及HALT/锁。只暴露SETTLED的01/02；3UNCERTAIN和5NOT_SENT仍在8分母。没有发送、解锁、结算、恢复API。原付费gate仍要求活动组件与旧Manifest一致，代码已变时正确拒绝，未削弱为续发通道。

实际过程6870普通回放：两来源各0Task/0Project/1Event/2Time；学习证明直接在SingleAuthority首次卡片出现，未补字。检查点失败保留选择，手动恢复并刷新仍暂缓；正式事务失败无半份，重试成功后读回失败只重新读取；刷新canonical仍一致。提交构建的最终复验另见PAID_BROWSER_EVIDENCE.md，不以过程替代最终。

## 两个实证根因

| 用户场景 | 发生层和证据 | 最小实现 | 仍不能声称 |
|---|---|---|---|
| 原通知01/04已有实体，但coverage/owner/端点重复声明矛盾导致首屏拒绝 | 原raw和冻结诊断保持；不能任选一侧或补漏 | `src/recognition/sourceContractV5.ts`新增严格V5：时间owners一份权威声明；任务coverage状态独立，实体/片段和端点索引由程序推导；主事实缺失、假引用、错类型、覆盖矛盾仍拒绝 | 旧矛盾raw已修好；新机制已提高模型准确率 |
| 原通知03一个活动拆成4事件，普通页不能逐项拒绝 | 原4事件仍保留为原模型错误；用户纠正不能计首次正确 | 活动attributes保存形式/参与/结果/地点附注；不同活动和独立仪式仍分别表示。普通页新增保留/暂缓/拒绝，走同一ReviewSession→DomainCommitPlan→Repository | 程序自动合并旧4事件为正确首答 |

V5另版本`single-authority-generation-1.0.0` / `recognition-single-authority-1.0.0`，没有建立Candidate20，没有改C19/V4原字节。材料归属、事件关联、依赖及修订沿现有权威字段；时间owner生成事件端点，附属覆盖只从同scope的真实主实体推出。共享时间逐个列真实owner；已知错owner在普通页显式隔离关联事件，无关联事件可确认，不猜接正确端点。

真实请求构造与Schema同步：`buildSingleAuthorityRequest`；录制解码只接受一个message/output_text，允许前置reasoning输出；原响应在sidecar独立保留。生成组件整包改变，不能将后续收益单独归因某一句Prompt。

## 产品保存及安排

- `OrdinarySourceFacts.tsx`与`App.tsx`：每事件选择先检查点，再在字段writer/revision和值guard下保存草稿；冲突、恢复接管和过期clear沿现有事务比较。检查点失败保留页面输入并告知刷新边界，手动重试；编辑恢复无需随便改字解锁。
- `eventDisposition.ts`、`sourceReviewD26.ts`：暂缓与拒绝分开；拒绝记录用户结构纠正，确认才进入正式事务。已接受事件不被后续解析覆盖。
- `domainCommit.ts`：共享时间部分确认时保留已接受owner，合并共享索引；提交receipt取实际事务结果，避免第二次部分确认读回误报。
- 事件编辑保留原描述、证据、选择和未改时间ID；共享或其他实体仍引用的时间不删，不制造重复ID。
- 日期窗口以V5 window_start/window_end表达，v8现有时间实体另存`legacyData.sourceTimeRole`，不升级schema、不改成deadline。浏览器发现D27会将窗口任务排到开放前，已修`personalPlanD27.ts`：窗口参与CAS基线，窗口外明确不安排，窗口内安排；个人计划与原窗口分开保存。
- `ordinaryMeasurementD26.ts`：事件拒绝按真实事件身份计结构纠正；无编辑不造editId，重试不重复计，旧measurement3.2/low-edit-v2不改。

## 运行和比较边界

`serve-candidate19-recorded.mjs --single-authority-fixtures`仍是现有普通App和正式保存链。12匿名手写wire标ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT，原4录制标ENGINEERING_REPLAY。GET-only本机回环服务，模型及外部路由403，全新库；旧6855未动。

另有`--single-authority-comparison`只读模式：全部8身份确定结算且绑定一致后才能载入真实raw，当前NOT_RUN。比较工具复用既有scoped engine/host，不重建发送系统；没有本批AUTHORIZATION时prepare/dispatch在transport、账本及grant之前拒绝。4匿名Development来源×C19/V5两臂，2AB/2BA，参照single-author/model-assisted/provisional，整份分母每臂4。冻结在工程提交后生成；本文件及工具均不是付费许可。

来源02标题/自由描述仍未独立裁决，本轮不扩文案重构。条件、渠道、公共时间及旧13事实投影复用并回归。
