# 最终验证与未全绿的准确范围

2026-10-05。[完整独立组摘要与原服务器错误](VALIDATION.json)。没有修改旧Expected、raw、锁、成绩、Manifest、身份、断言、依赖或Workspace v8。

定向currentNoticeTimes/sourceAccountingSupportProduct：12PASS。6个新增有实际意义的产品用例包含不同日期、无日期/owner/类型/重复/矛盾/端点缺失、24点边界，以及两份真实capture→Schema→普通转换→DomainCommitPlan→独立Repository保存与幂等。不是只验关键词函数。

权威node scripts/candidate11-checks.mjs test：41独立组全部确定退出，34PASS/7FAIL/0不可用；产品Vitest1054PASS/1skip。server、worker、worker-d26、functions、Node工具组、carrier和历史组均执行，没有首错即停、排除套件或增加全局timeout。

| 失败 | 原始原因/当前证据 |
|---|---|
| server（本次额外） | server/server-tests.mjs:51的同步用例fetch失败，cause=bad port，栈到withServer:36。辅助服务器listen(0)取得随机端口，原日志未记录具体端口，不能声称确知哪个端口。单独node --test server/server-tests.mjs为8/8PASS；原全量失败保留，不据此称全绿。下一最小动作是记录端口并用该端口有限重现；没有证据需改本轮产品时间代码。 |
| d19-diagnostic、vitest-d17-history | D17_SCORE_LEDGER_DRIFT，旧账本快照断言与合法追加不兼容；完整当前链通过。 |
| d9-historical | D9旧serve-candidate15-d8冻结组件哈希。 |
| rco-5-007 | 旧锁原字节/CRLF哈希。 |
| c11-history、c11-gateway | 旧AGENTS哈希与活动规则不同。 |

server失败与两项时间改动无调用关系；没有改变旧服务器断言凑绿。六历史失败也未覆盖。全量结果是FAIL；本地修复的定向和浏览器是PASS，不能宣布整个仓库DoD全部完成。

lint最终0错误/8旧warning。新helper export引发的warning已取消；新增活动脚本独立ESLint通过。build最终TypeScript及Vite通过（旧500k chunk提示保留）；初次新增测试的字面量类型过窄导致TS2322，已修为string，不改断言。security scan PASS。最终运行JS/CSS与最后类型/导出清理后的重新打包一致，见FINAL_BUNDLE_EQUIVALENCE.json。浏览器最终日志0error/warn。

只读npm audit：5high/2moderate；omit-dev独立生产审计0。高风险brace-expansion、sharp、undici以及miniflare/wrangler开发链；中风险Vitest/mocker。生产审计0不代表开发依赖安全。当前入口是自有HTTP静态回环服务，不启动Wrangler/Miniflare，不接不可信图片或开发mock WebSocket；Vitest仅运行可信本地测试。后续兼容维护建议在独立授权边界检验Wrangler/Miniflare的受修版本、undici>=7.29.1、sharp>=0.35.4、brace-expansion>=5.0.12、Vitest/mocker>=4.1.11与当前配置；npm给出的Vitest5.0.3大版本更新不能直接当无损修复。本包不安装/升级/改锁，风险仍在。

历史只读verify：84保护/119冻结/7归档通过；public-notice-recorded-readonly完整链通过，1000行SHA fe24750479d3a5229e386e8088199ae097f48a1f6872f0eaac016cfaeddbb48d，原996前缀保持；新模型/grant/reserve/settle0。原1SETTLED/2UNCERTAIN/3、4NOT_SENT和STATE/AUTH/PRICE/raw/锁保持。原首答当前1暂定/3未知，不报总体正确率。

开工时report-public-notice-recorded --verify通过。新政策后不回写其冻结POST_CONVERSION_DIAGNOSTIC：audit版本/新conversion字段有意改变；通过新只读verify-current-notice-recordings --verify逐份核13录制SHA与firstSuggestion完整深比较不变。旧分数、原报告字节不动，没有修改旧verify以掩盖漂移。

可复查：
```
node scripts/current-notice-materials.mjs --verify
node scripts/diagnose-current-notice.mjs --verify
node scripts/verify-current-notice-recordings.mjs --verify
node scripts/public-notice-recorded-readonly.mjs
node scripts/verify-recognition-history.mjs --verify
```

SOURCE/PROVENANCE中的原件只在忽略.data；Git仅公开匿名节选和工程fixture/evidence。没有读取Secret明文、真人材料、旧用户库；CI及Cloudflare发布设置未变，未循环查控制台或触发部署。
