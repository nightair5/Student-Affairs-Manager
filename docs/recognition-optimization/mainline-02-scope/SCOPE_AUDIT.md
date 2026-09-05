# RCO-5-MAINLINE-02-SCOPE 定向审计

结论：范围审计已形成，产品代码未修改；唯一优先包为 MAINLINE-02-I1「真实 App 的隔离 V2 接线与无截止日期承接」，等待另行授权。独立复核及保护结果见 REVIEW.md、CHECKS.json。模型识别准确率：本轮未测量。

## 1. 从哪里继续、为什么现在做

起始与已核对远端均为 `9c5ec0bc5c85c9ce339defd100c6d6958e94776e`，分支 `codex/e2-multimodal-recognition-exp`，实际仓库为 `C:\Users\Winner\student-affairs-multimodal-exp`。起始工作区干净；R2 实现 9/9 哈希匹配，R2 原保护 683/683 通过。本阶段基线记录 705 个已有文件，其中只允许 CURRENT_CONTEXT 与日志变化，其他 703 个只读。

R2 的隔离确认已验证，不代表普通 App 已用上。R2 报告的 68 项定向、967 通过/1 跳过、工程响应 42/42、浏览器协议 8/8 都是上轮证据，本轮不重跑、不叠加。本轮仅静态代码追踪、文档复核与保护检查，不作浏览器实测结论。

第一性原理：识别给出正确答案仍不够，用户必须能从日常入口核对、确认并重新找到任务。现在瓶颈在客户端交接和无日期的下游解释，不需要模型、新数据或再堆识别规则。总计划旧第5节偏向语义候选；本次当前用户授权优先，只收敛实际接线，不顺带启动旧语义改造。

## 2. 哪些操作仍走旧路径

以下行号绑定起始提交，供定向复查。

| 用户操作/交接 | 当前实际代码与结论 |
| --- | --- |
| 首页粘贴、统一录入 | App.tsx:437、506、712：createIntakeResult/buildLocalRecognition 后 beginCapture，再 recognize；云端可用时调用旧服务。先保存来源这一段是真实能力，但不是 V2 确认入口 |
| 收件箱恢复草稿 | App.tsx:412、1169，lib/repository.ts:725：读 canonical，再 workspaceV8ToLegacyView 投影；并不执行 reviewEditsV2 来恢复 V2 修改 |
| 打开核对面板 | App.tsx:1337：同一个真实 DraftReviewPanel，但未传 confirmationV2；V2 缓冲、显式保存、禁用范围未启用 |
| 修改建议 | App.tsx:716：updateDraftItem 改 React 草稿/反馈，253 的自动保存经 lib/repository.ts:837 合并旧视图。legacyView.ts:751 会把 edited.recognitionResult 写回 draft.result；不能拿这条通道承接不可变首次响应上的 V2 编辑 |
| 逐项加入 | App.tsx:933：先要求可解析 deadline，再保存旧 workspace，selectionFromDraftItems → buildDomainCommitPlan → commitDomainPlan；不是 confirmV2 |
| 面板全部加入 | App.tsx:971：同样要求每项有日期，使用旧选项/投影构造提交；一项无日期可拦住整批 |
| 收件箱批量确认 | App.tsx:1170：forEach(handleConfirmAll)，仍落旧批量处理；不能只换面板后漏掉这个入口 |
| 已确认任务、刷新、备份 | 确认真正写入 v8；刷新走 canonical→兼容视图；App.tsx:1033 的 JSON 导出走 canonical.exportJson，不是旧 v7 导出 |

旧投影只是显示，不是“用户确实改过”的证据。下一包必须让输入操作、编辑历史与确认意图在真实 App 内交接：原文/首次响应只读，明确保存调用 editConfirmationV2，确认只传 draftId/revision/taskTempIds；不把显示 deadline 重新当覆盖值，不在确认前回写整份旧草稿。

R2 的 browser.tsx 是专门的面板工程页，不是 App。下一包必须实际 mount App；旧人工响应仅替换识别回调，不得直接预置“已确认任务”跳过录入。

## 3. 无截止日期在下游的真实情况

“没有截止日期”不能由空字符串单独判定。需要结合 canonical 时间、材料/事件引用及来源响应区分：原文未说明、只给开始时间、模糊/冲突、引用缺失/损坏。后两类不能走安全无日期确认。

| 下游 | 静态证据与阻碍 | 最小处理 |
| --- | --- | --- |
| canonical 保存/读回 | R2 已测 1任务0时间；legacyView.ts:80 无截止映为 ''，不是填日期。v8 本身不需要新增字段 | 复用，新增只读日期展示状态；禁止改 Schema |
| 任务中心 | TasksPage.tsx:24 按类别/状态/文字筛选，不按日期排除，所以可以找到；TaskCard.tsx:19 却显示“时间待确认/待补充” | 保留搜索，明确“原文未说明截止时间”，与异常待核对分开 |
| 首页 | taskLogic.ts:56 无效日期加65分；legacyView.ts:262 无日期常带“待确认”，taskLogic.ts:101 再加12分。不会必然消失，但可能被无端推高 | 显式实验日期状态参与现有排序，不因真正无截止而加异常分；保留真实材料/依赖/人工优先级等风险，不整体清空风险 |
| 日历 | calendar.ts:85 跳过无效日期，134 的未来列表也过滤；CalendarPage.tsx:75 只有无日期事件，没有无日期任务列表 | 日期格继续排除；真实日历增加独立“无截止日期任务”列表与回任务中心入口 |
| 开工建议 | scheduling.ts:42 无可解析截止返回 null；CalendarPage.tsx:65 对空日期相减为 NaN | 明确“不自动排期”，先排除无日期任务再计算，不造截止/开始时间 |
| 详情编辑 | TaskDetailPanel.tsx:268 datetime-local + required；其他字段修改也可能被截止字段卡住 | 本最小包详情仅查看，显式说明正式任务编辑未纳入；不借机重做已确认实体编辑器，后续单独批准 |
| 浏览器/邮件提醒 | 详情114/154 默认从 deadline 算时间；notifications.ts:54 对已启用且合法 scheduledAt 的无日期任务格式化截止可抛 RangeError。新 V2 无日期确认本身不创建提醒，不能将此静态反例称为已经误发 | 实验关闭外发/权限申请，显示无截止不自动建提醒；调用实际 jobs 纯函数验证新任务生成0个作业，不运行通知。已有合法手工提醒的无日期任务属于后续支持缺口 |
| JSON 备份/刷新 | lib/repository.ts:844 导出 canonical，完整保存0时间；725 读 v8 后投影，正常当前链不走旧 normalizeTask 的1970默认 | 验证真实存储导出、刷新及哈希不变；不把旧迁移里的1970降级逻辑误报为当前 v8 必然造日期 |
| ICS/手机待办 | calendarExport.ts:76 无日期 VEVENT 抛错；96 的 VTODO 也必算 DUE；ReportsPage.tsx:70 批量包含无日期会整批失败 | 最小包不造 ICS 日期、不静默略过任务；详情实验入口预先明确阻断并指向完整 JSON。新增无 DUE 的待办能力及批量导出另批 |
| 周月报/CSV/Markdown | reports.ts:62 仅按截止或完成日期入报告，无日期未完成任务不入周期表；不是完整工作区导出 | 如实标为周期活动统计不等于全部任务。本包不开放 Reports 实验页面；完整备份用 canonical JSON |

这些是代码级现状，不是新一轮浏览器通过数字。无日期 UI/提醒/导出的上述限制不等于产品已商业化。

## 4. 隔离为何不只是换一个库名

App.tsx:56 服务是模块级实例；108 读取 localStorage，128 教程读取偏好，204 请求服务状态，283 调度系统提醒。仅给 CanonicalWorkspaceRepository 注入 store 不够：旧 lib/repository.ts:736 在缺库时仍可能进入旧库迁移。

拟采用：独立本机测试入口在挂载真实 App 前创建全新空 v8 测试库，注入完整实验 runtime；实验 load 只读指定 canonical，缺失/损坏立即失败，不调用旧迁移/恢复分支。常规入口不传 runtime，接口默认行为保持不变。测试库名复用只读 IsolatedTestStore 允许的 `rco-mainline-01-02-i1-<随机ID>` 前缀；这是存储适配器限制，不复用旧库。

实验必须同时关闭默认初始化、旧自动保存、状态探测、所有模型/链接/OCR网络、localStorage 教程/迁移、系统通知和其他服务页面。不能靠 CSS 隐藏或任意 URL 参数启用。白名单组件预禁用未支持操作且处理器拒绝；只读InboxPage/Sidebar的按钮由App在写入/挂载前拒绝并明确提示，不声称按钮已禁用（见白名单第4节）。本轮未读取任何浏览器数据库或真实用户内容。

详细精确文件及新旧默认边界见 IMPLEMENTATION_WHITELIST.md；验收见 VALIDATION_DESIGN.md。凡实施需超出该白名单、改变稳定默认或读真实库，先停止申请，不能“先接进去再补授权”。

## 5. 决策与剩余范围

唯一优先包 MAINLINE-02-I1：在受控本机实验入口复用真实 App、录入、收件箱、V2核对、任务中心、首页和日历，证明同一个用户动作链可保存并找回。它仍不是稳定默认接入或正式任务全生命周期验收。

本包明确不增加：新识别规则、事件确认、共享/间接时间编辑、unknown语义、新的正式任务编辑器、提醒外发、无日期ICS支持、模型/数据/真人/部署。不能承接的操作必须说明并保留草稿，而不是假成功。通过后再申请真实下游编辑/提醒/导出缺口或更广产品验收；当前不自动实施。

本轮只新增范围文档、保护清单、独立审查、短交接和追加日志；交付提交及远端状态由 CHECKS.json 与最终 Git 回执说明。0次外部产品模型/模型网络，0元产品实验费，密钥和剪贴板访问0，部署0；Codex开发用量另计。
