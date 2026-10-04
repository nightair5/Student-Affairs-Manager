# 本地事实诊断与条件性首次展示：最终验证

2026-10-04。代码4598b59c7c695133c7532e7a05e6adf1b225ada8已提交立即普通推送。本轮新模型/grant/reserve/settle/账本写入0。旧候选/评分/Expected/raw/身份/Manifest/锁/断言不改，未新增依赖或升级v8。

| 检查 | 本轮结果 | 证据与边界 |
|---|---|---|
| 真实事实/条件性正反例 | 最终11PASS | [日志](paid-evidence/fact-followup/checks/targeted-final.txt)。全部12录制、独立不同写法及最小语义变更；真实Schema/公共转换/普通capture/正式事务/独立Repository。错时间/owner/依据/关系、未知资格、等待前置保留；强选坏任务阻断、正确独立事件可保存。 |
| 全量权威npm run test | 39组确定退出，33PASS/6历史FAIL，exit1 | [汇总](paid-evidence/fact-followup/checks/FULL_TEST_SUMMARY.json)、[精确失败与SHA](paid-evidence/fact-followup/checks/HISTORICAL_FAILURES.json)，独立server/worker/functions等均执行，未因前组失败漏跑。 |
| 当前产品 | Vitest976PASS/1既有SKIP，99文件PASS/1skip；9当前产品组全通过 | [原日志](paid-evidence/fact-followup/checks/vitest-product.txt)。全量运行后最后局部图阻断修正由最终11定向及浏览器复验覆盖，不冒充全量在最终小改后再次运行。 |
| lint | exit0，0错误8既有警告 | [原日志](paid-evidence/fact-followup/checks/lint-final.txt)，没有新增警告。 |
| build/TypeScript | exit0，1728 modules，659.88KB既有chunk警告 | [原日志](paid-evidence/fact-followup/checks/build-final.txt)，未改阈值或依赖。 |
| security scan | 产品边界4027、匿名文档证据边界4049，均exit0 | [产品原日志](paid-evidence/fact-followup/checks/security-final.txt)、[整理后实测记录](paid-evidence/fact-followup/checks/DOCUMENT_EVIDENCE_SCAN.txt)；不是npm audit全通过。 |
| audit | 5high/2moderate开发工具风险；production-only0 | [原审计](paid-evidence/fact-followup/checks/audit.json)/[生产审计](paid-evidence/fact-followup/checks/audit-production.json)，无旧lock修改。 |
| 最终浏览器 | 六来源、部分确认、两种故障手动恢复、只重读、刷新与独立值PASS | [实际浏览器](BROWSER_EVIDENCE.md)、[canonical检查](paid-evidence/fact-followup/browser/final/CHECK.json)。最终source bb002e92f3e1，控制台0；没有单测代替点击。 |
| 历史/冻结/账本 | 84/119/7保持；996链及SHA一致；原12请求不改 | [历史](paid-evidence/fact-followup/checks/history-final.txt)/[冻结宿主](paid-evidence/fact-followup/checks/freeze-final.txt)。没有新锁恢复或新grant，原现场无lock/HALT。 |

六历史失败仍为d19-diagnostic/vitest-d17-history的D17_SCORE_LEDGER_DRIFT；d9-historical的D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs；rco-5-007的FREEZE_HASH_MISMATCH:package-lock.json；c11-history/c11-gateway的C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。本轮没有新carrier调用错误/Node收集失败/5秒超时，没有排除套件或提高timeout。旧账本完整快照与合法追加冲突不通过改断言消除。

审计涉及Vitest/mocker、Wrangler/Miniflare、brace-expansion、sharp、undici等开发工具。当前静态回环录制入口不启动Vitest UI/Miniflare通用代理或任意图片转换；production0不等于开发工具无风险。兼容修复需版本化活动lock并重新冻结相关实验、配套工具回归，本包不得改旧冻结lock。此前可达性记录保留，不循环全仓审计。

一个必要独立视角复核发现动作/证据/modality/父项及反向时间关系漏检，已补新代码和反例；随后局部图隔离测试证明坏任务不能拖住正确独立事件。它是工程复核，不是独立人工真值。证据整理脚本中source关联字段误读已按Run→SourceVersion→Source真实图修正，最终CHECK全通过，没有修改浏览器输出造通过。

原v11 C17 2/6、C19 1/6及MIXED_PROGRESS不改。新后验最小事实C17 4暂定通过/2错、C19 5暂定通过/1UNKNOWN不是新版模型效果。S05渠道、自由描述及真人口径不补满分；6来源5confirmed/1partial，4闭合active0/2缺失，旧partial布尔与canonical分列。

检查输出原字节及SHA保留在[FILE_SHA](paid-evidence/fact-followup/checks/FILE_SHA.json)，原终端日志没有裁剪重写。Markdown/代码正常检查；git diff --check仅提示四份原日志lint-final.txt、targeted-final.txt、vitest-d17-history.txt、vitest-product.txt的末尾空行，原字节及SHA保留。后续文档边界提交推送后核HEAD/upstream/远端/工作区，运行页面的历史HEAD标签与实际源码hash明确分开。

## 前次原批完成与6820产品验证（历史保留）


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
