# D23 验证回执

2026-09-30。本轮相关验证已通过，全量存在 4 组历史冻结失败，**不是全量 PASS**。

| 检查 | 实际结果 |
|---|---|
| D23 身份、角色、源/刺激、同意、终态、裁决、预算外派发封闭和真实 Repository | d23Study.test.ts 22 项 + 历史 measurement.test.ts 4 项，共 26 PASS |
| 权威全量 `node scripts/candidate11-checks.mjs test` | 15 组均确定退出，11 PASS/4 历史 FAIL；CI allowlist/匿名 carrier 设置由入口继承，无 Secret/env 加载 |
| 全量 Vitest | 156 文件 PASS、1 skipped；1561 项 PASS、1 skipped。末次增加 partial 暂停恢复反例由上述定向组另外通过，不夸报全量数量 |
| lint | PASS，0 errors/8 原有 warnings；没有 D23 新警告 |
| build | TypeScript 严格检查及 Vite PASS；原有 >500KB chunk 提示保留，不调阈值遮掉 |
| security:scan | PASS，3235 source/build 文件；未新增依赖或读取 Secret 明文 |
| D23 本机隔离/构建器 | verify-d23-study PASS；8 materials/16 slots/16 records/4 DBs；来源、刺激、资产、最终 source SHA 一致 |
| 禁止模型/API/文件/外域路由 | 离线 HTTP handler 假请求及编译门校验；没有模型连通性探测或业务请求 |
| 只读历史与账本 | 84 保护/119 冻结/7 归档保留；938 行及前后 SHA 一致；98 行为以前合法追加，不是本轮写入 |
| D19 离线诊断 verify | 原证据保持，D17 A1/B2、固定分母；不是 D23 新模型成绩 |
| 浏览器 | 实际操作与独立 canonical/测量回读见 BROWSER_EVIDENCE；没有真人或工具替代伪证据 |

全量通过组：contract、time-contract、vitest、server、worker、d19-diagnostic、time-parity、multimodal-lib、functions、c11-scoring、c11-preview。依赖风险仍按先前兼容维护范围处理，本轮 security:scan 不是 npm audit 零漏洞声明。

## 4 组历史失败

| 组 | 精确失败 | 处理 |
|---|---|---|
| d9-historical | D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs | 与 D22 已记录相同；旧 guard 对后续活动文件断言不再适用，保留旧测试与文件 |
| rco-5-007 | FREEZE_HASH_MISMATCH:package-lock.json | 旧锁冻结失败原样保留，未编辑 lock/Expected/raw |
| c11-history | C11_HISTORY_PROTECTED_CHANGED:AGENTS.md | 活动 AGENTS 已在旧阶段合法更新，旧断言仍失败；新版只读历史校验通过 |
| c11-gateway | C11_HISTORY_PROTECTED_CHANGED:AGENTS.md | 同一旧前置断言；未调用模型或写账本绕过 |

本轮曾发现并修复 D23 入口遮挡、终态关闭、初始无 Workspace 保护判断、跨试次绑定及暂停恢复丢 partial；修后定向验证通过，没有保留新增 FAIL。一次 verifier 调用误传 `manifest.json` 作为目录返回 ENOENT；正确用 `.data/d23/final01` 重跑 PASS，不能把调用路径错误当产品故障。

## 原始记录与复核

全量各组日志在忽略目录 `.data/candidate11/checks/*.log`，test.json 每组 exit code 保留；D23 验证证据、截图/紧凑摘要进入本目录索引。BUILD_WITNESS 对应提交 f7b635cccb391204b178a09113f654e5e7fbe2f6、source c4758fcdad417eef61445e5d0017e24b0777226871e4fd51a0b1b3d466c55693；仅后续文档提交不会改变这个代码指纹。

权威账本：`C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl`，前后 938 行 SHA e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9。默认候选/Schema/依赖/历史许可未改，grant/reserve/settle/model/human 均 0。

Git 代码交付 f7b635c 已立即普通推送，并核本地/upstream/远端一致。结果提交同步状态以最终交付回执核对；本目录不会用自引用 SHA 假装提前知道最终提交。
