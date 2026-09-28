# D11 验证记录

派发前：D10 `--verify` 返回 12 来源、24 身份、全部未授权/未运行；D11 6 项定向检查通过（冻结身份、预算、无授权、身份漂移、重复/不确定停机、真实 adapter→v6 oracle）；治理保护工具通过 84 文件与 791 行基线。`npm run lint` 为 0 错误、8 条历史 warning；`npm run build` 和 `npm run security:scan` 通过。

`npm run test` 在 Vitest 阶段以失败结束，不能称全量 PASS：141 文件通过、3 文件失败、1 跳过；1,486 测试通过、3 失败、1 跳过。失败层为旧 Node 测试文件被 Vitest 收集却无 Vitest suite；两个旧回放默认 5 秒超时；历史 `REAL_INPUT_CARRIERS_MANIFEST` 裸运行缺失。后续命令未因全量链中断而执行。旧 D9 当前文件哈希断言、RCO-5-007/package-lock 冻结哈希失败均保留原状。

派发后：`node scripts/run-candidate15-d11.mjs --verify` 通过，24 settled、无 pending、账本 840 行、全链及前缀通过；`node scripts/audit-candidate15-d11.mjs --write` 与 `node --test scripts/candidate15-d11-postrun.check.mjs`（2/2）通过，确认单 grant、24 reserve、24 settle、24 raw 身份/response SHA/usage 对应、84 保护文件，以及冻结 v6 scorer 字节不变。v6 评分对 19 单元正常返回、2 个引用失败、3 个评分器异常；`SCORING_RESULTS.json` 将异常保留而非修正冻结 scorer。派发后再次运行 lint、build、security scan 均通过（lint 仍为 0 错误、8 条旧 warning），D10 `--verify` 再次通过。旧治理工具派发后实际返回 `GOVERNANCE_PROTECTION_LEDGER_DRIFT`，因为它固定要求 791 行；D11 前缀/全链校验覆盖本批合法新增写入，不改旧断言或旧基线。
