# 验证与边界

2026-10-04，公共material-channel-role-grounding-1.2.0。无新依赖、v8迁移、Prompt/候选/评分改变；旧锁/断言/Expected/raw/Manifest/身份不改。

- 定向真实Schema/公共转换/正式Repository：materialChannelGrounding42 + sourceContractV4 18 + conditionalNonActionProduct6 = **66 PASS**。
- 4先固定正反场景：修前2/4、修后4/4，wire SHA一致；12旧角色回归12/12。新4来源不是付费身份或模型样本。
- 全12旧raw：只读宿主CONSISTENT，12SETTLED/0不确定/无遗留锁，唯一grant耗尽；所有raw与起点Git原字节一致。新旧首次展示事实及后验诊断逐份deepEqual。[证据](ALL_12_DIAGNOSTIC.json)不改原v11结果。
- lint：0错误，8既有React refresh/hooks等警告；build/typecheck PASS，既有500KB包大小提示。
- npm run test：39独立组全确定退出，33 PASS、6既有历史FAIL；产品100文件/1018 PASS、1原SKIP。server、worker、worker-d26、functions、time-parity、安全执行器及carrier等适用组均执行。[完整分组摘要](TEST_SUMMARY.json)。
- security scan PASS；最后结果及本机原日志见本轮同步回执。未以HTTP服务可达冒充识别或保存正确。
- 实际浏览器6来源PASS：原子保存/局部阻断/两故障恢复/刷新/独立owner和依据检查见[BROWSER_EVIDENCE](BROWSER_EVIDENCE.md)，不是用单测代替。

## 既有全量失败

| 组 | 保留的错误 |
|---|---|
| d19-diagnostic / vitest-d17-history | D17_SCORE_LEDGER_DRIFT，旧账本快照与合法历史追加不兼容。 |
| d9-historical | D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs。 |
| rco-5-007 | FREEZE_HASH_MISMATCH:package-lock.json；工作区CRLF/Git LF，无Git diff。 |
| c11-history / c11-gateway | C11_HISTORY_PROTECTED_CHANGED:AGENTS.md，活动治理文件已合法版本化，旧冻结断言保持。 |

原始日志在`.data/candidate11/checks/test/Asia-Shanghai/`；本轮完整日志`.data/candidate19/polarity-scope/full-test.log`。未排除失败套件、改旧断言/锁或全局提高timeout；没有本轮新测试失败，不称全量全绿。

## npm audit当前只读结果

仍5high/2moderate，具体组件更新需与当次报告对应，不能照抄此前包名：high是brace-expansion、sharp、undici、miniflare、wrangler；moderate是@vitest/mocker、vitest。`npm audit --omit=dev --json`为0。本机原件`.data/candidate19/polarity-scope/audit.json`及`audit-production.json`。

这些来自开发测试/Worker模拟工具链；本轮静态回放没有启动Vite暴露服务或Wrangler/Miniflare代理，也没有给sharp读取非可信图片或付费派发。此说明只限定本轮路径，不声称开发链对所有输入不可达，也不拿production-only0证明整个产品无风险。

兼容维护建议：另获依赖维护范围后，在新锁版本中核brace-expansion/sharp/undici及Wrangler/Miniflare传递补丁与相应Node版本，运行工具/Worker回归；Vitest工具所报修复涉及major，单独处理兼容性。旧冻结lock原字节保留，不在本包npm audit fix或安装依赖。

## 保护

84历史保护/119冻结/7归档PASS；完整996行链SHA c58231633b8da1b87e9106f92d0dd457f00e4789e5e5fa03de780fb377dc8750前后相同。只读保护器HISTORY_PRESERVED_LEDGER_APPEND_REVIEW_REQUIRED：156行是已定位历史合法追加，不是本轮写入。
原C19包/身份在只读快照宿主验证、原12raw与Git起点逐字核对，证据见[PROTECTION_AND_BUILD_PROOF](PROTECTION_AND_BUILD_PROOF.json)。模型/grant/reserve/settle/ledgerWrites0；费用0，无新许可需求。
真人四指标NOT_OBSERVABLE、独立Holdout/default替换/合并/部署NOT_RUN。
