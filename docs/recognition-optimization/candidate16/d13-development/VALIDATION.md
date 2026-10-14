# D13 验证与边界

基线：80aee0914c5fda09225b21603f9b4bce3a6ae3f4，起始工作区干净，HEAD/upstream/远端一致。最终同步 SHA 见本轮交付提交和最终回复。

| 检查 | 实际结果 | 范围 |
|---|---|---|
| candidate16-d13.check.mjs | PASS 12/12 | 12 条 wire 正例与关键反例、空匹配/重复、条件/依赖/证据/别名、typed 材料/双向时间/修订、全部 24 旧 raw |
| candidate16-d13-package.check.mjs | PASS 5/5 | 冻结复建、漂移/重复/无授权/不确定状态阻断、分层选择与风险不抵消 |
| candidate16-d13-isolation.check.mjs | PASS 3/3 | HTTP API 关闭、Host/路径限制、新端口和页面 DB/网络边界 |
| D13 runtime.test.ts | PASS 8/8 | 真实 repository 闭环、失败与手动恢复、错误关系隔离、标题/事件修改、拒绝结构计数、保存等待、全部录制接入 |
| D13 measurement.test.ts | PASS 4/4 | 阅读不少于 10 秒仍零编辑；缺完成证据不填正确；隐藏/空闲/等待/失败；排队前取时间 |
| prepare-candidate16-d13.mjs --verify | PASS | 12 完整往返、24 唯一身份、6 AB/6 BA、共用模型参数、组件/请求 SHA、不含 Expected、零派发 |
| verify-recognition-history.mjs --verify | PASS | 84 原保护、119 冻结文件、D7 组件、7 存档和完整账本链 |
| npm run lint | PASS | 最终 0 errors、8 原有 warnings；D13 新增 warning 已消除 |
| npm run build | PASS | TypeScript + Vite；已有大 chunk 提示，未部署 dist |
| npm run security:scan | PASS | 无新增敏感文件/凭证告警；未读取环境 Secret |
| npm run test | FAIL | 141 文件通过、5 失败、1 跳过；1487 测试通过、14 失败、1 跳过；另含无套件收集错误 |
| 失败相关文件串行复核 | 部分 PASS，仍 FAIL | 5 文件通过/1 失败；141 测试通过/8 失败；默认 5 秒限制未改 |
| RCO-5-007 历史测试 | FAIL 1/4，3/4 通过 | FREEZE_HASH_MISMATCH:package-lock.json；旧锁及断言未动 |
| 实际浏览器 | 核心场景 PASS | 无任务、事件修改与恢复、任务编辑、部分确认、拒绝、真实坏引用阻断和刷新；见 BROWSER_EVIDENCE |

最末一次合并定向命令：`node --test scripts/candidate16-d13.check.mjs scripts/candidate16-d13-package.check.mjs scripts/candidate16-d13-isolation.check.mjs`，20/20；随后 D13 两个 Vitest 文件 12/12。没有把计数当产品识别率。

实际命令输出在 validation-evidence，供审查 [全量失败](validation-evidence/test.txt)、[串行复核](validation-evidence/recheck.txt)、[最终定向](validation-evidence/directed-final.txt)、[产品测量](validation-evidence/runtime-final.txt) 及 [历史 RCO](validation-evidence/historical-rco.txt)。归档时仅统一 LF/去掉行尾空白，未删除失败内容或改测试结论。

## 全量失败逐层报告

裸 npm test 的失败有：旧 `scripts/verify-candidate15-d9.test.mjs` 被 Vitest 当其自身测试收集但没有 Vitest suite；旧 acceptance 的 candidate02 launcher 未设置 REAL_INPUT_CARRIERS_MANIFEST，落到 undefined 路径；其余 13 个测试触发默认 5000ms 超时。全量入口因 Vitest 失败，后续 Node/server/Worker 阶段没有运行，不能写 PASS。

不更改旧测试、超时设置或代码，按默认超时用 `--maxWorkers=1 --no-file-parallelism` 单独复核 6 个相关文件：Candidate11 runtime 15/15、Candidate13 D6 runtime 6/6、realInput runtime 30/30、D13 runtime 8/8、D13 measurement 4/4；realInput acceptance 仍有 7 个超时和上述 1 个 carrier 问题。D12 已记录同类旧文件超时，但**本轮多出来的超时数量尚未逐一归因**，不能全称已证明无关。将它作为性能/测试维护待办，不影响已经通过的 D13 定向保存与隔离证据，不宣称全量可发布。

旧 D9 当前文件哈希/治理旧活动文档断言与 RCO 冻结失败保持历史意义；本轮新验证使用历史 Git 绑定，不修改旧 Expected、raw、结果、Manifest、锁或旧断言“凑绿”。

## 一次工程复核

同系列新视角审查员只读检查评分、确认与测量，提出 4 项：反向时间归属漏判、拒绝任务漏记、缺真实终结证据误计、排队时间污染。主实现者已补修并跑定向回归，详见 EXPERIMENT_AUDIT.json。没有第二轮独立复审，没有独立人工语义标签，不称真人真值。

## 不变项与交付检查

账本唯一位置与哈希在 FUTURE_BUDGET_CARD；仍 840 行、SHA ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea，appendRows=0。模型调用/grant/reserve/settle/真人试次均 0。默认候选、Workspace schema v8、依赖和旧库不变。

活动交接/路线/计划旧字节在 docs/governance/archive/2026-09-28-d13，并记录 SHA。本包全部实际请求及组件冻结不随 UI 交接更新；复建不匹配即失败，不能静默重写。提交前 staged diff/空白/敏感信息检查；Conventional Commit 后立即普通推送，核对 HEAD/upstream/远端并确认工作区状态。Git 精确结果放最终回复，不通过额外空提交追逐自身 SHA。
