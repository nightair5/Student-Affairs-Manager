# 当前版本验证

2026-10-06。代码交付9c8159bac227e6c4e1fe44cb7e2370bda850d89c；最终浏览器同代码构建9c8159bac227/source2531a3ab070f。后续只更新证据和短交接，不改变产品构建。

| 本轮实际运行 | 结局 |
|---|---|
| 定向Vitest：sourceInformationPreview、singleAuthorityProduct，单worker | 10/10 PASS、确定退出；逐字支持/跨对象来源/假依据/重复/已有属性/当前版本/捕获→正式事务→独立读回 |
| 只读现场Node：single-authority-observed.node-test.mjs | 4 PASS、确定退出；匿名离线账本，无权威写入 |
| npm run test:product | 9独立组全部PASS、确定退出：timezone/contract/time-contract/Vitest/server/worker/worker-d26/functions/time-parity；新定向套件已进入现行产品组 |
| npm run test:safety | 24 PASS记录全部确定退出（含1个匿名carrier构建，不冒充24测试套件）；必要REAL_INPUT_CARRIERS_MANIFEST沿现行入口继承 |
| npm run lint | 0error，8既有warning；未增加警告 |
| npm run build | exit0；既有大包警告保留，不升级依赖/锁/Schema |
| npm run security:scan | 代码交付4516文件PASS；新增交接/证据后4526文件PASS，exit0 |
| 最终浏览器6872与独立值 | 见BROWSER_EVIDENCE，首屏/检查点失败/正式失败/只重读恢复/刷新通过；模型POST403、console=[] |
| 历史保护与专用只读reader | 84保护119冻结7归档原字节保持；1015完整链，1009授权原前缀/996/1000保留；16封存文件SHA完全一致 |

[产品组结果](CHECKS_current-product.json)、[安全组结果](CHECKS_current-safety.json)保留每独立进程status/error及本机日志。文件SHA见[EVIDENCE_INDEX](EVIDENCE_INDEX.json)。lint/build/scan/10定向/4只读Node的确定退出在本轮工具输出与代码交付说明中可查，不伪造不存在的逐命令日志。

完整旧历史矩阵本轮未重复运行。复用[上一轮VALIDATION](../VALIDATION.md)的6历史失败：D17账本快照（d19/Vitest）、D9受保护hash、RCO-5-007旧锁hash、C11历史/gateway AGENTS hash。audit5H2M/production0是既有依赖风险状态，未重新npm audit，不宣称新全绿。未改Expected、raw、旧成绩/Manifest/identity/锁/断言，未排除套件、全局提高timeout或放宽付费gate。

history verifier正常提示HISTORY_PRESERVED_LEDGER_APPEND_REVIEW_REQUIRED：175条相对最初基线追加不是本轮写入；最近6条为前一授权批原grant/reserve/settle，专用reader定位并验证。当前1015行SHA25f32a95eb28a264c3bec20500cf0b439ab33ad445dddfe8eba243c469c948d9，前后未变。当前模型/grant/reserve/settle0，旧03不确定现场不恢复。只读reader不是dispatch安全gate。

回退可单独revert产品提交；不会将已结算/不确定传输变成未发生。未碰旧用户库/Secret明文/依赖/v8/历史冻结；用户handover及15本地审计资产保留。真人/Holdout/default替换/合并/部署NOT_RUN；四真人指标NOT_OBSERVABLE。
