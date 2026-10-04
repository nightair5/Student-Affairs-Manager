# 本轮验证记录

2026-10-04。代码为浏览器source6bcdfd77aa2b对应字节；相关检查后无代码变化，不循环历史矩阵。

| 验证 | 实际结果 |
|---|---|
| 定向真实wire/转换/正式链 | materialChannelGrounding38、sourceContractV4 18、conditionalNonAction6，共62PASS。覆盖12种角色、顺序不变、真实Repository/idempotence、精确及未知时间、跨来源/错对象、S05原争议。 |
| npm run lint | exit0；0错误、8既有警告。[日志](checks/lint.txt)。 |
| npm run test | exit1；39独立组全部确定退出，33PASS、6旧历史FAIL。[组汇总](checks/FULL_TEST_SUMMARY.json)。产品Vitest100文件/1014PASS，1既有SKIP；server/worker/functions、carrier与执行器组已独立执行，不因首组失败漏跑。 |
| npm run build | exit0，tsc+Vite；既有大chunk警告。[日志](checks/build.txt)。 |
| npm run security:scan | exit0；最终含新增证据扫描4165文件。[日志](checks/security.txt)。 |
| npm audit --json | 5high/2moderate，审计退出1。[完整记录](checks/audit.json)。 |
| npm audit --omit=dev --json | 0漏洞、exit0。[生产依赖视图](checks/audit-production.json)，不代表开发工具链无风险。 |
| 只读历史保护 | 84/119/7保持，996链SHA不变；156合法旧追加单列，[结果](checks/history-final.json)。 |
| 原12现场、冻结与构建 | CONSISTENT、12SETTLED、无halt/锁；原候选/raw/身份/分数精确Git字节不变；原snapshot冻结完整校验，[证明](PROTECTION_AND_BUILD_PROOF.json)。 |
| 实际浏览器及隔离 | 7来源/新6833新库，正式失败→手动恢复、已提交→只重读、partial及刷新；最终canonical关键值/关系，[CHECK](browser/CHECK.json)。console error/warn0。 |

6旧失败保留[原日志摘录](checks/HISTORICAL_FAILURES.json)：d19-diagnostic、vitest-d17-history为D17_SCORE_LEDGER_DRIFT；d9-historical为D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs；rco-5-007为FREEZE_HASH_MISMATCH:package-lock.json；c11-history、c11-gateway为C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。未改旧断言/锁/Manifest、未排除套件、未全局增加timeout。不能表述全量全绿。

audit可达性仍是开发工具：Vite/Vitest、@vitest/mocker、miniflare/undici/Wrangler链，不是root production-only包。Vite开发服务器若对不可信网络开放、mocker接收不可信测试路径、Miniflare允许不可信请求会有相应可达风险；当前内部回放绑定127.0.0.1、固定静态GET白名单，没有部署或模型接口。不能因production-only0忽略工具链。兼容维护建议仍是单独维护分支升级相应上游补丁/再核Node24与Worker行为及全套检查，旧冻结lock保留；本包按授权未升级/新增依赖。审计结果只代表当前安装树与registry观测，不证明已部署资产无风险。

无新付费请求、无grant/reserve/settle、无人体试次。计量原版本保留，partial旧布尔异常与canonical真实终态分列；缺失null、不造editId、不把工程计时称真人省时。
