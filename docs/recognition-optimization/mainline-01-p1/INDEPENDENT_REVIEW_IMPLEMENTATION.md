# P1 V2 独立审查：阻断

审查者：无上下文 `/root/p1_v2_independent_review`；只读，未改文件或调用产品模型。独立复跑45/45。以下程序反例只变形已见工程响应，不修改旧夹具或答案。

1. 时间只经材料关联任务时，被当成无日期：清空multi中d0.relatedTaskTempIds及submit.timePointTempIds，保留d0→m0，确认后timePoints=0、材料deadline=null。共享事件也因eventTempIds固定空数组丢失归属。
2. 冲突仅检查任务ID：加入requiresDecision=true、entityTempIds=['d0']，submit仍能确认，时间冲突漏拦。
3. 仅信任selected：submit改optional_suggestion且保留selected=true，V2仍默认勾选且可确认。该反例已触发计划停止条件。
4. date-only补具体时刻：d0设date_only、Asia/Tokyo，编辑2026-09-10T09:00，面板显示Tokyo、落库Shanghai。
5. 浏览器onChange逐次严格校验落库且无输入缓冲；逐字输入可能被拒绝/回跳，整串填入不足以证明可用。此项为代码审查结论，本轮未完成逐键浏览器复现。

定位：confirmationV2.ts:93/98/110/185–189，domainCommit.ts:636，mainline01p1/browser.tsx:78–85。反例3后停止修补和后续全量门；结论BLOCKED，42/42不得代替安全验收。不建立组件冻结。
