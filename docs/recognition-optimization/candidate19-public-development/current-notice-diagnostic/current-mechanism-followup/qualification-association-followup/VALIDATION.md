# 验证与限制

定向6文件51PASS；现行lint/build、安全扫描通过；全量42组确定退出，36PASS/6旧FAIL，整体exit1。与PRE_PRODUCT_TEST失败集合相同，没有排除套件、改断言或扩大timeout。相关新问题已修。

旧失败：d19-diagnostic、d9-historical、rco-5-007、c11-history、c11-gateway、vitest-d17-history，D17账本快照/D9/RCO/C11哈希冻结兼容问题原样保留。当前server组PASS，未复现旧随机bad-port。详见VALIDATION_SUMMARY.json及本机.data/candidate11/checks/test/Asia-Shanghai。

当前npm audit开发2critical/6high/1moderate，生产0；tinypool/vitest严重开发风险，未升级。历史5H2M不作为现状。84/119/7通过，74资产/封存SHA不变，账本1048完整链及1047原前缀通过，仅scopedGrant追加。4冻结请求SHA及原组件Git blobs通过，只读检查不替代dispatchgate。新执行器/paid步骤不再运行。

浏览器见BROWSER_EVIDENCE.md，实际部分确认、三故障、刷新、安排及独立值。手机/多标签同时冲突本轮未新增浏览器复验，定向CAS/旧冲突测试通过；新模型正确率未观察；真人指标不可观察。代码可按单提交回退，不回滚数据、资产或历史。
