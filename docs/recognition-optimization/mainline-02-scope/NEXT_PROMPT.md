# 唯一优先实施包授权提示词（尚未授权）

授权执行 RCO-5-MAINLINE-02-I1：按已提交 MAINLINE-02-SCOPE 的 IMPLEMENTATION_WHITELIST.md 和 VALIDATION_DESIGN.md，完成真实 App 的隔离确认 V2 接线，以及无截止日期任务的查询/展示/保存承接。0次外部识别模型调用；不改识别语义、不新建数据。

唯一工作仓库：C:\Users\Winner\student-affairs-multimodal-exp；唯一分支：codex/e2-multimodal-recognition-exp；SCOPE文档目录：docs/recognition-optimization/mainline-02-scope/。基线以该SCOPE已推送文档交付提交及CHECKS为准，并用Git核对；9c5ec0bc5c85c9ce339defd100c6d6958e94776e是R2交付提交、SCOPE起始HEAD，不得为了恢复基线回切/重置到它，也不得在环境默认的“比赛”工作区实施。

开始核对 Git、远端、当前授权、SCOPE 的 BASELINE/CHECKS/REVIEW 与 CURRENT_CONTEXT、最新日志；R2九源码应仍匹配。若有重叠用户修改或保护变化停止，不套旧FAILED补丁、不重做历史计划。

允许修改的已有文件仅9个：src/App.tsx、src/components/IntakePanel.tsx、src/components/DraftReviewPanel.tsx、src/pages/DashboardPage.tsx、src/pages/TasksPage.tsx、src/components/TaskCard.tsx、src/pages/CalendarPage.tsx、src/components/TaskDetailPanel.tsx、src/lib/taskLogic.ts；只做白名单列明的显式隔离runtime/可选props/可选参数增量，旧默认不变。
允许新增仅白名单所列8个mainline02源码/测试与2个scripts，以及本轮报告；更新约80行CURRENT_CONTEXT、追加日志。任何新增实际文件或语义范围需先申请。
Schema、repository、migration、validator、legacyView、confirmationV2、domainCommit、时间AST、既有Expected/freeze/dataset/checkpoint/cache、旧夹具/评分/runner/result均只读。

1. 新本机启动器必须mount真实App，不能另做玩具确认页。挂载前初始化全新隔离v8库，注入真实canonical/capture和旧人工工程响应回调；库缺失/坏数据立即失败，不fallback旧库。只允许此runtime打开实验，普通入口不变。
2. 关闭实验默认演示/旧localStorage、旧迁移、状态请求、所有模型/OCR/URL网络、通知权限/外发及未纳入页面；关闭旧整份草稿自动保存。白名单组件的未支持操作预禁用并由处理器拒绝；只读InboxPage/Sidebar的归档/非核心导航保留可见按钮，由App在写入/页面挂载前拒绝并提示，不宣称按钮已disabled、不扩大文件。不接用户实际数据库。
3. 首页/统一录入文字→先存来源→人工响应→草稿恢复→真实V2逐键编辑/明确保存→逐项/部分/批量及收件箱批量→刷新canonical读回，完整覆盖；不能靠所有项不选或禁用核心操作过门。
4. 原文、首次响应、显示、用户编辑分别处理。确认意图只取真实动作/版本/ID，不从显示投影构造override；42字段新通路42/42，旧40/42、旧17测试与历史FAIL不变。
5. 完整关联区分真正无截止、仅开始时间、模糊/冲突/坏引用；真正无截止可确认，在任务中心和日历独立列表找到，首页不凭缺日期抬高异常分；不造时刻、截止、提醒或丢掉已有时间。保留材料/依赖等真实风险。
6. 本最小包正式任务详情只查看、JSON完整导出；正式任务编辑/执行操作、真实提醒、无日期ICS、周期报表及结构改写不承诺，按第2条UI规则明确阻断并解释。新无日期任务0时间0提醒，真实jobs函数检查0作业；不以阻断操作冒充该功能已验收。
7. 先失败复现，同根因最多两轮局部修补；定向/对抗通过后新无上下文独立审查，无阻断才一次全量工程门及真实App浏览器逐键/保存/确认/刷新/导出读回。日志留新文件，不运行旧一次性runner，不改缓存。
8. 任一新错误默认勾选、保护变化、测试弱化、Expected污染、稳定默认改变、真实库访问、范围扩大或两轮无效立即停止，保留现场只交付获准失败证据。成功才单独提交推送业务实现并核对远端。

不访问密钥/剪贴板；模型/verifier/Repair/retry/模型网络/费用均0；不接稳定入口、不启动RCO-6、不创建新盲测/B10、不部署、不采集真人或真实材料。模型识别准确率写“本轮未测量”。

交付审计、真实用户链覆盖/字段与安全数字、未解决功能、保护/Git状态及唯一下一建议和授权提示词。完成后停止，不自动实施下一包。
