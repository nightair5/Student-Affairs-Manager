# D25验证、历史失败与一次复核

2026-10-02。所有模型调用、真实账本写入、真人试次为0。测试使用匿名假传输和临时账本，不连接模型做探测，不读根.env明文。代码提交`3aabcca00cf8eb8a0830a8f3de317a182b07186b`。

| 验证 | 本轮确定结果 | 范围/证据 |
|---|---|---|
| D25机制、执行器与live安全Node | 29/29 PASS | [d25-node.log](validation/d25-node.log)：否定/完成、对象、图、材料/修订、同义顺序、FN身份；无授权、漂移、重复、并发、reserve中断、发送/写raw/settle不确定；真实OS锁匿名并发及metadata一致性 |
| 真实产品链集成 | 5/5 PASS | [vitest.log](validation/vitest.log)中的d25-product.test.ts；Source/Run/Draft、C18转换、原子失败/手动读回、坏项阻断、两匿名repository身份全图隔离 |
| 权威全量入口 | 15组11PASS/4FAIL | `npm run test`实际调用candidate11-checks；[test.json](validation/test.json)，各独立组运行到确定退出，没有首失败漏跑server/worker/functions |
| Vitest子组 | 158文件PASS、1文件skip；1578测试PASS、1skip | maxWorkers=2，权威入口生成匿名carrier并继承REAL_INPUT_CARRIERS_MANIFEST，当前未复现旧5秒超时；Node发现规则已与Vitest分开，不加全局timeout或排除失败 |
| lint | PASS：0 errors、8既有warnings | [lint.log](validation/lint.log)，既有fast-refresh和InputReview ref cleanup warning，没有把警告说成0 |
| build/typecheck | PASS | [build.json](validation/build.json)，tsc与Vite真实构建；既有>500KB chunk警告保留，无新依赖 |
| security scan | PASS | [security.log](validation/security.log)，源文件/构建密钥扫描；新增证据后再扫描记录独立保存 |
| 隔离静态handler/资源 | PASS | [ISOLATION.json](validation/ISOLATION.json)：仅静态白名单，GET模型路由404、POST405、外Origin403，15资源逐份hash；工程库单一身份，旧库不操作 |
| 实际浏览器 | 受影响路径PASS，剩余时间表达争议单列 | [BROWSER_EVIDENCE](BROWSER_EVIDENCE.md)；不把单测或旧截图冒充最终验收 |
| npm audit --audit-level=high | FAIL：5 high/2 moderate/0 critical | [npm-audit.json](validation/npm-audit.json)、[DEPENDENCY_RISK.json](validation/DEPENDENCY_RISK.json)；现有开发工具链风险，不改旧lock凑绿 |

全量四组旧失败：

- D9：`D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs`，历史冻结当前文件哈希断言；[d9-historical.log](validation/d9-historical.log)。
- RCO-5-007：`FREEZE_HASH_MISMATCH:package-lock.json`；[rco-5-007.log](validation/rco-5-007.log)。锁文件本轮不改。
- C11 history：`C11_HISTORY_PROTECTED_CHANGED:AGENTS.md`；[c11-history.log](validation/c11-history.log)。AGENTS本轮原字节不改。
- C11 gateway：5测试受同一AGENTS历史哈希阻断；[c11-gateway.log](validation/c11-gateway.log)。D25专用无授权/费用/故障安全测试29条通过，不把这个旧阻碍报成模型网络探测失败。

`verify-governance-protection.mjs`另复现`GOVERNANCE_PROTECTION_ACTIVE_DOCUMENT_DRIFT:AGENTS.md`。历史保护校验84/119/7与账本链完整性通过，不等于上述旧活动哈希断言通过。旧D13重算动态账本快照的Manifest漂移已知，不改旧文件；本轮D25验证绑定冻结原字节与当前只读账本，不强行运行旧快照生成器制造假绿。

依赖风险处置：Vitest/mocker为本地开发测试runner的路径遍历；brace-expansion为工具链DoS；wrangler/miniflare的sharp/undici为开发运行时与图像/网络工具风险。D25回环静态服务不启动这些开发服务，不接收图片、任意URL或不可信glob，浏览器产物不引入它们。兼容升级建议在新维护范围验证patched Vitest、brace-expansion、Wrangler/Miniflare及其子依赖，不能把本轮“路径不可达”当漏洞已修；不授权部署。旧报告3high/2moderate是快照，本次实际审计已为5high/2moderate。

一次必要独立视角复核已完成（d25_finite_review）：发现风险只有总FN数不能定位新漏项、账本读后写竞争、unresolved覆盖误通过、组件冻结非传递、raw/state/settle元数据可能不同。分别改为规范化义务风险、多进程OS独占锁加事务内SHA CAS、未解决覆盖不得整份通过、实际本地传递组件图冻结、HTTP/usage/费用与immutable raw一致核对。已补反例并验证。没有增加第二轮全面审计。

保护前后：84历史、119冻结、7归档；权威账本路径`C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl`，938行、782221字节、SHA `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`，tail `25eeae32f0e742fa48a92e727b58c7e486ab1de917eecc361d91a7494c99a539`。历史D15/D17共98行合法追加提示保留，本轮未写账本。新D25文件补窄范围.gitattributes原字节保护，不renormalize旧文件。

最终只读复核日志在本目录validation：freeze-verify.log、executor-read-only.log、history-verify.log、d19-verify.log、d25-diagnostic-verify.log均确定退出通过对应完整性检查；final-security.log扫描3384源/构建文件通过。执行器明确liveAuthorizationFileExists=false，16身份NOT_RUN、模型/grant/reserve/settle均0，账本SHA仍相同。完整性和Git同步不证明候选效果或独立人工真值。
