# D21 验证与保护

起点本地/upstream/远端均为 `6c3ee5d25fc81ebd75eb4569be08ddcfe407af11`，工作区干净。实现提交 `fba9589` 已普通推送；后续双标签修复与本文档提交以最终 Git 核验为准。

- 定向 `d20ReviewSession` 11/11、`d20Rebase` 1/1、`d21EventEvidence` 1/1 通过；包含过期清理、接管、同作者较新输入、真实 SourceVersion、检查点写失败、过期正式字段保存阻断，以及人工更名事件正式保存与独立读回。并行跑定向组时，旧 `d20Rebase` 5 秒单测发生超时；单独限并发重跑 3.59 秒通过，没有全局提高超时或排除套件。
- `npm run build` 通过；`npm run lint` 0 错误、9 警告（8 条原有、1 条本轮事件恢复 effect 依赖警告）；`npm run security:scan` 通过，扫描 3181 个文件。
- 全量 `npm run test` 已两次跑到确定退出，退出码 1。最新 13 个独立组中 server、worker、D19 diagnostic、time-parity、multimodal-lib、functions、C11 scoring、C11 preview 共 8 组通过；D9 historical、RCO-5-007、C11 history、C11 gateway 共 4 组仍因旧保护/哈希断言失败。Vitest 组本次为 1527 通过、1 跳过、3 个 5 秒超时（C11 runtime 1、realInput acceptance 2）；初次全量该组通过。两文件限并发复跑：C11 runtime 15/15 通过；realInput acceptance 84/86 通过，1 个旧 5 秒超时、1 个旧 candidate02 本地 carrier 子进程环境缺失（`realpathSync(undefined)`）失败。详见 `.data/candidate11/checks/test.json`、对应日志及复跑终端输出。不改旧断言、全局超时或锁来凑绿。
- `node scripts/verify-recognition-history.mjs --verify`：84 份保护、119 份冻结，账本 938 行 SHA-256 `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`，只读。`node scripts/d19-offline-diagnostic.mjs --verify`：D17 原 A=1/12、B=2/12，D19 未决 A=1、B=3；均不是本轮新识别成绩。
- D21 未读取 Secret、未发送模型请求、未创建 grant/reserve/settle、未写账本、未修改冻结回答或旧用户库。浏览器 p17 找到并修复人工事件更名的校验矛盾；p18 正式确认、独立读回和 p19 事务失败/手动恢复通过。最后又修正已正式保存事件仍显示“尚未正式确认”的文案，SSR 定向测试通过；重启 p18 后的浏览器复验遇到控制端超时，故文案最新构建的浏览器检查为 NOT_RUN。其余浏览器缺项明确见[证据](BROWSER_EVIDENCE.md)，不把工程回放写成真人指标。
