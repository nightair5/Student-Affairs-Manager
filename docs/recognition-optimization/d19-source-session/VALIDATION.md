# D19 验证与保护

- 定向：D19 来源事务/坏修订恢复 3/3、测量 3/3、离线诊断/selector 2/2 通过。新增恢复反例确保 D19 新库可打开失败回答，同时坏端点 T3 被阻断、无关 T4 可选。离线诊断核 D17 固定24分母、D15 raw 24份可读；`--verify` 与生成文件一致。
- TypeScript、lint、build、security:scan 与 recognition:contract:check 通过；lint 保留 8 个已有 warning，build 保留 chunk 提示。
- 最终前置步骤说明改动后，TypeScript/build、lint、D19 来源定向 Vitest 3/3 和新隔离浏览器 `p18` 实测通过。另一次带 `--run` 参数的 `npm test` 实际仍会启动全编排，运行超过两分钟后主动中止；没有把这次中止写成通过。下述全量分组结论来自本轮较早的完整执行，最后一处改动只涉及页面解释文案。
- `npm test` 现在逐组执行并汇总，不再首个旧失败后漏测后续组；Vitest、server、worker、functions、time-parity、multimodal、C11 scoring/preview 通过。历史 D9 文件哈希失败 `D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs`；C11 history/gateway 的旧 `C11_HISTORY_PROTECTED_CHANGED:AGENTS.md`；RCO-5-007 旧 package-lock 冻结哈希失败仍在。原冻结文件/断言/锁均未为凑绿修改，因此全量 `npm test` 状态为失败，不写 PASS。
- `npm audit --omit=dev --audit-level=high` 生产依赖 0 漏洞；全量 audit 3 high/3 moderate，集中于 wrangler/miniflare/sharp/undici 与 vitest/@vitest/mocker 开发工具链。未新增依赖或改旧冻结 lock；下一兼容维护阶段需定位升级链及隔离回归。
- 历史只读校验在本轮开始通过：84 保护、119 冻结；权威账本 938 行，SHA-256 `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`。本轮末重新核验，不写账本。
