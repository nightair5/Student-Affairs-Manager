# D9 验证记录（2026-09-27）

| 检查 | 实际结果 |
|---|---|
| `node scripts/prepare-candidate15-d9.mjs --verify` | PASS：12 参照、12 正反例往返、24 未授权身份 |
| `node --test scripts/verify-candidate15-d9.test.mjs` | 4/4 PASS：完整性、身份漂移、重复与未授权阻断 |
| `node scripts/prepare-candidate15-d8.mjs --verify` | PASS：D8 旧冻结仍为 0 实际身份、WAITING，不改写历史 |
| `node scripts/verify-governance-protection.mjs` | PASS：82 个历史文件原位未变、2 个旧根文档归档、2 个现行根文档验证、D7 14 个组件不变；账本只读 791 行、694807 bytes、SHA-256 `efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a` |
| `node --test scripts/governance-protection.node-test.mjs` | 12/12 PASS |
| 定向 Vitest：composer、来源状态、UI 计时 | 36/36 PASS；新增无任务事件 scope 和读回失败后计时反例通过 |
| `npm run lint` | exit 0，8 条已存在的非阻断 warning（含 fast-refresh 和旧 input ref） |
| `npm run build` | exit 0；Vite 仅提示现有大 chunk |
| `npm run security:scan` | exit 0，Secret 扫描通过 |
| `npm run test` | exit 1：全量 Vitest 1479 通过、4 失败、1 跳过。失败中 3 项是在并行跑 lint/build/full test 时发生的 5 秒超时，后续隔离复跑相关 runtime 30/30 和 explicit review 3/3 通过；剩余 `REAL_INPUT_CARRIERS_MANIFEST` 裸测试会在 `realpathSync('undefined')` 失败，为历史问题。全量门槛仍不标 PASS。之后的 server/worker/RCO-5-007 步骤因 npm test 中途停止，未在该命令内执行。 |

历史 `RCO-5-007` 与旧 package-lock 冻结差异原样保留；本轮不改旧锁或断言以求过关。浏览器独立事件编辑及 canonical Event 读回未通过，详见 `BROWSER_EVIDENCE.md`。没有任何业务模型请求或真实用户试次。
