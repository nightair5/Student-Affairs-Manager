# D26 授权比较、产品回放与验证边界

2026-10-03 Asia/Shanghai。[结果](RESULTS.md)为当前入口；[本次原始日志及状态](authorized-20261003/VALIDATION_STATUS.json)与 [浏览器证据](authorized-20261003/BROWSER_EVIDENCE.md)属于本次最终源码。旧零授权工具验证仍保存在 evidence/，不改成付费后状态。

## 本次实际检查

| 检查 | 实际结果与边界 | 证据 |
|---|---|---|
| 完整 npm run test | 37项组结果，30 PASS / 7 FAIL；各独立组跑完，不因首失败漏跑 | [原汇总](authorized-20261003/validation/test-summary.json)及同目录 test-*.log |
| 修复后宿主与新投影定向 | 31宿主+8投影=39 PASS / 0 FAIL；实际终端结果，未重跑全部37组 | [状态记录](authorized-20261003/VALIDATION_STATUS.json)；命令 node --test scripts/d26-recorded-projection.node-test.mjs scripts/d26-execution-host.node-test.mjs |
| 最终 npm run test:product | 9组全部PASS；含Vitest、Node、server、worker、worker-d26、functions及时间契约，匿名carrier正确继承 | [汇总](authorized-20261003/validation/current-product-summary.json) |
| 最终 lint | exit0；0错误，8项原有警告，不写零警告 | [汇总](authorized-20261003/validation/lint-summary.json)、[日志](authorized-20261003/validation/lint-lint.log) |
| typecheck / build | PASS；既有大于500KB chunk提示仍保留 | [汇总](authorized-20261003/validation/build-summary.json) |
| security:scan | PASS，3770 source/build files；最终证据与文档写入后实际扫描 | [最终终端实录](authorized-20261003/validation/final-evidence-security.txt)；先前汇总/日志另保留，不回写旧数量 |
| npm audit | 5 high / 2 moderate，FAIL风险状态；没有升级、改锁或自动audit fix | [原JSON](authorized-20261003/AUDIT.json) |
| 冻结与执行只读校验 | 原145组件/7产物/16身份保持；16已结算、raw/receipt及完整链CONSISTENT，无锁/HALT/不确定单元 | [只读现场](authorized-20261003/HOST_READ_ONLY.json) |
| 历史保护 | 84保护/119冻结/7归档原样；合法追加提示保留，不能把提示简称零漂移全绿 | [JSON](authorized-20261003/HISTORY_VERIFY.json) |
| 最终普通产品浏览器 | 6798实际首次显示、事务失败/恢复、只重读恢复、刷新、独立读回和edit链已验；未重新声称旧A—L全验 | [逐场景](authorized-20261003/BROWSER_EVIDENCE.md) |
| 原D17与独立质量 | 原成绩及MIXED_PROGRESS不改；标题/自由描述/泄漏未人工核对 | NOT_ADJUDICATED；真人四指标NOT_OBSERVABLE |

## 相关新失败与历史失败分开

本轮 host CLI“无授权”测试原先指向真实主工作区，授权状态建立后误读实际STATE而失败。现改为临时目录复制同一宿主及其两个依赖；原断言未弱化，真实执行状态和账本未改。最终31项宿主与8项投影通过。完整测试没有修后重跑，不能把原30/37改写为31/37或全量PASS。

其余六个失败组：

- d9-historical：旧serve脚本SHA断言，与本次录制入口不同。
- rco-5-007：FREEZE_HASH_MISMATCH:package-lock.json，旧冻结锁检查。
- c11-history、c11-gateway：旧AGENTS SHA断言。
- d19-diagnostic、vitest-d17-history：D17_SCORE_LEDGER_DRIFT。D17历史结果保存的账本938行快照与本次合法追加后的971行不同；原D17冻结只读验证器把完整当前快照作为永不变化值。本次新增暴露的是旧验证器的追加兼容问题，不是D17 raw/Expected被改。原错误及断言保留，不写这两组PASS；将来另版本的只读历史观察器应核原前缀、原批事件与合法后缀，不覆盖旧分数。

本次最终产品9组没有carrier缺环境、旧D9收集或5秒超时失败；这只说明本次实际入口结果，不宣布所有旧环境问题已被永久修复。过程构建 draft 变量错误和provider状态污染在最终构建前修复，见浏览器过程记录。无新代码或新疑点后未重复全量旧失败组。

## 依赖风险与兼容维护建议

本次audit列出的7个“受影响包”含上游传播计数，不是7个独立产品攻击面。根据本次安装树及原JSON：

| 路径 | 风险和本轮可达性证据 | 兼容维护建议，尚未实施 |
|---|---|---|
| ESLint 10.8 → minimatch 10.2.6 → brace-expansion 5.0.9 | 嵌套/扩展模式可能耗尽CPU或栈；主要为本机lint输入路径。未见普通浏览器运行时导入，不声称所有输入均不可达 | 在独立维护中验证上游允许的5.0.12补丁；匿名恶意模式及lint回归后更新活动锁。旧冻结锁仍保留 |
| Vitest 3.2.7 / @vitest/mocker | redirect mock路径穿越/任意文件读取；测试/开发服务风险，不能向不可信网络开放。audit给出的修复属于大版本 | 公告修复下界4.1.11；audit建议5.0.3并不证明项目兼容。先独立验证测试配置、mock、Node版本及发现入口，不在本轮强升 |
| Wrangler 4.120 → Miniflare → sharp 0.35.2 / undici 7.29.0 | 本地Worker模拟器图像/网络处理风险；sharp的libheif问题及undici WebSocket、重试、TLS等问题取决于调用路径。未见进入React静态包，仍需保护开发服务和工具链 | 通过兼容Wrangler/Miniflare版本带入sharp≥0.35.4、undici≥7.29.1，并重新跑worker/服务/安全回归；不盲目覆盖子依赖 |

风险信息来自本次 [audit输出](authorized-20261003/AUDIT.json)，对应一手公告链接保存在各via项。只证明已识别路径和维护方向，未证明补丁已安装、全部不可达或发布安全。没有新增依赖、改package/锁、读取Secret明文或执行部署。

## 账本和证据保护

账本938→971，仅本批1 grant+16 reserve+16 settle，共33行。SHA-256 7b1d1935254a7d7830e1d03892d12895707b71107dfc1bfb611f3459e839367d；历史校验相对旧840行基线提示131条追加，包括此前98条及本次33条。执行只读审计核本批全部33条，完整哈希链一致。原冻结dispatchAuthorized=false/NOT_RUN字段不改，实际本机执行层另存SETTLED。

本机授权原文、AUTHORIZATION、PRICE_EVIDENCE及供应商账户材料不进Git。公开证据只含匿名来源、实际响应/usage、哈希、规范化状态及匿名工程库读回。CAPTURE_INDEX列数据文件SHA；本轮Markdown由Git版本管理。证据捕获命令模型请求/账本写入均0。
