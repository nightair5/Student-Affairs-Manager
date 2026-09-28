# 当前交接：D14 本地一体化工程已交付

更新：2026-09-28。工作区 `C:/Users/Winner/.codex/worktrees/student-affairs-candidate11/比赛`，分支 `codex/e2-candidate11-blind-eval`。执行以 PRD、AGENTS 和 [分层规则](../governance/PROGRESS_POLICY.md) 为准。当前唯一 D14 结果入口：[D14_RESULTS](candidate16/d14-integrated/D14_RESULTS.md)。

- Candidate16/v7、12 份单作者/模型辅助已见合成 Development 参照和 24 个 C03/C16 冻结身份来自 [D13](candidate16/d13-development/D13_RESULTS.md)，未改。D14 有边界复核未发现影响比较的确定性评分错误。旧 D11 拒绝和旧 raw/Expected/结果均不变。
- 24 个身份仍 `dispatchAuthorized=false`、`NOT_RUN`；D14 本地执行器及故障注入已完成，`node scripts/run-candidate16-d14.mjs --verify` 只读，缺本批新授权时 `--dispatch-next` 机械拒绝。模型调用/新 grant/reserve/settle/账本追加皆 0。
- [具体预算卡](candidate16/d14-integrated/BUDGET_AUTHORIZATION_CARD.md)：2026-09-28 官方核价，采用峰时/未命中缓存和保守 1,048,576 输入+8,192 输出 token，24 次最坏保守占用 US$7.785696，建议**新**硬上限 US$7.80。价格/路由/账本/最终 HEAD 在未来真调用前重查；旧 D11 US$8 许可不复用。
- D14 入口 `http://127.0.0.1:6647/?automation=1`，新独立库 `rco-mainline-01-02-i1-real-input-candidate16-d14-trial-1`。[浏览器证据](candidate16/d14-integrated/BROWSER_EVIDENCE.md) 覆盖无任务、精确/模糊事件、失败后手动重试、空白补录首任务、坏修订隔离、无关任务局部保存和多余任务拒绝；新增手动逐字完成标准/材料与纯信息独立事件/模糊时间，来源、原答和人工纠正分开。重复夹具开始前阻断。任务与独立事件并存、多事件/结束时间及每位真人独立数据库仍须补验。
- low-edit-v2 工程链路记录字段差异、editId/commitId/readback，拒绝是结构纠正；未闭合时间为缺失。四项真人指标皆 `NOT_OBSERVABLE`，真人参与者 0、负责人 0。[空白协议](candidate16/d14-integrated/TRIAL_PROTOCOL.md) 不是试用授权。
- [验证](candidate16/d14-integrated/VALIDATION.md)：D14 执行器 11/11、隔离 2/2、追加手动/安全相关定向 71/71、D13 语义/身份 17/17、lint/build/security 与历史保护通过；最终全量 Vitest 仍 FAIL（1506 passed/2 failed/1 skipped，旧 carrier 环境、5 秒超时和 D9 Node 文件收集）。没有改旧断言凑绿。
- 权威账本 840 行、SHA-256 `ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea`、完整链通过、append 0；84 历史保护与 119 冻结文件通过。代码 `50f7161`、隔离检查 `7b16ffb` 已提交推送；文档最终 HEAD 见 Git/交付回复。

接下来按具体授权卡取得**本批模型、24 次及美元硬上限**的明确新授权，才可再核价与执行比较；真人探索则先补任务/独立事件混合及多事件边界、每人独立库，随后安排真实负责人/参与者及试用范围授权。独立 Holdout、默认候选替换、合并和部署均未授权。
