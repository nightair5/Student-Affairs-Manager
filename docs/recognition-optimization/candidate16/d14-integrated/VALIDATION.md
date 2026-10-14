# D14 验证与历史失败分列

日期：2026-09-28。验证对象为代码提交 `50f7161`、隔离检查提交 `7b16ffb` 和手动补录提交 `1cb91d5`，无付费模型调用。

| 检查 | 结果 |
|---|---|
| `node scripts/prepare-candidate16-d13.mjs --verify` | PASS：12 参照、24 未授权身份，D13 原字节冻结 |
| `node scripts/verify-recognition-history.mjs --verify` | PASS：84 历史保护、119 冻结、7 存档；账本 840 行、SHA `ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea`、append 0 |
| `node --test scripts/candidate16-d13-package.check.mjs scripts/candidate16-d13.check.mjs` | 17/17 PASS，有限语义、参照与配对身份检查 |
| `node --test scripts/candidate16-d14-executor.node-test.mjs` | 11/11 PASS，含 reserve/send/raw/settle/usage/持久化不确定和跨进程锁 |
| `node --test scripts/candidate16-d14-isolation.node-test.mjs` | 2/2 PASS，单独端口/数据库、本地只读资源、未授权派发账本不变 |
| `npx vitest run` D14 trial/manual/measurement 定向 | 9/9 PASS；空白任务正式提交、独立读回、缺失指标口径 |
| `npm run lint` | PASS：0 error、8 条已有 warning |
| `npm run build` | PASS；Vite 有大块体积 warning |
| `npm run security:scan` | PASS |
| 实际浏览器及独立 repository 读回 | PASS 于已列场景，具体轨迹见 [BROWSER_EVIDENCE](BROWSER_EVIDENCE.md)；手动完整字段不足单列 |

首次 `npm run test` **未通过**：当时 Vitest 1503 passed、3 failed、1 skipped；4 个 test files 报失败。追加手动链路后再次运行 `npm run test` 仍在 Vitest 阶段失败，先前新增的 2 个 Node 原生 `.test.mjs` 被错误收集；已改为 `.node-test.mjs`。随后单独重跑全量 Vitest：**1506 passed、2 failed、1 skipped；2 个文件失败**。剩余失败是旧 `realInput01/acceptance.test.tsx` 的 5 秒超时、候选02裸启动测试因环境 `REAL_INPUT_CARRIERS_MANIFEST` 未提供而把 `undefined` 传给 `realpathSync`，以及旧 D9 Node 文件被 Vitest 收集为 `No test suite found`；这些不属于 D14 业务回归。相同 D13 Node 检查以 `node --test` 单独运行 17/17 PASS。没有修改旧超时、carrier 断言、冻结 package-lock 或旧 Expected 来制造全绿。历史 RCO-5-007 锁文件哈希失败保留旧记录；本轮没有因此触碰该锁。

隔离浏览器选择超长按钮列表时，自动化点击曾点到非当前刺激；页面身份守卫将其拦住，没有落库。用键盘准确激活目标后完成精确事件验收。此事属于浏览器自动化选择问题，不计候选输出错误。

新增 D14 安全/产品定向检查均通过，故本地工程可审查；全量验证仍为 FAIL，不写 PASS。模型比较、真人指标和发布状态不随这些测试自动晋级。

追加手动链路修正：`npx vitest run src/experiments/candidate16/d14ManualRuntime.test.ts src/experiments/candidate16/d14Trial.test.ts src/experiments/realInput01/factCorrections.test.ts src/experiments/mainline05/semanticConfirmation.test.ts` 为 71/71 PASS。覆盖手动任务完成标准/材料、无任务独立模糊事件保存和读回、重复夹具阻断；`npm run lint` 仍 0 error/8 旧 warning，`npm run build` PASS。旧隔离库加载曾因尝试修改通用 canonical Task description 导致一致性错误，已撤回该通用变更，改为仅把**新手动补项**的完成标准写入其原有 description；旧库随后实际刷新加载成功，旧冻结文件未改。

追加代码后的改名前 `npm run test` 为 **FAIL**：1504 passed、4 failed、1 skipped；6 个文件失败，其中 3 个旧测试 5 秒超时、旧 carrier 环境未设导致 `realpathSync(undefined)`，以及 Vitest 误收集新加的 2 个 Node 原生 `.test.mjs` 文件和旧 D9 一个 Node 文件（均 `No test suite found`）。新增两文件已改名为 `.node-test.mjs`，其 13 个 Node 离线测试 PASS；改名后全量 Vitest 结果如上。浏览器最新版本还实测旧夹具重开显示 `D14_RECORD_ALREADY_OPENED_IN_THIS_DATABASE`、试次身份仍 `NOT_RUN`。
