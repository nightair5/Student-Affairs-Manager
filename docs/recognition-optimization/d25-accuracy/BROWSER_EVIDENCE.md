# D25真实浏览器与独立读回

2026-10-02，官方Computer Use插件、Codex in-app browser。使用已有正式产品链，所有操作标ENGINEERING_REPLAY；没有真人、付费模型或旧用户库操作。

最终URL http://127.0.0.1:6751/?automation=1；库`rco-mainline-01-02-i1-real-input-d23-study-engineering-d25-accuracy02`；代码提交`3aabcca00cf8eb8a0830a8f3de317a182b07186b`；source SHA `28a0fa1b5f8e3d1eefb74a22cc587d3ed5c5960f379cd1571002eea6ddb2c1da`。[实际构建资源](browser/BUILD_MANIFEST.json)、[案例读回](browser/BROWSER_CASES.json)、[最终完整读回](browser/FINAL_READBACK.json)、[截图](browser/FINAL_PAGE.jpg)。

验收期间页面最初显示提交前HEAD 0b9f…，源码SHA已是上述最终字节。代码提交推送后只更新构建标识，重启同库服务、刷新，最终显示3aabcca…，事实/输入和风险草稿均保留。没有把旧6743教学入口或不同代码的过程证据当成D25最终验收。

| 场景/证据case | 实际操作与结果 | 独立canonical/页面证据 | 状态 |
|---|---|---|---|
| S09（D25-S01，构造正例） | 打开无任务停机通知、确认无任务并保存事件、完成、独立读回 | Task0/Project0/Event1/TimePoint1；图书借阅门户停机；周三晚、null、vague、needsConfirmation=true；commit 2cfa0662-7160-4d5f-ad65-298ab39b60e0 | PASS |
| S06（D25-S03，构造正例） | 核对共享材料必需性/准备状态，分别核对填写与提交两项，勾选后关闭重开恢复选择 | 两项todo；提交依赖填写，首页“有1项前置事项未完成”；XLSX材料与两项关联 | PASS |
| formal_failure | 下一次正式保存注入失败，重新打开恢复草稿并确认 | D13_INJECTED_ATOMIC_FAILURE；Task仍0，已有S09事件/时间保持；没有半份任务或假成功，选择和编辑保留 | PASS |
| S06_retry_readback | 手动重试；下一次读回注入失败；看到“已提交，读回尚未验证”；点击重新读回已提交结果 | 正式commit 65a2c7a9-6019-42ad-b74a-62296cbc5997保留；只重读，不二次正式提交；Task2/Project0/Event1/Time1；failure事件2 | PASS |
| refresh_after_retry | 刷新并独立读回 | 同样2任务/1事件/1时间，无重复；草稿confirmed | PASS |
| old_S05_block（D17 ordinal10） | 只读加载真实旧回答，核对并读回风险 | TIME_EDGE_DISAGREEMENT(task-0001,time-0001)，needs_review，未创建其正式任务；原双向冲突保留 | PASS（风险显示/读回；正式阻断由定向测试验证） |
| bad_revision_partial | 错修订匿名夹具，关联项显示缺旧端点；只选择预约线上时段确认 | 无关事项保存，累计Task3；坏修订事项不入库，草稿partially_confirmed | PASS |
| precise_material_control（D25-S07） | 核对任务与材料后正式确认 | 累计Task4/Project0/Event1/Time2；2026-10-19T16:30，Asia/Shanghai，精确；PDF格式及实验编号-负责人命名要求保留 | PASS |
| old_S06_condition_block（D17 ordinal11） | 只读打开旧录制 | “条件已成立但缺原文事实”，CONDITION_TRUTH_WITHOUT_FACT，needs_review；原true及空factScopeIds未改 | PASS（风险显示/读回；正式阻断由定向测试验证） |
| S05_one_way_graph_unknown_applicability（D25-S05） | 打开单向关系工程正例、核对来源和时间、关闭保留 | T1/ PT1_0两向索引一致；unknown资格保留；needs_review，不当已获资格保存；相对时段解析边界见ROOT_CAUSES | PASS（图/保留草稿）；时间契约非独立裁决 |
| 最终已推送构建刷新 | 重启仅本轮6751服务，刷新后独立读回 | 构建3aabcca/source28a0；Task4/Project0/Event1/Time2；7份草稿及风险恢复；控制台error=[] | PASS |

不重复宣称已跑完旧A—L：本轮验收覆盖三个根因、材料/修订回归、失败恢复、正式保存与刷新读回。两匿名身份全图隔离由本轮产品集成测试证明，浏览器只使用本轮新允许库；没有伪称完成两真人浏览器试次。端口6750为本轮开发过程入口，最终只推荐6751。

测量证据与语义裁决分开：S09阅读41.548秒、主动编辑0，等待7ms；阅读超10秒没有计编辑。S06材料确认editId `4790742d-0175-4e32-b971-638b483ebfb3`进入检查点/操作、commit/readback链，失败后重试不重新造这次输入身份。精确控制editId `a922850b-c56f-4285-9313-84cf96ab60f4`也可追踪。未完成旧S05草稿保留未闭合区间、缺terminal commit/readback等缺失，不能计0秒低修改成功。没有语义人工裁决，工程记录的correctDisposition为NOT_ADJUDICATED，四项真人指标NOT_OBSERVABLE。

工具过程阻碍：第一次恢复时trusted Node退出，绑定浏览器超时；沿官方工具reset后getTab恢复。后续读回JSON超过工具单次返回长度，改为读取页面现有DOM的分段文本，没有访问隐藏应用状态、注入事实或操作IndexedDB。工具错误不是模型/保存失败；没有用SendKeys、坐标盲点或其他浏览器自动化替代。

最终独立Repository读回保留原始回答、程序转换、修改与正式事实，不以页面toast代替事实值核对。完整JSON为匿名工程证据，不是用户原库备份。
