# RCO Current Context

## 当前结论与停止边界

- 北极星：完整通知→可核对建议→用户确认→可靠保存；少漏事、少改错、少花时间。
- 当前阶段：RCO-5-MAINLINE-01-P1-R2，原PLAN白名单下仅修时间编辑/提交采用范围。
- 结论：限定隔离V2实现与验收通过；MAINLINE_PRODUCT_NOT_INTEGRATED / NO_G5_PROMOTION。
- 本轮完成后停止，不自动修改App、不启动RCO-6、不创建数据、不调用模型或部署。
- 模型识别准确率：本轮未测量。

## Git与保护

- repository: C:\Users\Winner\student-affairs-multimodal-exp。
- branch: codex/e2-multimodal-recognition-exp。
- R2起始HEAD/远端：d45467d3cae849342dac9e6b3cc222127e650fa9。
- 开始时R1九源码实际字节哈希匹配，无重叠用户修改；未重复应用FAILED_IMPLEMENTATION.patch。
- R2_BASELINE.json记录687原tracked；仅两公共代码和两动态文档可变，其余683项保护。
- R2_IMPLEMENTATION_SNAPSHOT.json记录9个源码文件的已验收隔离实现哈希，不改旧组件freeze。
- 本轮拟单独业务提交：fix(app): verify isolated V2 time edit adoption；最终SHA/推送/工作区状态以Git及交付答复为准。
- R1及更早audit/snapshot/patch/Expected/freeze/dataset/checkpoint/cache/历史FAIL保持原样。
- 若恢复时Git或源码与R2快照不同，先检查实际差异，禁止回滚或重套旧失败补丁。

## 唯一根因与修补

- 旧错误：编辑入口接受planned_start的新时间，提交器排除该类型覆盖，导致页面/编辑记录新值、正式存储旧值。
- 主修补1轮：V2共用结构化时间类型集合，不增加关键词或模型职责。
- 保存前拒绝planned_start/event_start/event_end编辑，并在面板明确禁用/说明；未编辑原时间仍保留。
- 保持提交器原本支持的registration_deadline/submission_deadline/task_deadline/result_announcement，不扩展时间语义。
- 保存编辑前用真实DomainCommitPlan试算；编译器核对用户值、计划与canonical采用一致，不能被既有值静默挡掉。
- 旧接口/default不变；原文、首次建议与真实编辑分开；共享/间接关系不安全时明确拒绝，正常兄弟项可确认。
- R1输入缓冲、显式保存、关联实体检查和隔离链路沿用，不另建持久化引擎、不改Schema。

## 本轮证据

- 新红测试：6失败/62通过；修补后68/68，旧17+原V2 28+R1 13+R2 10。
- 同一旧人工响应、同42字段：旧40/42保持，新V2 42/42；不代表识别准确率100%。
- 新无上下文只读审查者/root/p1r2_independent_review：无阻断，独立68/68；额外内存14/14，不加入工程总数。
- 审查额外脚本曾因空对象原型断言出错，修正观察断言后通过；非产品失败，不改源码或门槛。
- 完整工程只跑1次：967通过/1项live OCR跳过/0失败；Vitest901+适配器66。
- lint、app/node类型、Schema/时间契约、新临时构建、安全扫描/隔离、依赖审计均通过；依赖0漏洞。
- 工程长日志：C:\Users\Winner\AppData\Local\Temp\rco-mainline-01-p1-r2-eSgUJS。
- 不加载.env、不使用旧实验缓存；cloudflare:check非发布不适用且未跑，不访问Wrangler凭证。
- 保留约525.68 kB主bundle和>500 kB警告，不在本轮增加性能改造。
- 683/683保护哈希不变，旧日志前缀不变；App、repository、validator及稳定入口未改。
- 外部产品模型/模型网络/verifier/Repair/retry/密钥与剪贴板访问/CNY=0/0/0/0/0/0/0。
- 0元只指产品模型实验费用，不代表开发Codex用量为0。

## 实际浏览器与存储

- 官方浏览器控制，真实DraftReviewPanel V2→CanonicalWorkspaceRepository→新IndexedDB，非玩具存储。
- R1_BROWSER_PROTOCOL 8/8完成，另测两项同时批量确认；5个新隔离库，未接App。
- 逐键输入停留缓冲；未保存记录0且受影响确认禁用；有效兄弟可确认。
- 保存修改后刷新恢复；分项确认0→1，重复仍1，余项后2，刷新仍2；材料/时间归属和原文保留。
- 实际事务抛错后回滚，再刷新读回2项；未确认写入、重复、覆盖、丢失在所测场景中均0。
- 无日期确认后1任务0时间；人工日期为date_only/manual/无假时刻与假证据；首次响应仍无时间。
- 模糊时间未选、待核对、不能确认；两项批量确认后各2任务/时间/材料并刷新保留。
- 浏览器观察工具曾误选合并选项、闭包读旧标签页、宽article定位不唯一；按DOM/标签页/库名纠正，不计错误观察为通过。
- 已关闭本轮标签页3–7与2623本机服务，五个测试库保留，不删除。
- 不是Chrome/Edge/手机商业验收、真人操作时间或真实材料验证。

## 最短恢复读取与下一步

1. 当前授权→AGENTS/PRD相关节→本文件→追加日志77/78→原mainline-01-p1/PLAN.md。
2. 查R2_AUDIT、R2_IMPLEMENTATION_SNAPSHOT、R2_ENGINEERING_CHECKS与R2_BROWSER_OBSERVATION；不重读完整历史。
3. 唯一下一主线：实际入口接入V2，以及无日期任务在任务中心/首页/日历/提醒中的承接。
4. 当前App及下游仍只读，先另批MAINLINE-02-SCOPE定向审计，锁定精确文件/开关/隔离库方案后再批准实施。
5. 不把隔离能力冒充旧App已修复；不再为同一处规则反复新建数据/调模型。
6. unknown条件、事件确认、共享/间接时间编辑仍有明确限制；无法表达的关系不以空字段掩盖。
7. 详细下一授权提示词：mainline-01-p1/R2_NEXT_PROMPT.md；提示词不是执行许可，本轮停止。
8. 模型、真实材料、真人研究、部署继续分别授权。

## 上下文与交付控制

- 一轮一个根因、最多两轮；长日志留文件，CURRENT_CONTEXT约80行。
- 现场Git/授权/最新编号日志高于聊天记忆；读直接失败片段，不重复历史runner。
- 每轮有持久化改动须安全提交推送，给审计、数字、保护/缺口、下一步理由及提示词。
