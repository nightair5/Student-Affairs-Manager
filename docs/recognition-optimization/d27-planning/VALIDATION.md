# D27 验证及准确的失败边界

所有命令使用当前 `candidate11-checks.mjs` 的受控环境，不读取根.env/Secret，不派发模型、不写账本。未改锁/旧断言/Expected/raw或全局timeout；各独立组跑到确定退出。没有生产部署/云CI运行。

| 检查 | 结果 | 版本和证据 |
|---|---|---|
| D27领域及计量反例 | 12/12 PASS | personalPlanD27.test.ts；共享容量、事件/课程、依赖、无截止、估计、循环、锁定、源版本CAS、过期预览、幂等、原子失败、元数据污染、导出roundtrip、缺失计量和重试基线 |
| 最终当前产品 | PASS，9组 | CHECKS_current-product.json；Vitest93文件通过/1旧跳过，927 tests通过/1旧跳过；server、worker、worker-d26、functions、time parity均确定退出 |
| 本轮全量 | FAIL，34组30PASS/4历史FAIL | CHECKS_test.json：安排代码final07时执行，产品926pass/1skip、安全534pass；后续计量增加1反例及状态文案变更，最终相关产品9组重跑927pass/1skip，不声称已重跑未变全量 |
| lint | PASS，0error/8既有warning | CHECKS_lint.json / LINT.txt；本轮无新增warning |
| typecheck/build | PASS | CHECKS_build.json；约657kB主chunk仍有500kB提示，未通过改阈值隐藏警告 |
| security scan | PASS | CHECKS_security.json / SECURITY.txt；不等同依赖漏洞清零或生产认证安全 |
| npm registry只读audit | FAIL，5high/2moderate | NPM_AUDIT.json；0critical，未执行audit fix/升级/改锁 |
| 历史保护 | 保留，需历史追加解释 | HISTORY_VERIFY.json：84/119/7，938行，旧98行合法追加提示沿用，本轮零追加 |
| D19离线verify | PASS | D19_VERIFY.txt；旧结果诊断，不是新质量 |
| D26冻结原字节和Git快照 | PASS（快照） | D26_SNAPSHOT_VERIFY.json，原145组件/7产物/16请求保持，16NOT_RUN |
| D26活动工作树prepare/executor --verify | 正确拒绝 | D26_ACTIVE_VERIFY.txt / D26_ACTIVE_EXECUTOR_VERIFY.txt：FROZEN_COMPONENT_DRIFT_src/App.tsx。安排修改6个原图组件，不能直接从活动HEAD派发；须原快照宿主。未改Manifest/断言制造PASS |
| 真实浏览器及独立读回 | 见实际范围PASS | BROWSER_EVIDENCE.md；受影响路径最终复验、其余明确复用构建边界；不以单元测试冒充点击 |

四个历史失败原始日志分别：

D27证据目录新增窄 `.gitattributes -text` 规则，避免Windows自动换行破坏原字节SHA；仅两份原始测试/lint日志保留工具输出末尾空行，未修改历史属性或原始输出。暂存Git对象与证据索引逐文件原字节比对后提交。

- d9-historical：`D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs`。
- rco-5-007：`FREEZE_HASH_MISMATCH:package-lock.json`。
- c11-history和c11-gateway：`C11_HISTORY_PROTECTED_CHANGED:AGENTS.md`。

这些起点即有，日志保留于HISTORICAL_*.txt；本轮上述锁和旧文件无修改，不能归作新安排故障，也不能写全量PASS。当前正向冻结测试建立新TEMP包的PASS不等同旧活动D26包可派发。

依赖风险仍在开发/部署工具链：brace-expansion、undici、sharp、miniflare、wrangler为high，vitest/@vitest/mocker为moderate。需检查实际调用/暴露条件，不能仅“开发依赖”就宣称不可达。当前loopback匿名Host只给固定静态文件，模型/外部路由403；这减少当前入口暴露面，不修复工具链漏洞。兼容维护承接D26方案：在单独维护边界验证wrangler同主版本和Vitest变更，仍需与受保护旧锁、历史冻结快照分开，不在本轮强行改锁。

本轮没有新增功能失败。工程过程发现并修复：隔离库前缀拒绝、固定事件标题漏匹配、日历旧独立建议、课程canonical未刷新、计划读回后计量重开、手动重试覆盖初始基线、未知恢复计数填0、pending状态文案。旧过程原证据保留，最终影响路径有明确复验；不声称所有界面或所有关系已经成熟。
