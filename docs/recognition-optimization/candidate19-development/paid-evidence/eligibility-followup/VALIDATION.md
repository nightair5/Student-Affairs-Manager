# 验证与未解决的历史失败

2026-10-04。[汇总](VALIDATION_SUMMARY.json)、[39独立组原摘要](TEST_SUMMARY.json)。产品实现最后一次变更后完成构建与实际页面回归；后续仅文档同步，不重复无关矩阵。

| 检查 | 实际结果 |
|---|---|
| 定向真实正反例 | 80PASS：14资格链路、18source contract、6条件禁止、42渠道；两合法与两语义反例同Schema/公共规则。 |
| npm run lint | PASS，0错误/8既有警告；未新增warning。 |
| npm run build | TypeScript/Vite PASS；既有chunk体积警告单列。 |
| npm run security:scan | PASS；没有Secret明文、真实用户材料、依赖/锁变更。 |
| npm run test | 39组全部执行到退出，33PASS/6历史FAIL，总命令exit1；当前产品1032PASS/1skip，server/worker/functions通过。不得称全量全绿。 |
| npm audit | 全部依赖5high/2moderate；omit-dev生产依赖0；未执行audit fix。 |
| 隔离/读回 | 新loopback/static录制入口、新IndexedDB身份，原子事务失败零事实、只读回恢复与刷新一致；图owner/依赖/事件引用有效。 |
| 历史只读 | 84保护/119冻结/7归档完整；原12raw Git原字节相同、候选/Manifest/身份/旧成绩不改。 |

六旧失败：d19-diagnostic和vitest-d17-history为D17_SCORE_LEDGER_DRIFT；d9-historical为D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs；rco-5-007为FREEZE_HASH_MISMATCH:package-lock.json；c11-history/c11-gateway为C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。锁文件工作区CRLF/Git LF、Git diff无变；未改旧断言或旧冻结来消除失败，也未排除套件或增大全局timeout。原始日志留.data/candidate11/checks/test/Asia-Shanghai/，错误与组状态在TEST_SUMMARY固定。

audit中的high属于brace-expansion、sharp、undici、miniflare、wrangler；moderate为@vitest/mocker、vitest。当前验收服务不运行Wrangler/Miniflare/Vite开发服务器或不可信图片处理，生产依赖报告0不等于开发工具无风险。建议在另一个明确授权的依赖维护边界核兼容patch并重跑工具链；npm给出的Vitest 5.0.3为major，不能在本包无授权升级。旧冻结lock保留。

账本本轮前后均996行，完整SHA c58231633b8da1b87e9106f92d0dd457f00e4789e5e5fa03de780fb377dc8750；相对旧快照156行合法追加已在既有核验定位，不是本轮追加。原12SETTLED/0不确定/唯一grant耗尽。[保护证据](PROTECTION_AND_BUILD_PROOF.json)明确model/grant/reserve/settle/ledgerWrites均0。旧D19只读verify的账本快照漂移如实FAIL，独立冻结原字节和完整链核验通过。

交付状态仅说明本轮资格转换与受影响普通产品路径已交付；不说明原模型准确率提升、全部历史通过或发布资格。没有新候选/请求/预算。Git最终同步回执保存在本机.data/candidate19/eligibility-proof/SYNC_RECEIPT.json，提交后核HEAD/upstream/远端及工作区；不把自己的提交SHA预填入提交正文。
