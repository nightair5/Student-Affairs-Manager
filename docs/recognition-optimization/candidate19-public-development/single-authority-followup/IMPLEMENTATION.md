# 单一权威关系与逐事件处置实现

2026-10-06。工程实现，不是新模型成绩。当前原4首答仍0正确/3错误/1UNKNOWN；相同raw的后验展示亦0/3/1，分母4。

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
