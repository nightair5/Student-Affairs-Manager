# D10 结果：无任务独立事件闭环与零调用再冻结

状态：`D10_ZERO_CALL_PACKAGE_REVIEWABLE_FOR_NEW_AUTHORIZATION`，**仅供审查，不是调用许可**。起点 `645555681163f4bdac55377df88caa5cec7d0c46` 本地、upstream、远端一致且工作区干净。D9 的 12/12 参照仍是单作者/模型辅助、完全已见合成 Development，绝非独立人工真值或 Holdout。

## 工程变化

- 无任务来源的独立事件现在有单独的人工核对表单，能修改名称、地点、说明、开始/结束时间引用、时间原文或人工补充、精度与不确定状态。原回答、首次建议和来源 scope 不被覆盖；每次保存追加纠正与历史，canonical `Event`/`TimePoint` 的 `legacyData.extractionMethod=user_correction` 标注人工变化。
- “确认无任务并保存独立事件”经 `DomainCommitPlan` 单事务把独立事件、关联时间、来源依据和历史写入 v8。新确认操作带 `d10-event-commit-1` 标记；旧版已核对信息仍按旧契约读回，不因新规则凭空生成事件/依据。模糊 `周三晚` 保持 `normalizedValue=null`、`needsConfirmation=true`，无提醒、无虚假截止；纯信息无事件仍保存来源、0 任务、0 项目。已确认的事件可在收件箱/资料库来源详情查看，计数来自 canonical 工作区，刷新后仍可读回。
- 失败写入原子回滚，编辑缓冲不丢；无自动重试。重复操作 ID 返回同一状态，旧修订版本被拒绝。确认后当前只读查看事件；以后若开放再编辑，需要新的追加历史事务。
- 计时契约版本 `candidate15-product-metrics-3.2.0` 把事件字段修改单独归类为实质纠正；阅读 10 秒不算主动修改，字段 editId 与 commitId/readback 关联，失败确认不计成功。没有人工注册试次，四项真人主指标均 `NOT_OBSERVABLE`。
- 同来源的**任务关联事件**沿既有确认路径保留；任务确认不会偷偷接受另一个未关联的独立事件。后者的单独确认入口尚未在本轮实现，属于后续混合来源工作，不把草稿保留说成已确认。

## 实验冻结与预算边界

D9 原 Manifest、12 参照、正反例、24 请求身份逐字节不变。新 [D10 Manifest](MANIFEST.json) 使用 Git 中 D9 HEAD 对 D9 全部冻结组件作历史验证；当前修改过的产品组件只进入 D10 新哈希，不修旧断言。24 份请求 JSON 与 D9 逐份完全一致，12 A/12 B，6 AB/6 BA，仍 `dispatchAuthorized=false`、`NOT_RUN`。冻结晋级门槛、失败保留分母、一次发送、零重试/repair/verifier、状态不确定即停均不变。没有模型调用或账本交易。

[预算草案](FUTURE_BUDGET_AUTHORIZATION_DRAFT.md)按 2026-09-28 官方价格给出峰时极宽 token 价上界 US$7.4359296 与未来可审议 US$8.00 硬上限；实际 usage/费用不可观测，价格或额外计费变化必须先停。新的 grant、reserve、settle 或任何一次派发都需用户另行明确授权。

浏览器操作及失败读回见 [证据](BROWSER_EVIDENCE.md)，测试与历史失败见 [验证](VALIDATION.md)。下一步先审查此包、核价与预算硬界，再决定是否授权 24 次已见 Development 调用；通过 Development 之后仍需真正独立人工 Holdout 和真人试次，不能直接切换默认候选或部署。
