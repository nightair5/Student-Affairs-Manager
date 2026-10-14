# 本轮确定退出的检查

机器证据VALIDATION.json，浏览器browser/CHECK.json；只读diagnostic --verify通过。检查后封存STATE/锁/HALT及1000账本不改。

| 检查 | 结果 |
|---|---|
| 真实Schema/产品定向 | 新5+原支持6 PASS；不同对象/日期/标签/顺序，11最小错误变体及跨来源，空实体不猜补，真实计划/读回/幂等。 |
| 原12录制回归 | response SHA和firstSuggestion深比较12/12相等；原v11、后验争议不改。 |
| lint | PASS，0错误8旧警告；新只读report/scene脚本单独eslint PASS。 |
| build | tsc/Vite PASS，既有大bundle警告保留。 |
| security/隔离 | PASS；不新增依赖/改锁/读Secret明文。新回环入口仅GET静态白名单，模型/同步403。 |
| full test | 当前权威candidate11-checks test，40组全部确定退出，34PASS/6旧历史FAIL；103产品文件/1045测试PASS、1skip，server/worker/worker-d26/functions/carrier全部PASS，无新增产品失败。 |
| npm audit | 直连TLS断开，使用既有本机代理保持TLS验证只读重核成功；5high/2moderate，omit-dev生产0。锁不改；此审计不是全绿。 |
| 历史 | 84保护/119冻结/7归档；原996前缀与原Manifest/身份/12raw/成绩不变，合法新批4行已核。 |
| 新付费现场 | 1SETTLED/1UNCERTAIN/2NOT_SENT，唯一grant，封存后零发送/零写账本；预算核价快照不是实扣或未来许可。 |

六旧失败：d19-diagnostic、vitest-d17-history为D17_SCORE_LEDGER_DRIFT；d9-historical旧serve-candidate15-d8冻结哈希；rco-5-007旧package-lock字节/CRLF；c11-history、c11-gateway旧AGENTS冻结哈希。合法追加让旧快照更旧，不改历史断言/Manifest制造全绿。新只读scene在独立managed快照验证162组件/6产物/4身份，活动公共代码有意变化单列，不把它回写冻结包。

5high：brace-expansion、sharp、undici、miniflare、wrangler；2moderate：vitest/@vitest/mocker，都在开发依赖路径。生产0不保证开发服务器无可达风险。本轮匿名固定录制、回环/受限API没有扩大暴露；兼容维护需独立边界，传递补丁及Wrangler/Miniflare配套检查，Vitest5重大版本不自动升级。保留旧冻结lock，新维护验证worker/preview/carrier，不让维护抢首次准确主线。

费用/数据安全未因测试通过而解除：第2请求没有可信响应或usage，不猜是否发送，不解除锁、不settle猜数、不继续3/4。浏览器显示修复通过不是模型整批通过；未知3份、人类指标保留。
