# D20 验证与边界

2026-09-29。D20 仍是部分交付；此文件不把旧失败或未跑的浏览器场景写成通过。

- 起点 HEAD/upstream/远端均为 `1da42573c7a6bd68592d00148d0a42ea79e1513a`，起点工作区干净；最终提交/远端需以交付后的 Git 核验更新。
- 历史只读保护通过：84 份受保护文件、119 份冻结文件、权威账本 938 行，SHA-256 `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`。D19 离线诊断只读通过；历史决策未变，账本零写入。
- D20 ReviewSession/安全重基线、有效大事件快照、工程测量分层及历史 UI 文案回归定向重跑：10/10 通过。最终 `typecheck`、`build`、`security:scan` 均通过；完整 `lint` 0 错误、8 条原有 Fast Refresh/Hook 警告。
- 全量 `npm test` 首轮执行到确定退出：Vitest 1520 通过 / 1 失败 / 1 跳过，失败为本轮改动影响的旧确认文案断言；恢复准确的“保存修改”说明后完整重跑到确定退出：Vitest 1522 通过 / 1 跳过，0 失败。全量命令仍因下列历史组返回失败，不写成全绿。
- 首轮编排其余组：server、worker、D19 diagnostic、time parity、multimodal lib、functions、C11 scoring、C11 preview 均通过；D9 frozen guard、C11 history/gateway 的旧保护哈希断言和 RCO-5-007 仍失败。旧断言/锁/Expected/raw 没有改动。完整日志位于 `.data/candidate11/checks/`，该目录不提交。
- `npm audit --omit=dev --audit-level=high` 为 0 漏洞；全依赖 audit 为 3 high / 3 moderate，集中在 Vitest、Wrangler/Miniflare 及其 sharp/undici 开发工具链。升级会影响旧冻结 lock 与兼容验证，本包未改；不把开发依赖风险说成生产可达漏洞已确认。
- D20 浏览器 p3/p5 完成的路径与 A–L 尚缺项见 [BROWSER_EVIDENCE.md](BROWSER_EVIDENCE.md)。工程自动化不是四项真人指标的样本；真人四项均 `NOT_OBSERVABLE`。
- 全新 p7 入口已在实际浏览器打开并核对匿名 `NOT_RUN` 初态；读回报告实际显示 `d20Engineering`、`checkpointToEditId: NOT_DIRECTLY_LINKED` 与真人 `NOT_OBSERVABLE`，初始 canonical 0/0/0/0。p7 是当前推荐入口；p3/p5 为已停用的本轮证据环境。

代码边界提交 `c93c959` 已普通推送当前远端分支；本结果文档提交后的完整 HEAD/upstream/远端 SHA 在最终交付中核对。浏览器未跑场景继续标 `NOT_RUN`。
