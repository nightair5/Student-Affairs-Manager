# Candidate12 D2 验证记录

日期：2026-09-21。

- 发送前 D2 预算/锁/恢复定向测试：6/6 通过。覆盖精确账本前缀、24 单元顺序、最坏预算、单 grant/reserve/settle、过期价格、请求漂移、跨进程锁、不确定即停批，以及 raw 已持久化后的零重发恢复。
- 发送前 D1+D2 联合定向测试：17/17 通过；D1 Manifest SHA 保持 `e2a14c8a920613f8cdd44afa57699f674f266f102df28b2eb926e1b750b1e005`，84 份保护文件一致。
- 发送后重新运行同一联合测试：1/17 通过、16/17 按设计拒绝。原因是这些发送前测试硬绑定 693 行账本前缀；本批合法追加后权威账本已为 742 行，D1 报 `AUTHORITY_LEDGER_DRIFT`，D2 临时 grant 测试报 `CANDIDATE12_D2_BUDGET_GRANT_DRIFT`。未改旧锁、旧哈希或权威账本来迁就测试；发送后的正确只读验证入口是下述 `--verify`，已通过。
- `npm run lint`：0 error，5 个既有 warning。
- `npm run build`：通过；只有既有 chunk-size warning。
- `npm run security:scan`：通过，2642 个源码/构建文件未检出 Secret。
- 裸 `npm run test`：1432 通过、1 失败、1 跳过；失败为既有 `REAL_INPUT_CARRIERS_MANIFEST` 未设置导致 `lstat .../undefined`。同一 A02 测试单独运行 1/1 通过。一次全量并发还出现该测试 5 秒暂态超时，单独以 15 秒上限复跑 1/1 通过。
- 历史 RCO-5-007 保持 `FREEZE_HASH_MISMATCH:package-lock.json`，没有改旧锁、冻结 hash 或发布门槛。
- 24/24 raw/result/ledger 绑定通过；1 grant、24 reserve、24 settle，0 halt、0 uncertain。
- `node scripts/analyze-candidate12-d2-postrun.mjs --verify` 可只读重建并逐字验证 `EXECUTION_LEDGER.json`、`ANALYSIS.json` 和 `REPORT.md`。

验证边界：执行完整不等于评分包有效。冻结 scorer/reference 接口不兼容，因此正式工程筛选失败；事后诊断不能替代预注册结论。
