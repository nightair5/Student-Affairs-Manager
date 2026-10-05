# 本轮验证与历史失败

2026-10-05，[结构化汇总](VALIDATION.json)、[契约前后](PRODUCT_DIAGNOSTIC.json)、[实际浏览器](BROWSER_EVIDENCE.md)。

同一有效wire/完整匿名envelope，用esbuild只读起点0718825公共组件：2合法复合标签均PRODUCT_SUPPORT_UNSUPPORTED_CONTEXT_REFERENCE；新组件2种可展示，新增事实0。4条件/否定/未公布/普通指令标签仍拒。新Vitest3项+原独立事件支持5项通过，原错owner/类型/日期/跨源/缺主事实/端点图保护保持。

活动工具Node7项通过（新3+原4），含7阶段故障和3诊断失败时点。raw或settle已发生后诊断失败仍UNCERTAIN、禁重发，匿名fake transport/临时文件/内存账本，不碰权威账本。补充反向复核只扩新Node测试失败矩阵，未改已验产品源。最终日志`.data/public-notice-development/sealed-followup-phase-final.log`。

权威npm run test共41独立组确定退出：35PASS、6旧FAIL、0不可用。当前产品1048PASS/1skip；server/worker/worker-d26/functions/carrier/scoped执行和诊断均PASS，**全量未全绿**。

| 历史组 | 本次失败 |
|---|---|
| d19-diagnostic、vitest-d17-history | D17_SCORE_LEDGER_DRIFT，旧冻结账本快照不兼容合法追加；新完整链/冻结核验通过，不改断言。 |
| d9-historical | D9冻结serve-candidate15-d8组件哈希不一致。 |
| rco-5-007 | 旧锁原字节/CRLF哈希。 |
| c11-history、c11-gateway | 旧AGENTS快照哈希与当前规则不一致。 |

原日志在`.data/candidate11/checks/test/Asia-Shanghai/`，全量`.data/public-notice-development/sealed-followup-full-test.log`。无排除套件、改旧断言/锁、全局增加timeout；使用既有匿名carrier环境。

lint PASS：0错误8旧warning；TypeScript/Vite build PASS（现有500k chunk提示），security:scan PASS；新增活动脚本另跑ESLint。原输出`.data/public-notice-development/sealed-followup-{lint,build,security}.log`。

现有代理只读audit：5high/2moderate；omit-dev生产独立审计0。高风险为brace-expansion/sharp/undici及miniflare/wrangler开发链，中风险Vitest/mocker。“生产依赖0”不等于开发工具任意使用安全。当前回环固定录制仅服务指定静态路径，不对外启动受影响调试WebSocket/Workers代理或处理不可信图片。兼容维护另范围核工具调用可达性、测试wrangler/miniflare/undici及sharp/Vitest更新兼容后改活动锁；本轮不升级、不改冻结锁，风险保留。

只读现场、录制报告verify、历史verify通过：原已知与旧12首屏深比较不变；84保护/119冻结/7归档，1000链SHA fe24750479d3a5229e386e8088199ae097f48a1f6872f0eaac016cfaeddbb48d、原996前缀保持。原锁/HALT/STATE/AUTH/PRICE/raw/receipt不变；本轮model/grant/reserve/settle0，无依赖/schema升级。
