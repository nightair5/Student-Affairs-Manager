# 渠道角色与首次建议收口：验证

2026-10-04。代码0ce07b44204bff710861142297cd40f4073ac280已立即普通推送。新模型/grant/reserve/settle/账本写入0，不改旧冻结、锁、断言、依赖或v8。

| 检查 | 结果 | 原证据与范围 |
|---|---|---|
| 最终真实Schema/公共产品链定向 | 38PASS：新渠道14、原来源契约18、条件禁止6 | [日志](paid-evidence/channel-followup/checks/targeted-final.log)。14项含实际C19录制、独立渠道写法、错对象/对象扩展/否定/假设/跨来源反例、正式Repository及幂等、3种事件/时间表达和顺序不变性。 |
| 只读录制宿主 | Node2PASS | [日志](paid-evidence/channel-followup/checks/readonly-recordings.log)。只有只读export；snapshot/冻结/12确定结算验证，缺snapshot拒绝，cwd/账本/锁不变。复用原验证器，不放宽旧Manifest。 |
| 权威npm run test | 39独立组确定退出，33PASS/6历史FAIL，实际exit1 | [汇总](paid-evidence/channel-followup/checks/FULL_TEST_SUMMARY.json)、[完整日志](paid-evidence/channel-followup/checks/full-test.log)、[原失败及SHA](paid-evidence/channel-followup/checks/HISTORICAL_FAILURES.json)。server/worker/worker-d26/functions全部运行。 |
| 当前产品与安全 | Vitest989PASS/1既有SKIP，100文件PASS/1skip，当前各组通过 | 全量在最后去掉非阻断渠道整页提示、收紧对象边界并补1反例之前执行；最后代码由38定向、2Node、最终lint/build/scan及6831浏览器覆盖，没有冒称全量重跑。 |
| lint | exit0，0错误8既有警告 | [日志](paid-evidence/channel-followup/checks/lint-final.log)，未加新警告。 |
| TypeScript/build | exit0，1729 modules，既有chunk>500KB警告 | [日志](paid-evidence/channel-followup/checks/build-final.log)。无依赖/阈值修改。 |
| security scan | 代码边界4064files PASS；文档整理后另保存扫描日志 | [代码](paid-evidence/channel-followup/checks/security-final.log)、[最终证据](paid-evidence/channel-followup/checks/security-evidence.log)。不是audit全绿。 |
| audit | 5high/2moderate开发工具风险；production-only0 | [审计](paid-evidence/channel-followup/checks/audit.json)/[生产](paid-evidence/channel-followup/checks/audit-production.json)。 |
| 最终实际浏览器 | 6录制、部分确认、两类故障、仅重读、刷新、独立事实PASS；另匿名坏关系局部阻断浏览器PASS | [证据](BROWSER_EVIDENCE.md)、[CHECK](paid-evidence/channel-followup/browser/final/CHECK.json)。新6831构建/库，不使用旧6825验受影响渠道路径。 |
| 历史/冻结/账本 | 84保护/119冻结/7归档，996行完整链同SHA，12旧raw Git字节一致 | [历史](paid-evidence/channel-followup/checks/history-final.json)、[构建及原字节](paid-evidence/channel-followup/PROTECTION_AND_BUILD_PROOF.json)。 |

6旧失败：d19-diagnostic和vitest-d17-history的D17_SCORE_LEDGER_DRIFT；d9-historical的D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs；rco-5-007的FREEZE_HASH_MISMATCH:package-lock.json；c11-history和c11-gateway的C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。没有新carrier调用错误、Node收集失败或5秒超时；未排除旧套件/提高全局timeout/改旧断言凑绿。

开发工具风险涉及Vitest/mocker、Wrangler/Miniflare、brace-expansion、sharp、undici等。当前录制入口静态回环，不运行Vitest UI/通用代理/任意图片转换；production0不等于开发环境无风险。兼容维护仍需活动lock另版本和工具回归，不在本包盲改旧冻结lock。

已自行核对主/附属实体、回执/目的地角色及词法边界；新增“统计表照片”不能冒充“统计表”渠道反例。原scorer/selector/paid executor未改，不虚称本轮独立人工裁决或新的独立视角评分复核。读取原冻结组件须用原snapshot，当前App合法改动不能重算旧Manifest。只读加载器机械拒绝派发和账本append。

原v11 C17 2/6、C19 1/6和MIXED_PROGRESS保持；后验诊断4暂定/2错及5暂定/1争议保持。新渠道置null不增模型分数。6来源5完成1部分、4时间闭合2缺失，无编辑不造editId，四真人NOT_OBSERVABLE。新模型0，账本SHA c58231633b8da1b87e9106f92d0dd457f00e4789e5e5fa03de780fb377dc8750不变。

证据索引FILE_SHA256的65份原文件与Git暂存字节逐份一致。新增工具原日志4处尾空行使git diff --cached --check提示blank-at-EOF；保留日志原字节，不将其伪装为代码/文档格式错误，也不改日志凑通过。活动Markdown diff检查与全部本地链接检查通过。
