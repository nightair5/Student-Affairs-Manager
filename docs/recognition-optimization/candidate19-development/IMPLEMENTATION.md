# 原批完整录制后的产品转换

2026-10-04。C17/C19原12身份全部确定结算，旧冻结组件、请求、参照及v11原成绩保持。这里交付的是后验公共产品转换，未修改模型输入或默认候选。

| 根因及用户场景 | 实际路径 | 当前行为和限制 |
|---|---|---|
| S01无需/禁止动作投影为待办 | recognition/directiveDispositionProduct.ts，1.0.1 | 同片段有直接否定、无引用且状态一致才转信息；提醒/条件/问句/关联端点仍受阻，缺事件不补猜 |
| S03资格说明引用已有任务，纯信息契约整份拒绝 | recognition/sourceAccountingSupportProduct.ts，1.0.0 → sourceContractV4 → 普通App | 只转换已有主动作、同对象资格未知/未公布依据的辅助引用；两项填写/递交显示，前置完成仍unknown，领取资格项未选 |
| S05材料和办结标准辅助引用导致整份拒绝 | 同上MATERIAL_SPECIFICATION/COMPLETION_STANDARD | 主实体、所属关系、同scope及原文值成立才转换；已有PDF/文件名、09:25截止、14:20—15:35活动直接显示；错引用/错标准/图冲突仍受阻 |

保留originalWire、每条scope/entity/reason、projectedAccounting、inferredFacts=0；原响应、冻结编译、后验转换、用户修改分别保存。单向权威声明生成反向索引属原契约行为，不把合法反向生成混作人工纠正。

src/experiments/candidate19Recorded/browser.tsx使用decodeProductSourceRecording；复用普通App/Capture/ReviewSession/DomainCommitPlan/Repository和独立reader。loader核确定settle、HTTP和source/request/identity/response SHA，提供12份原录制；仅回环/新库/实时派发关闭。referenceTime保留并使用可逆scope重绑，不用回放当天重解释原时间。D27最小安排沿用，个人计划与原deadline分开。

scripts/diagnose-candidate19-product.mjs对全部12份旧raw双臂同标准诊断。原模型/原冻结成绩与新产品接收、同v11后验风险分列；6/6可解析不是6/6整份正确。S02/S05的rawText边界及同日结束表示争议保留，v11原分数不改。不把新转换称新模型提高或独立人工真值。

定向29项通过：独立写法/顺序不变，最小错引用、错对象、无完成证据、错图反例。真实Schema→adapter→普通draft→DomainCommitPlan→另一Repository：S05为Task1/Project0/Event1/TimePoint3/Material1，精确值和幂等验证；S03仅保存两任务，资格项仍待确认且无已完成事实。最终浏览器证据在BROWSER_EVIDENCE另记，不用单测替代点击。

剩余：S04不适用任务仍未选且受阻，避免误执行但增加核对负担；不能自动把所有false删成正确。C17遗漏S01事件未自动发现。来源完整覆盖、自由描述及材料表述等价需下一步定向诊断；无真实裁决不报完整产品正确率。真人四指标NOT_OBSERVABLE。本包无新Prompt/新候选/新身份，原批后不再模型调用。
