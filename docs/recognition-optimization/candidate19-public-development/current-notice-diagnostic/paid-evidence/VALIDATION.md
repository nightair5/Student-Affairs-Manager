# 验证结果及真实限制

2026-10-05。本轮产品源码先定向真实raw/角色/区间反例，再lint/test/build/scan。没有新增依赖、升级v8、访问旧用户库或改历史断言；没有排除失败、提高全局timeout。服务与浏览器只读录制，不触发新模型。

| 检查 | 实际结果与证据 |
|---|---|
| 定向真实产品链 | 3文件78PASS；新增currentNoticeOutputRepair18，真实4raw＋登记角色/日期区间/错owner反例。checks/directed.log |
| 新完成录制只读防护 | node --test scripts/current-notice-completed-readonly.node-test.mjs，3PASS。完成包在活动代码变更后仍核原Git blobs；UNCERTAIN/请求漂移拒绝，临时STATE不改，无AUTH/账本文件创建。进入现行权威Node组 |
| 全量权威 | node scripts/candidate11-checks.mjs test（等价npm run test）41独立组全部退出：35PASS、6FAIL、0UNAVAILABLE，exit1。checks/authority-41-groups.json、full-test.log；server/worker/functions均PASS |
| 入口新增后的汇总 | 41组产品/历史行为不受新增测试入口影响，明确复用；只读新增1组3PASS另执行。合计42组36PASS/6FAIL，不冒称42在同一次全跑。下一npm test会发现新增组 |
| lint | exit0、0error、8既有warning；新增脚本后再lint仍8；checks/lint-final.log |
| build | tsc/Vite exit0；669.79kB主chunk旧警告保留；新增测试/纯诊断脚本不改变已验产品；checks/build.log |
| security:scan | exit0；授权/核价/个人原件只本机.data；checks/security.log，提交前再次扫描 |
| 历史保护 | 84保护119冻结7归档PASS，完整1009行链PASS，原996/1000前缀不变；HISTORY_AFTER.json |
| D19 verify | exit1，D17_SCORE_LEDGER_DRIFT，旧末尾快照不能接受后续合法追加；原D19诊断与v7/v11结果不改，不强写旧快照 |
| 旧13录制 | verify-current-notice-recordings --verify：13份firstFactsEqual，modelCalls0/ledgerWrites0；OLD_RECORDING_REGRESSION.json |
| 新4后验转换 | diagnose-current-completed-recordings --verify：2可解码、2真实拒绝，modelCalls0；可解码不是整份正确 |
| 浏览器/隔离 | 普通首屏/部分确认/正式失败/手动重试/已提交只重读/刷新/独立owner与值实测；02故障前后及03日期PASS；03额外事件仍错，逐事件拒绝未实现；BROWSER_EVIDENCE.md |

六历史FAIL原错误分别：d19-diagnostic和vitest-d17-history为D17_SCORE_LEDGER_DRIFT；d9-historical为D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs；rco-5-007为FREEZE_HASH_MISMATCH:package-lock.json；c11-history/c11-gateway为C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。它们在起点已列为历史问题，保护核的是归档原字节/原账本前缀而非强行恢复当前活动文件。未改这些锁/断言。上轮server随机bad port本次没有复现，不能继续算成本次第7失败。

依赖package/lock零变化，复用上一轮npm audit 5high/2moderate、production0风险记录，不称本轮新跑audit或正式安全通过；风险可达性/维护建议既有记录仍适用。本包没有安装/升级依赖，不运行生产部署检查或wrangler publish。

明确限制：2/4原答图矛盾拒绝；03多余事件且普通事件整体保存缺逐个拒绝；02title重复/整体裁决未决；没有真人最终正确率或省时、没有未来新时段接受验收。ENGINEERING_REPLAY、计时缺失null、四真人NOT_OBSERVABLE。本轮targeted工程验收通过，全量仍exit1，产品首次准确率仍未达到可直接采用。

提交检查：代码与维护文档的staged diff --check通过。原始页面快照及命令日志保留尾部空白/空行，因此全文件diff --check报告这些取证格式告警；未改写采集正文消除告警。提交前scan再次通过4471文件，50份公共证据及4份rawHttpText SHA核验通过。审计目录8文件全部保留，7份原哈希不变，README期间新增内容保留且不提交。
