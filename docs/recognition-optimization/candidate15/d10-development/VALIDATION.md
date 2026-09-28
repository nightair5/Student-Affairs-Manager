# D10 验证与历史失败边界

日期：2026-09-28。D10 为匿名工程回放和零业务模型调用准备包；下述浏览器、内存仓储和自动化结果均不是独立人工真值或真人指标。

## 本轮通过

| 检查 | 结果 |
|---|---|
| `node scripts/prepare-candidate15-d10.mjs --verify` | 12 来源、24 个 D9 正文字节/身份不变；6 AB、6 BA；全部 `NOT_RUN`、未授权。对 D9 提交做 Git 历史组件核验。 |
| `node --test scripts/candidate15-d10.node-test.mjs` | 2/2，通过身份漂移、重复、未授权派发阻断。 |
| `npm run build` | 通过；Vite 仅报告现有大 chunk 警告。 |
| `npm run lint` | 0 error、8 warnings；无新 lint error。 |
| `npm run security:scan` | 通过，扫描 2888 个 source/build 文件。 |
| `node scripts/verify-governance-protection.mjs` | 通过：84 份历史保护文件，82 份原位未变、2 份留档；账本只读为 791 行、694807 bytes、SHA-256 `efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`。 |
| 隔离浏览器 6639、6640、6641、6642 | 事件编辑/确认/来源详情/刷新及注入失败后手动重试通过，详见 [浏览器证据](BROWSER_EVIDENCE.md)。 |
| `npx vitest run src/experiments/candidate13/d6Runtime.test.tsx src/experiments/realInput01/extraction.test.ts src/experiments/realInput01/runtime.test.ts --testTimeout 15000` | 46/46，通过；全量运行的三处 5 秒超时与 OCR spy 失败在隔离复跑中未复现。 |
| `npx vitest run src/experiments/candidate15/d10Event.test.ts src/experiments/candidate15/uiMeasurement.test.ts src/experiments/mainline05/semanticConfirmation.test.ts src/experiments/realInput01/acceptance.test.tsx --testTimeout 15000` | 134 通过、1 个历史裸测试失败；D10 新增事件及计时测试、旧确认回归均通过。 |
| `node --test server/server-tests.mjs cloudflare/worker-tests.mjs scripts/time-ast-parity.node-test.mjs scripts/multimodal-evaluation-lib.node-test.mjs` | 57/57，通过；测试使用模拟上游，不是业务模型调用。 |
| `npm --prefix functions test` | 5/5，通过；模拟服务端路径，不读取业务 Secret。 |

## 全量测试未通过，如实保留

`npm run test` 在 Vitest 阶段停止：139 个测试文件通过、5 个失败、1 个跳过；1484 个测试通过、5 个失败、1 个跳过。失败为 3 个默认 5 秒超时、1 个 OCR 超时 spy 断言、1 个已知 `REAL_INPUT_CARRIERS_MANIFEST` 裸运行变量缺失，以及 Node 原生测试文件被 Vitest 扫描后报“无测试套件”。这些测试文件/断言未被改写。三个超时和 OCR 路径在隔离放宽超时复跑中通过。D9 的 Node 原生冻结测试单独执行为 3/4，通过的三项仍阻断未授权、身份漂移和重复；失败项是旧检查器要求当前 `scripts/serve-candidate15-d8.mjs` 仍等于 D9 哈希。D10 以 Git 中 D9 提交核验旧快照，并对现行产品文件另做 D10 哈希，不修改旧 D9 文件或旧断言。

`scripts/rco-5-007-replay.node-test.mjs` 的 `FREEZE_HASH_MISMATCH:package-lock.json` 仍是历史失败；其余三个 RCO-5-007 检查通过。旧锁文件、断言、Expected、raw 和结果均未改。全量 `npm run test` 因 Vitest 非零而不会自动执行后续 Node/Functions 检查，故它们按上表单独运行；不能称全量 PASS。

隔离浏览器提供 UI 观察与计数，来源/事件/时间的完整仓储关系和幂等/原子性由 D10 定向集成测试验证。浏览器匿名记录下载超时，未归档文件级截图或录屏；页面截图已在浏览器工具中即时观察。四项真人主指标继续 `NOT_OBSERVABLE`。
