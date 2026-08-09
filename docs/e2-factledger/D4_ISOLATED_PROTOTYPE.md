# E2.5 D4：隔离 FactLedger → Planner 原型

## 两条路径

### A：冻结单次识别

- 输入：冻结匿名样例原文、referenceTime、timezone。
- 模型：`deepseek-v4-flash`。
- Prompt：`recognition-2.4.1`。
- 输出：`RecognitionResult 2.0`。
- D5 复用同日已暴露 `g8-*-2-4-1` 原始缓存，避免把重复付费调用误写为新基线。

### B：隔离两阶段

1. `fact-ledger-extraction-1.0.0` 提取事实；
2. `parseFactLedgerJson` 做严格结构解析；
3. `validateFactLedger` 检查证据、引用和时间安全；
4. 只有 Ledger valid 才运行 `fact-ledger-planner-1.0.0`；
5. Planner 只收到不含 `sourceText` 字段的 Ledger view，只能使用 evidence quote；
6. Planner 输出仍由现有 `parseRecognitionResult` 校验为 `RecognitionResult 2.0`；
7. 使用与 A 完全相同的冻结 fixture 和 strict scorer。

## 实现位置

- `src/recognition/e2/factLedger/parser.ts`
- `src/recognition/e2/factLedger/prompts.ts`
- `src/recognition/e2/factLedger/diagnosticHarness.ts`
- `scripts/run-factledger-ab.mjs`

所有模块只由测试或显式诊断命令调用。生产 `pipeline.ts`、Cloudflare 路由、Workspace v8、Repository、Migration、DomainCommitPlan 和 Capture/Commit 均未引用该路径。

## Secret 与缓存

命令只从 Node 进程环境读取 `DEEPSEEK_API_KEY`，不读取 `VITE_*`，不接受命令行 Key，不打印 Key。模型请求直接由本机 Node 诊断进程发出，输入仅为选中的匿名暴露样例。

原始 Ledger 与 Planner 输出只写入 Git 忽略的 `.evaluation-cache/factledger-b-*.json`。提交文件只能包含匿名汇总、失败码和指标。

## 运行命令

```bash
npm run eval:recognition:e2:factledger -- \
  --dataset=generalization \
  --case-ids=e2-gen-03-3,e2-gen-07-1 \
  --baseline-cache=<existing-g8-2-4-1-cache.json> \
  --label=d5-complex \
  --delay-ms=8000 \
  --resume=true
```

要求：

- `DEEPSEEK_API_KEY` 只存在于服务端进程环境；
- `--model` 只能是 `deepseek-v4-flash`；
- B 的任一模型调用不做隐式重试；失败单独记录，不用后续成功覆盖；
- FactLedger invalid 时停止该例的 Planner 调用；
- A cache 必须含同一个 caseId 和原始结果；
- 不读取 expected 生成 Prompt，expected 只在模型调用完成后进入 scorer。

## 当前可执行状态

本 Worktree、同仓库其他 Worktree和当前进程均未发现 `DEEPSEEK_API_KEY`。因此当前只能完成单元级隔离验证；真实 B 路径必须标记 `NOT RUN / DEEPSEEK_NOT_CONFIGURED`，不得以 mock、本地 fallback 或 A 缓存冒充。

该阻碍不影响 D6 人工 Router/Validator 标签集，但会阻止 D5 给出可支持正式架构决策的真实 A/B 指标。
