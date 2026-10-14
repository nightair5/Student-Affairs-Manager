# D17：Candidate03 vs Candidate17 付费比较前置状态

2026-09-28 12:55 UTC 只读核验。本文件是可审查的执行准备记录，**不是模型调用授权**。当前 24/24 `NOT_RUN`，模型请求、grant、reserve、settle 均为 0。Candidate17 的模型效果未知。

## 冻结范围

- 分支 `codex/e2-candidate11-blind-eval`；D16 起点 HEAD `fa3c0dc9d95a8028836ea2eaaabbd74824907b2f`。执行时必须绑定届时已提交且已推送的最终 HEAD。
- D16 Manifest SHA-256 `6538b63f73b38b14992511e2e40cd4a1d3a334528ae1b2ca7cfdf86a8cd7e4a8`；请求身份文件 SHA-256 `b107900c6f31f4c02b45d54dcb3ae0693da6240ae12cac07a0411b0a1adf139b`。两臂各 12 个单元，6 组 AB、6 组 BA，请求均不含 Expected。`prepare-candidate17-d16.mjs --verify` 和 `candidate17-d16-guard.mjs` 原样通过。
- 来源是新写文本、旧结构模板衍生的单作者/模型辅助 provisional Development；不是独立人工真值或未见 Holdout。D16 来源、参照、请求、Candidate03/Candidate17、公共 adapter、Schema 和 v7 评分器保持冻结；D15 原结论不变。

## 计价、账本与授权门

[DeepSeek 官方计价页](https://api-docs.deepseek.com/quick_start/pricing/)在上述核验时间列出 `deepseek-flash` → DeepSeek-V4.1-Flash、1M 上下文、峰时缓存未命中输入 US$0.30/百万 token、峰时输出 US$1.20/百万 token，并说明按输入和输出 token 计费。冻结请求输出上限为 8,192。沿用比标称上下文更宽的 1,048,576 输入 token/单元，按 24 个单元、全部峰时及未命中计算，公式精确值 US$7.7856768；逐单元向上取整到微美元后执行器预留上界 **US$7.785696**。这不是已发生的费用或供应商实扣，价格、路由、上下文、收费项变化时必须在 grant 前重新核验并重算。建议本批硬上限 US$8.00；用户尚未提供这一批的明确上限授权。

权威账本只读核验：`C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl`，889 行、754384 字节、SHA-256 `01d6670af09175475fcdfa5aec3594d2751cfd3b03050743fb79a04a578ad4c9`，完整哈希链有效。它是当前快照；授权后建 grant 前必须重新核对，合法追加须先定位，不能沿用旧基线或旧 grant。

## 可执行安全边界

执行器代码提交 `b22a3fa` 已推送。本前置记录提交后，授权记录还必须绑定届时**最新且已推送**的 HEAD，不能只用代码提交或 D16 起点 SHA。

`scripts/candidate17-d17-executor.mjs` 绑定冻结身份、请求 SHA、顺序和 24 个分母；`scripts/run-candidate17-d17.mjs` 提供只读 `--verify`，付费入口则须另有本批 `AUTHORIZATION.json`。该文件位于 Git 忽略的 `.data/candidate17/d17-execution/`，当前不存在。未来只能根据**新的实际用户授权消息**创建，必须记录消息 SHA、最终提交 HEAD、完整 Manifest/身份/逐请求 SHA、模型与参数、用户硬上限、新 grant ID、当时账本前缀和有时效的官方价格证据。不能把本文件或复制的提示词填成 `authorizationSource=CURRENT_USER_MESSAGE`。

授权成立且全部硬门通过后，顺序为：`--prepare-authorized` 只建一个 grant；随后每单元跨进程锁→身份/账本检查→reserve→发送前状态→最多发送一次→原样 raw/response SHA/usage→settle。任何 reserve、发送、raw 或 settle 不确定会封存并停发；不存在自动重试、repair、verifier。HTTP 错误和已持久化但格式错误的响应保留为确定失败，仍占分母；usage 不可见时以保守上界结算并单列 `NOT_OBSERVABLE`。评分器 `scripts/score-candidate17-d17.mjs` 只读完整结果后按冻结 v7 同口径评分；`candidate17-d17-selection.mjs` 执行 D16 预注册的开发改善、混合进展、风险退步及证据不足分层。

本轮离线安全与选择规则测试 17/17 通过，覆盖身份/顺序、重复、预算、锁、reserve/send/raw/settle/持久化故障、缺 usage 保守结算及风险决策。无授权下 `--prepare-authorized` 与 `--dispatch-next` 均拒绝，账本 SHA 未变。运行 `--verify` 仅只读报告。未来实发前要再做一次官方核价、账本及远端 HEAD 检查，并重新运行安全定向测试。

## 待用户确认的唯一付费范围

可供用户在新消息中明确授权的文字：

> 仅授权 D16 Manifest SHA-256 `6538b63f73b38b14992511e2e40cd4a1d3a334528ae1b2ca7cfdf86a8cd7e4a8`、身份文件 SHA-256 `b107900c6f31f4c02b45d54dcb3ae0693da6240ae12cac07a0411b0a1adf139b` 中的 24 次 `deepseek-flash` 请求，费用硬上限 US$8.00；允许一个新专用 grant 和逐单元 reserve/settle。不授权额外样本、重试、repair、verifier、独立 Holdout、真人试用、默认候选替换、合并或部署。

授权后若最坏费用超限或任一冻结/安全条件漂移，则 0 grant、0 请求停止。开发比较完成也只支持筛选，四项真人主指标仍需真实试次与负责人裁决。
