# D16 验证与未完成项

日期：2026-09-28。新代码/准备包：`node scripts/prepare-candidate17-d16.mjs --verify` 通过（12 完整 provisional 参照、24 身份、6 AB/6 BA）；`node scripts/candidate17-d16-guard.mjs` 通过（全 `NOT_RUN`、禁止派发）；`node --test scripts/candidate17-d16.node-test.mjs` 3/3 通过（篡改、重复身份、请求漂移和无授权阻断）；`npx vitest run src/experiments/candidate16/staleRecovery.test.ts src/experiments/candidate16/measurement.test.ts` 5/5 通过。`npm run lint` 退出 0，8 个旧 warning、0 error；`npm run build` 通过；`npm run security:scan` 通过。隔离浏览器见 [BROWSER_EVIDENCE](BROWSER_EVIDENCE.md)。

全量 `npm run test` **未通过**：Vitest 1508 passed、3 failed、1 skipped，另 1 个失败 suite。失败分别为 `scripts/verify-candidate15-d9.test.mjs` 没有 Vitest suite、`acceptance.test.tsx` 的候选 02 launcher 子进程在缺少 `REAL_INPUT_CARRIERS_MANIFEST` 环境变量时拿到 `undefined` 路径、`acceptance.test.tsx` 的 U01-09 5 秒超时、`runtime.test.ts` 的 A02 5 秒超时。日志显示这些与 D15 记录的旧测试收集/环境/负载问题同类；本轮没有改旧冻结脚本或调大超时制造全绿，新增 D16 定向检查均通过。未跑完后续 `npm test` 链上的服务器、Cloudflare、RCO-5-007、functions 测试，因此不能称全量 PASS。

`node scripts/verify-recognition-history.mjs --verify` 通过但状态为 `HISTORY_PRESERVED_LEDGER_APPEND_REVIEW_REQUIRED`：84 历史保护、119 冻结文件未变；账本 889 行、SHA `01d6670af09175475fcdfa5aec3594d2751cfd3b03050743fb79a04a578ad4c9`，D15 的 49 行合法追加只读记录。旧 D13 动态账本快照校验不适合当作当前字节冻结断言，不修改旧文件凑绿。

`npm audit --audit-level=high --json` 为 3 high / 2 moderate：high 路径是开发工具 `wrangler → miniflare → sharp/libheif`，moderate 是 `vitest → @vitest/mocker` 的路径遍历公告。它们不是这次业务模型 Prompt 依赖，但本地工具处理不可信图像或运行测试时仍有暴露面；兼容修复应在单独的依赖/锁文件变更中更新 Wrangler，并评估 Vitest 5 主版本迁移及完整回归。旧 lock 受保护，本轮未变。

实际浏览器已在 p6 补验“有未保存字段时事件先保存”的冲突恢复和保存失败手动重试；见 [浏览器证据](BROWSER_EVIDENCE.md)。错误修订、局部确认和多余任务拒绝这轮未重跑，只保留 D15 历史证据。尚缺真正独立人工参照、真人登记/同意/负责人裁决与模型比较授权。Candidate17 识别效果未观察到；24/24 保持 `NOT_RUN`，四项真人指标均 `NOT_OBSERVABLE`。
