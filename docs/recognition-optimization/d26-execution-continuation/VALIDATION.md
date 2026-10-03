# 接续工具验证与真实边界

2026-10-03 Asia/Shanghai。仅新增执行/报告工具并接入现行安全测试发现入口；产品运行时、候选、Schema、adapter、scorer、参照和请求正文均未修改。按当前AGENTS第7节使用工具定向测试、相关lint、保护及敏感信息扫描；不把未重跑的产品全量或浏览器写成新PASS。

| 检查 | 实际结果 | 证据 |
|---|---|---|
| 最终工具定向回归 | 48 PASS / 0 FAIL / 0 SKIP | [原始日志](evidence/FINAL_TOOLS_TEST.txt)：host31、report8、current-checks9；Windows真实排他追加只对临时匿名账本执行 |
| 相关5文件ESLint | exit0，0错误/0警告，静默输出 | [空输出日志](evidence/TOOLS_LINT.txt)；含现行candidate11-checks新增组 |
| 敏感信息扫描 | PASS，3711 source/build files | [日志](evidence/SECURITY.txt)；不代表依赖风险清零 |
| 原快照prepare-d26 --verify | PASS | 本轮在独立4699d5c管理工作树执行；原16NOT_RUN；未重冻 |
| 宿主实际只读verify | PASS，16身份绑定、无授权文件/锁/HALT | [JSON](evidence/HOST_VERIFY.json) |
| 断点只读恢复 | NO_STATE，账本该批0行、本地raw/receipt0 | [JSON](evidence/HOST_READ_ONLY.json) |
| 实际零调用报告联调 | 16 NOT_RUN；发送0、不确定0；每臂8未知、率null | [报告](evidence/COMPARISON_REPORT.json)；无合成模型成绩 |
| 真实CLI缺授权prepare/dispatch | exit2，明确拒绝，无grant/发送 | [prepare](evidence/NO_AUTH_PREPARE.json)、[dispatch](evidence/NO_AUTH_DISPATCH.json)；拒绝发生在凭证加载/执行目录创建前 |
| 历史保护 | HISTORY_PRESERVED_LEDGER_APPEND_REVIEW_REQUIRED | [JSON](evidence/HISTORY_VERIFY.json)：84保护/119冻结/7归档；旧98行合法追加提示保留，本轮零追加 |
| 原D26 Git快照与产物 | PASS，145组件/7产物/16身份 | [JSON](evidence/D26_SNAPSHOT_VERIFY.json)；D27活动6文件漂移有意保留 |
| D19离线诊断verify | 本轮前置exit0 | 未改D19诊断；仅旧回答同标准诊断，不产生新模型效果 |
| Cloudflare Worker Builds | 13个相关Worker实际设置无Git连接 | [核验](CLOUDFLARE_BINDING_EVIDENCE.json)；生产推送前刷新；不以Pages列表替代Worker核验，设置0写、部署0 |
| 原D27产品/浏览器 | 复用原版本证据，本轮未重跑 | [原验证](../d27-planning/VALIDATION.md)、[原浏览器](../d27-planning/BROWSER_EVIDENCE.md)；产品没有新改动 |
| 新模型回放/真人/完整新比较 | NOT_RUN | 没有本批新付费授权、模型新输出或真人材料；四项真人NOT_OBSERVABLE |

现行安全入口已加入host/report两组，旧组没有删除或弱化。Linux将Windows PowerShell专用真实追加测试明确SKIP/NOT_AVAILABLE，30个portable宿主测试仍执行；本机Windows31个全部通过。未运行Linux，不把设计说明冒称Linux实测PASS。

## 一次独立代理复核

完成有限冻结契约复核及同一轮执行工具审查。发现并修复：价格证据SHA绑定还不足以阻止授权费率误填；response requestId/contentType也可能携带凭证回显。最终逐字段深比对价格，正文/嵌套转义/metadata反射在落盘前拒绝，非法UTF-8拒绝、正常BOM保留。审查代理实际重验两个反例2/2 PASS，最终主代理48项工具测试包含这两类；未新增审计循环。

其余已验：跨进程锁及锁内状态重读、唯一batch/grant、冻结ordinal、无授权/漂移/重复、grant/reserve/raw/settle每个断点、孤立账本/raw/receipt/.new、缺usage保守结算后封存、只读价格过期恢复。离线全流程16次使用匿名假传输和临时账本，不能算真实16模型请求或权威账本grant。

## 历史失败及依赖风险

本轮相关定向检查没有新增失败。D27全量曾34组30PASS/4历史FAIL，本轮未重跑未变组，不能称全量全绿：D9 guard旧serve脚本hash、RCO-5-007旧package-lock hash、C11 history与gateway旧AGENTS hash。旧锁/断言/Expected/raw保持。依赖audit5high/2moderate是D27历史观测，本轮未重新audit、未升级依赖；维护建议见原D27验证。

证据打包最初因ESLint静默成功未生成Tee文件而失败，已按实际exit0生成空日志并完成打包；该问题不涉及执行器、账本或模型。没有为了打包重跑已通过检查。[证据索引](evidence/CAPTURE_SUMMARY.json)逐文件SHA可核。

账本前后938行、782221字节、SHA e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9一致。所有实际模型/grant/reserve/settle/真人/部署均0；没有读取Secret明文，没有访问旧用户库。
