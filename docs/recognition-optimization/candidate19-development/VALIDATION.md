# 验证结果与明确剩余项

2026-10-04。最终代码ce97b325f38897e87a55b63ddaea9470e8ea4156。付费、Secret分支均未进入；只读保护/旧raw/账本核验。没有新增依赖、v8迁移或修改旧锁/断言。

| 检查 | 实际结果 | 可检查证据 |
|---|---|---|
| 生成契约、确认、来源生命周期、测量定向 | 5文件45 PASS | [日志](evidence/targeted-vitest.log) |
| 参照/选择器+12单元执行器 | 8 PASS；合法变体、最小语义反例，两臂对称；13故障位置及假传输12次 | [日志](evidence/targeted-node.log)，只用临时假账本/假传输 |
| 最终普通产品组 | 9独立组PASS，Vitest954 PASS/1 SKIP；Node/server/worker/worker-d26/functions/time-parity全部确定退出 | [汇总日志](evidence/final-product.log)，本机完整子日志.data/candidate11/checks/current-product/Asia-Shanghai/ |
| 全量权威test | 39组33 PASS/6历史FAIL，无unavailable；并非全量PASS | [完整汇总](evidence/full-test.log)。后续两处事件UI修复后仅受影响最终产品9组重跑通过，不冒称全量是在最终代码再跑 |
| lint | 0 error/8既有warning | [日志](evidence/final-lint.log)，FastRefresh和旧effect引用警告 |
| TypeScript/build | PASS，659.88KB主chunk警告保留 | [日志](evidence/final-build.log)，没有提高阈值 |
| security scan | PASS | [日志](evidence/security.log)；文档交付边界另扫描 |
| browser/隔离/独立读回 | 受影响实际路径PASS，错误语义仍明确阻断 | [浏览器证据](BROWSER_EVIDENCE.md)、新的loopback库；旧库未触碰，403实时派发机械关闭；现行安全组及真实Repository链覆盖隔离 |
| 84保护/119冻结/7归档 | PASS | [只读核验](evidence/HISTORY_VERIFY.json) |
| 全部16旧raw新诊断 | READ_ONLY_VERIFIED，原模型结果不动 | [verify](evidence/OLD_RAW_REPLAY_VERIFY.json)，原诊断在source-contract-consistency |
| 原D26快照/现场 | 原145/7/16、raw16/receipt33、16SETTLED，audit CONSISTENT | 起点复用原readonly host，未dispatch；旧执行包结果保留 |
| 本批冻结/host | 12NOT_RUN；无auth/lock/halt/state/目录；本批账本0行 | [host](evidence/HOST_READ_ONLY.json)、[零调用报告](ZERO_CALL_REPORT.json)、[无授权拒绝](evidence/NO_AUTHORIZATION_REFUSALS.json) |
| npm audit | 5 high/2 moderate，未修，不称PASS | [原JSON](evidence/NPM_AUDIT.json) |

## 历史失败与维护

[精确片段及原日志SHA](evidence/HISTORICAL_FAILURES.json)保留6组：d19-diagnostic、vitest-d17-history为`D17_SCORE_LEDGER_DRIFT`（旧全账本快照不接受合法追加）；d9-historical为`D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs`；rco-5-007为`FREEZE_HASH_MISMATCH:package-lock.json`；c11-history/c11-gateway为`C11_HISTORY_PROTECTED_CHANGED:AGENTS.md`。本轮前已存在，不改旧锁/断言/Manifest制造通过。

现行入口将Vitest与Node发现分开、使用匿名carrier构建器、逐组限并发并全部汇总。本轮没有新的旧Node收集、carrier环境或5秒超时。没有排除旧套件、全局加timeout，完整测试仍EXIT1。

audit既有7项为Vitest/@vitest-mocker、Wrangler/Miniflare、sharp、undici、brace-expansion，当前lock的dev工具链。此回环录制服务未启用公开Vitest UI、Miniflare上游代理或任意图像转换，但开发工具处理不可信mock/网络/图像时风险不能称不可达。后续隔离依赖维护优先同主版本兼容补丁及配套Wrangler/Miniflare；audit推荐Vitest major不能盲升。需另版本lock/冻结基线和相应回归，本轮不audit fix或改旧冻结lock。[既有详细可达性与兼容建议](../source-contract-consistency/VALIDATION.md)继续有效。

## 仍未证明的效果

本轮6份provisional工程参照可以证明程序按合法Schema工作和发现反例；没有Candidate19模型输出，不能证明模型会如实填coverage、资格、主实体、材料或时间。12身份全部未运行，不报0%或100%。旧raw转换率也不替代整份正确率。完整取消/替代普通v8表示、S08参照争议、未裁决标题/描述/泄漏保留；不因为一项领域限制扩大成重构或伪造满分。

实际工程测量有完整read-only0active、失败/重试成本与edit→commit→readback，但恢复/未闭合区间按缺失保守处理，未证明真人省时。任务/事件组结构变更计量仍有粒度限制，明确记录，不回填measurement3.2/low-edit-v2。真人四指标全部NOT_OBSERVABLE。

文档/冻结不是新业务代码，提交前核diff/证据SHA/security/当前冻结与历史保护，不重复已通过的无关全量组。.gitattributes只为本批新目录追加-text规则，防止Windows checkout转换身份/读回原字节；旧路径规则未改。最终本地/upstream/远端SHA在交付现场核对。
