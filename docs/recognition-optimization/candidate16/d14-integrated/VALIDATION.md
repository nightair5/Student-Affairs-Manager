# D14 验证与历史失败分列

日期：2026-09-28。验证对象为本地代码提交 `50f7161` 和隔离检查提交 `7b16ffb`，无付费模型调用。

| 检查 | 结果 |
|---|---|
| `node scripts/prepare-candidate16-d13.mjs --verify` | PASS：12 参照、24 未授权身份，D13 原字节冻结 |
| `node scripts/verify-recognition-history.mjs --verify` | PASS：84 历史保护、119 冻结、7 存档；账本 840 行、SHA `ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea`、append 0 |
| `node --test scripts/candidate16-d13-package.check.mjs scripts/candidate16-d13.check.mjs` | 17/17 PASS，有限语义、参照与配对身份检查 |
| `node --test scripts/candidate16-d14-executor.test.mjs` | 11/11 PASS，含 reserve/send/raw/settle/usage/持久化不确定和跨进程锁 |
| `node --test scripts/candidate16-d14-isolation.test.mjs` | 2/2 PASS，单独端口/数据库、本地只读资源、未授权派发账本不变 |
| `npx vitest run` D14 trial/manual/measurement 定向 | 9/9 PASS；空白任务正式提交、独立读回、缺失指标口径 |
| `npm run lint` | PASS：0 error、8 条已有 warning |
| `npm run build` | PASS；Vite 有大块体积 warning |
| `npm run security:scan` | PASS |
| 实际浏览器及独立 repository 读回 | PASS 于已列场景，具体轨迹见 [BROWSER_EVIDENCE](BROWSER_EVIDENCE.md)；手动完整字段不足单列 |

`npm run test` **未通过**：Vitest 1503 passed、3 failed、1 skipped；4 个 test files 报失败。当前可定位的失败包括旧 `realInput01/acceptance.test.tsx` 的 5 秒超时、候选02裸启动测试因环境 `REAL_INPUT_CARRIERS_MANIFEST` 未提供而把 `undefined` 传给 `realpathSync`、旧 `realInput01/runtime.test.ts` 的 5 秒超时，以及 Node 原生 test 文件被 Vitest 收集后与原生运行方式不一致。相同 D13 Node 检查以 `node --test` 单独运行 17/17 PASS。没有修改旧超时、carrier 断言、冻结 package-lock 或旧 Expected 来制造全绿。历史 RCO-5-007 锁文件哈希失败保留旧记录；本轮没有因此触碰该锁。

隔离浏览器选择超长按钮列表时，自动化点击曾点到非当前刺激；页面身份守卫将其拦住，没有落库。用键盘准确激活目标后完成精确事件验收。此事属于浏览器自动化选择问题，不计候选输出错误。

新增 D14 安全/产品定向检查均通过，故本地工程可审查；全量验证仍为 FAIL，不写 PASS。模型比较、真人指标和发布状态不随这些测试自动晋级。
