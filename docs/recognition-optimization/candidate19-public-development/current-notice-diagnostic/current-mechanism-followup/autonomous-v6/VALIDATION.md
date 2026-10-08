# 本轮验证、费用与保护

2026-10-08。独立组全部确定退出，未改旧断言/锁/Expected/raw/分数，未排套件或全局提高timeout。[测试完整汇总](TEST_EXIT_SUMMARY.json)。

| 检查 | 实际结果 |
|---|---|
| 定向真实公共链 | authorityObservedProjection9例与原endpoint5例通过；真实4wire、假ID/错日期/错值/foreign/无关引用、前置矛盾及有意义遗漏 |
| lint | exit0，8既有warning |
| build | exit0，旧chunk-size warning；无新依赖/v8升级 |
| security:scan | exit0；产品验证4663文件，最终含新证据扫描4699文件，无Secret入Git |
| npm run test | **exit1**；9现产品、24安全、3历史组通过，6旧历史组失败，不称全量全绿/发布完成 |
| server | 本次exit0；旧随机bad port风险单列 |
| 保护 | 84/119/7保持，合法追加完整链由只读reader核 |
| 新批现场 | audit CONSISTENT；4SETTLED0UNCERTAIN，1grant4reserve4settle，4raw SHA一致，无HALT/锁，读取不派发不写账本 |
| 用户资产 | handover/15审计共16个原SHA相符；handover未跟踪、审计仍忽略，不提交资产 |

旧6失败：d19-diagnostic/vitest-d17-history为D17_SCORE_LEDGER_DRIFT；d9-historical为D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs；rco-5-007为FREEZE_HASH_MISMATCH:package-lock.json；c11-history/c11-gateway为C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。均本轮前已有，不改锁/断言凑绿。既有audit5H2M/production0不称清除。本轮不是发布，测试临时目录没有删除授权/封存现场。

账本1026→1035，SHA **eee9d8f7b1194306b2a8da84a258b0705d3ef46830cb3bec7f87864286891df7**；仅本批9合法追加。原1026 SHA489da37a7b83c2d3d6c00d8f2ef949e6d3fae4f8e9e250e5bac7ca80a84ec278及996/1000/1009/1015/1024前缀保持。原义务8批0SETTLED1UNCERTAIN7NOT_SENT、单权威8批2SETTLED1UNCERTAIN5NOT_SENT及公开封存不恢复。没有新请求特定材料，不循环查供应商。原8/16封存字节核验保留。

grant前核官方deepseek-flash/Responses路由、峰价及上下文/8192输出上界：保守1,048,576输入、0.3/1.2美元每百万输入/输出，单元US$0.324404、4请求US$1.297616、分配1.30，共享包上限6/16。不按字节估token，不靠缓存/短输出。[官方价格](https://api-docs.deepseek.com/quick_start/pricing/)、[Responses](https://api-docs.deepseek.com/guides/responses_api/)。
[实际执行](EXECUTION_SUMMARY.json)：input21198/output12775/cached13056/total33973；非缓存峰价内部保守结算 **US$0.021691**，服务商实扣NOT_OBSERVABLE。4SETTLED，零retry/repair/verifier/探测。4小时窗口已过，余量不继续。

原9b73656e生成快照/Manifest315144fc.../identity f5bb170d.../请求及raw保持。后续产品漂移使原付费gate拒绝是正确保护，不改Manifest。只读reader不能替代dispatch gate。28源文参照不改，0确认正确/1错误/3UNKNOWN不是已知总体0%或25%准确率；人工纠正不计首次正确。

前两提交9b73656e（局部保护）、6aa3550f（实际通知冻结与执行）均立即普通推送。后续fix交付公共表示收口/裁决/浏览器，最终HEAD/upstream/live remote另核；构建base不是最终Git HEAD。不合并、不部署、不换默认。工程切片已验但全量旧失败仍未解决。
