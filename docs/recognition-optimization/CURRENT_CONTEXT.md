# RCO Current Context

## 当前结论与授权

- 北极星：完整通知→可核对建议→用户确认→可靠保存→下游可找到。
- 当前轮：RCO-5-MAINLINE-02-SCOPE，仅定向只读审计和精确实施范围。
- 当前源码没有修改；未接稳定入口、未运行模型/浏览器/新数据或部署。
- 文档独立审查已闭合两项范围问题，无剩余阻断；最终保护/提交状态见CHECKS和Git回执。
- 唯一下一建议：MAINLINE-02-I1，真实App的隔离V2接线与无截止日期承接。
- 下一实施包尚未授权，不因文档/提示词存在就运行。
- 模型识别准确率：本轮未测量；NO_G5_PROMOTION。

## Git与保护基线

- repository: C:\Users\Winner\student-affairs-multimodal-exp。
- branch: codex/e2-multimodal-recognition-exp。
- SCOPE起始HEAD/已核对远端：9c5ec0bc5c85c9ce339defd100c6d6958e94776e。
- 这是已提交R2业务实现：fix(app): verify isolated V2 time edit adoption。
- 起始工作区干净；R2九源码哈希匹配；原683项保护通过。
- SCOPE BASELINE记录705原tracked，除本文件与追加日志外703项全部只读。
- 既有Expected/freeze/dataset/checkpoint/cache、Schema/repository/validator及历史证据保持。
- 本轮只新增mainline-02-scope文档，更新本文件与追加日志；不套旧失败patch。
- 最终文档提交SHA、远端、干净状态以Git回执为准；不把起始HEAD当本轮提交。

## 本轮发现：实际入口仍旧

- App首页/统一录入先存来源再识别，已有真实capture能力。
- App未传DraftReviewPanel的confirmationV2，编辑仍改旧React投影。
- 逐项/面板全部/收件箱批量均走旧确认；无deadline先被App拦截。
- 旧自动保存把视图合并回canonical，不可拿来持久化V2首次响应与编辑。
- 需要真实App调用editConfirmationV2/confirmV2，并同步canonical读回修订。
- R2面板工程页不是App接入；下一包不能另建玩具页面。

## 无截止日期下游

- v8可保存无时间任务；旧兼容视图以空deadline表示，不是造日期。
- 任务中心不按日期排除，所以能列出；卡片却显示“时间待确认/待补充”。
- 首页无日期被当异常加65分，投影待确认风险可能另加12分，需显式实验区分。
- 日历会排除无效日期，避免假日期，但目前没有无截止任务独立列表。
- 无deadline不自动算开工时段；不可用假日期补齐。
- 详情编辑required日期；提醒默认时间、ICS日历/待办均依赖deadline。
- 新V2无日期任务本身0提醒；有效手工提醒+无deadline的旧格式化仍有静态风险。
- canonical JSON可完整备份；旧v7规范化1970逻辑不代表当前v8必然造日期。
- 周月报按截止/完成日期入表，不是全部任务导出。
- 以上是静态审计，不是本轮浏览器通过数字。

## 下一包精确范围（等待授权）

- 拟9已有文件：App、IntakePanel、DraftReviewPanel、DashboardPage、TasksPage、
  TaskCard、CalendarPage、TaskDetailPanel、taskLogic。
- 拟8个mainline02源码/测试、2个隔离脚本；精确路径和职责见白名单。
- 所有已有改动须显式runtime/可选props/可选参数，旧默认不变。
- 不改repository/Schema/迁移/legacyView/confirmationV2/domainCommit/旧夹具。
- 本机入口先创建新隔离v8库，复用真实App/capture/repo；缺库坏库失败，不fallback旧库。
- 关闭实验旧localStorage/迁移/自动保存、状态请求、模型/抓取/OCR/通知外发。
- 只用旧人工工程响应替换识别回调，不替换录入，不预置已确认任务。
- 确认前逐键编辑/明确保存，部分/批量/刷新/失败恢复全链实测。
- 真无截止可确认与查找；模糊/冲突/坏引用不可冒充无日期。
- 正式任务编辑/ICS/提醒未支持；白名单组件预禁用，只读收件箱/导航由App先拒绝后提示。
- 详情仅查看、JSON完整导出；不能把禁用项计为功能验收通过。
- 核心录入/编辑/保存/确认若也要禁用才能安全，整个包失败，不全拒绝过门。

## 证据与最短恢复

1. 当前授权→AGENTS/PRD相关节→本文件→OPTIMIZATION_LOG最新79/80。
2. mainline-02-scope/SCOPE_AUDIT.md：实际入口与下游源码行证据。
3. IMPLEMENTATION_WHITELIST.md：9已有/8新源码测试/2脚本及只读边界。
4. VALIDATION_DESIGN.md：A–K设计组，尚未运行，不报告11/11。
5. NEXT_PROMPT.md：唯一下一实施包授权，当前不执行。
6. REVIEW.md、BASELINE.json、CHECKS.json：独立文档复核及保护/交付检查。
7. R2_AUDIT与R2_IMPLEMENTATION_SNAPSHOT只在核对实现状态时读。

## 历史证据与停机

- R2旧报告：68定向；967通过/1跳过；人工42/42；浏览器协议8/8。
- 上述数字本轮未重跑；旧40/42、旧17测试与所有历史FAIL保持。
- 一轮一个主因，最多两轮局部修补；长日志留文件，短交接约80行。
- 保护变化/重叠修改/真实库访问/稳定默认改变/授权扩大立即停，不自行修。
- 模型、真实材料、真人、部署分别批准；0元是产品模型实验费，不是Codex开发用量。
- 本轮审计文档验证提交推送后停止，不自动实施MAINLINE-02-I1。
