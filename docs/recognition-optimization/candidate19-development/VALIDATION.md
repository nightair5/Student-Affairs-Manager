# 最终产品验证与历史失败

2026-10-04。最终修复代码196e7a2ad33aa80776e9a3455cd8e0f7667cbb85。原模型批仅2次确定发送/结算，10未发送，保留锁；工程验证0额外模型/账本写入，不接触Secret明文或旧用户库。

| 检查 | 本阶段结果 | 证据/边界 |
|---|---|---|
| 原录制Schema→首屏→正式事务/独立读回，不同写法与最小反例 | 最终5个定向Vitest PASS | directiveDispositionProduct.test.ts；含提醒/条件/问句不误删 |
| 实际2份录制加载与SHA篡改 | 2项Node PASS | candidate19-recorded-data.node-test.mjs；不能把NOT_SENT伪造成录制 |
| 全量权威npm run test | 39组：33 PASS、6历史FAIL；全部确定退出，无unavailable | [完整汇总](paid-evidence/checks/FULL_TEST_SUMMARY.json)，[精确历史日志及SHA](paid-evidence/checks/HISTORICAL_FAILURES.json)；最终源码测试，无排除套件 |
| 当前产品9独立组 | 全通过；Vitest959 PASS/1 SKIP | [完整产品日志](paid-evidence/checks/vitest-product.log)，server/worker/worker-d26/functions/time-parity等在汇总内 |
| lint | exit0；0错误8既有警告 | FastRefresh及旧effect引用；本轮无新增警告 |
| build/TypeScript | PASS；1728 modules；659.88KB主chunk既有警告 | 没有提高阈值或新增依赖 |
| security:scan | PASS；最终文档/证据边界3947 source/build files | 敏感本地许可不入Git |
| 实际浏览器及canonical | PASS受影响路径，正式失败/读回失败/刷新分别核 | [实际操作与构建](BROWSER_EVIDENCE.md)、[独立值核对](paid-evidence/browser/FINAL_READBACK_CHECK.json)；模糊时间null、原答无人工补录；最终POST模型路由403 |
| 历史保护/本批冻结 | 84保护119冻结7归档保持；本批原Manifest/12身份SHA不变 | prepare verify的FROZEN_NOT_RUN是原准备矩阵状态，实际2发送以BATCH_STATUS计；合法账本追加136相对旧快照 |
| 权威账本/现场 | 完整链/原前缀合法；976行；batch5行；raw2/receipt5；lock保留、HALT null、audit CONSISTENT | [EXECUTION_REPORT](paid-evidence/EXECUTION_REPORT.json)和[错误](paid-evidence/EXECUTION_FAILURE.json)；0不确定发送，绝不把HALT null当可发送 |
| npm audit | 总体5high/2moderate既有开发工具链风险未修，不能称PASS；production-only exit0、0漏洞 | [生产依赖审计](paid-evidence/checks/AUDIT_PRODUCTION.json)，此前全审计原JSON仍在evidence/NPM_AUDIT.json |

6历史失败：d19-diagnostic/vitest-d17-history为旧D17完整账本快照不接受合法追加；d9-historical为旧serve-candidate15-d8哈希；rco-5-007为旧package-lock哈希；c11-history/c11-gateway为旧AGENTS哈希。原断言/锁/Expected/raw/结果均未修改。本轮没有新的carrier调用错误、Node收集或5秒超时，不全局加timeout；完整测试退出1如实保留。

audit涉及Vitest/@vitest-mocker、Wrangler/Miniflare、brace-expansion、sharp、undici等dev工具链。该回环录制入口未公开Vitest UI/Miniflare代理/任意图片转换；production-only0不证明所有工具不可达。维护建议仍是分支隔离的兼容补丁及Wrangler/Miniflare成套更新，Vitest major不盲升，另版本lock/新冻结与适用回归；本包不audit fix旧锁。[此前具体可达性](../source-contract-consistency/VALIDATION.md)保留。

只有1实际配对，原冻结整批准确率NOT_OBSERVABLE；局部诊断与后验程序转换分列。工程保存成功不直接等于语义正确。真人四指标NOT_OBSERVABLE，描述/标题/泄漏NOT_ADJUDICATED。失败及刷新计时缺失保留null，不能靠0填低修改成功。

代码提交00c50d557b8eeee9f8f657f38e9d89bb8976a9e3、196e7a2ad33aa80776e9a3455cd8e0f7667cbb85均提交后立即普通推送。后续文档提交与运行构建不同，最终本地/upstream/远端SHA在现场核。paid-evidence保存的是匿名录制/工程证据；授权原件和映射只在.data。

diff检查仅两份原测试日志vitest-d17-history.log和vitest-product.log的文件末尾空行提示；日志保留原字节与SHA，没有修剪证据冒充原输出。代码与Markdown未见空白错误。
