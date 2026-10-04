# 完整比较及最终产品验证

2026-10-04。恢复代码5d395c3a7dbd6e0d2257ce275f415941b592768f；产品代码6abc47a8d19294ee63993c5f8d57ba5445be010e；均提交后立即普通推送。仅获准原10次续发/20账本行，随后工程0额外模型/账本写入。无Secret明文、旧用户库、新依赖或v8升级。

| 检查 | 实际结果 | 证据和限制 |
|---|---|---|
| 安全锁恢复定向Node | 新恢复7+录制加载2=9 PASS；冻结scoped executor原4另PASS | [9项日志](paid-evidence/completed/checks/new-node.log)，实际原子改名/缺日志/残留guard/活进程/孤立写入/发送未决均有反例；一次独立视角复核后补实质测试。 |
| Schema→公共转换→评分/正式确认链 | 新支持转换6+原source contract18+否定转换5=29 PASS | 新测试实际raw06/10、不同写法、错owner/scope/值/图反例、缺事件不补猜，原冻结测试不动。 |
| 全量权威npm run test | 39组确定退出：33PASS、6历史FAIL | [完整汇总](paid-evidence/completed/checks/FULL_TEST_SUMMARY.json)、[6原日志/SHA](paid-evidence/completed/checks/HISTORICAL_FAILURES.json)。未因首个失败漏跑server/worker/functions。 |
| 当前产品 | Vitest965PASS/1SKIP，97文件通过/1skip；9产品独立组全通过 | [产品日志](paid-evidence/completed/checks/vitest-product.log)。本轮无新carrier调用错误、Node收集失败或5秒超时。 |
| lint | exit0，0错误8既有警告 | [日志](paid-evidence/completed/checks/lint.log)，无新增警告。 |
| build/TypeScript | PASS，1728 modules，659.88KB既有chunk警告 | [日志](paid-evidence/completed/checks/build.log)，未提高阈值或新增依赖。 |
| 安全扫描 | PASS，3986 source/build files | [终端记录](paid-evidence/completed/checks/security.log)，敏感许可/PRICE原件只留.data；npm audit不是全通过。 |
| 实际浏览器/独立canonical | S01/S02/S03/S05及事务失败、只重读、刷新PASS | [实际操作/构建](BROWSER_EVIDENCE.md)、[值检查](paid-evidence/completed/browser/CHECK.json)，没有单测冒充点击。 |
| 历史保护/原批冻结 | 84保护/119冻结/7归档保持，原Manifest及12请求不变 | [历史校验](paid-evidence/completed/checks/history.log)、[原批verify](paid-evidence/completed/checks/freeze-correct.log)。 |
| 执行/账本 | COMPLETE_DEFINITE_COMPARISON，audit CONSISTENT，996链/前缀有效；1grant12reserve12settle，0不确定 | [最终保全证明](paid-evidence/completed/COMPLETION_PROOF.json)。原AUTH/raw01/02字节不改，旧锁原子留存，没有第二grant。 |
| npm audit | 总体5high/2moderate既有开发工具链风险未修；production-only0 | [全审计](paid-evidence/completed/checks/audit.log)、[生产审计](paid-evidence/completed/checks/audit-production.log)。无audit fix旧锁，不称所有开发工具不可达。 |

历史6失败：d19-diagnostic/vitest-d17-history为D17_SCORE_LEDGER_DRIFT（旧完整账本快照不接受合法追加）；d9-historical为D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs；rco-5-007为FREEZE_HASH_MISMATCH:package-lock.json；c11-history/c11-gateway为C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。旧Expected/raw/锁/断言不改；没有全局加timeout或排除套件，全量exit1如实保留。

审计仍是Vitest/@vitest-mocker、Wrangler/Miniflare、brace-expansion、sharp、undici等dev工具链。此回环录制入口未公开Vitest UI/Miniflare代理/任意图片转换；生产依赖0漏洞不能推断开发工具全无可达性。兼容维护需另版本lock及新冻结、成套工具回归，不在本包盲升或修改旧锁。[此前可达性](../source-contract-consistency/VALIDATION.md)保留。

调用命令误写freeze-candidate19.mjs曾MODULE_NOT_FOUND；已改为权威candidate19-execution-host --verify并通过。浏览器部分确认等待弹层隐藏曾超时；页面已有2项保存，独立读回证明，不是产品失败。新定向测试开发中匹配错录制/错sidecar路径的失败已在新测试中纠正并复验，未改任何旧断言。

冻结v11整份通过C17 2/6、C19 1/6、MIXED_PROGRESS保留。新后验解码各6/6不是新模型正确率；标题/自由描述/泄漏未裁决。legacy子评分可观察C17 6/6、C19 4/6，Severe/Forbidden观测0，另2拒绝缺失；不是完整新风险或独立人工计数，缺失不填0。4来源浏览器中3confirmed/1partially_confirmed，2闭合时间/2缺失分列；旧partial布尔缺口不隐藏。四项真人NOT_OBSERVABLE，不因保存成功宣称语义正确。

git diff --check的3处提示仅在原字节日志lint.log、vitest-d17-history.log、vitest-product.log的末尾空行；保留证据原字节和SHA，没有修剪日志冒充原输出。其余代码/Markdown无空白错误。

后续文档HEAD和6820运行构建有意分开；最终HEAD/upstream/远端/干净状态现场核验。无新代码/疑点不循环重跑已过全量和旧浏览器矩阵。
