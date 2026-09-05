# MAINLINE-02-I1 精确实施白名单（待用户批准）

当前 SCOPE 只交付本文，不授权下表修改。实施基线：先核对 SCOPE 文档交付提交及其工作区，确认 R2 九源码仍匹配；不能把旧提示词当授权。唯一主因是实际 App 的 V2 交接与无截止日期承接，不扩展识别语义。

## 1. 允许申请修改的已有文件：9 个

每项仅限显式实验 runtime/可选 props/可选参数增量。未传配置的返回值、事件、排序、网络/存储行为必须保持旧默认；禁止全局打开 V2。

| 实际路径 | 允许的精确改动 | 保持不变 |
| --- | --- | --- |
| src/App.tsx | 增加可选隔离 runtime；统一注入 capture、canonical、视图读取、人工识别回调。覆盖首页/统一录入、收件箱恢复及批量、面板保存/选择/确认。实验分支禁止旧草稿自动保存和 selectionFromDraftItems；确认后重新加载 canonical 并同步视图修订号。实验模式限制导航/任务修改/重试等未纳入功能，提供完整测试库JSON导出。初始状态/教程/状态探测/通知都经隔离分支 | main.tsx 不改；无 runtime 时仍旧 App。不得让未挂载实验触碰测试逻辑/旧库，不能接稳定地址 |
| src/components/IntakePanel.tsx | 可选实验能力约束：仅文字页能提交到人工工程响应回调；图片、文件、URL抓取、手动任务表单等本包不测项禁用并解释；处理器也拒绝，不触发OCR/抓取 | 默认格式能力/多模态授权均不改，不测识别 |
| src/components/DraftReviewPanel.tsx | 仅额外的显式实验 capability 支持：关闭本包不支持的拆合、项目/阶段变更、实体勾选、拒绝写入等结构修改；保留原文定位、V2逐键缓冲/明确保存、任务手选、逐项/批量确认；未知能力缺失不得显示已生效 | 原V2安全/编辑采用语义不改；R2 不传新 capability 的面板行为不改 |
| src/pages/DashboardPage.tsx | 接收只读日期状态，传给现有排序与卡片；必要的工程响应标识；首页仍最多三项且可到任务中心 | 旧默认排序/文案路径保持 |
| src/pages/TasksPage.tsx | 传递只读日期状态到卡片，提供显式无截止标签或筛选；仍可搜索完整任务 | 旧类别/状态/搜索默认不变 |
| src/components/TaskCard.tsx | 显式实验日期状态决定无截止/待核对/仅开始时间文案；日期类型/时区一致显示，不将date-only显示为假时刻；使用现有排序函数的显式选项 | 原任务值不改，不能用造日期/改风险数组驱动显示 |
| src/pages/CalendarPage.tsx | 显式实验模式增加无截止任务列表；有日期格继续复用现有分组；无截止不进日期排序/开工排期。课程修改等未测操作明确禁用 | 原普通日历默认不变，不改 calendar.ts/scheduling.ts |
| src/components/TaskDetailPanel.tsx | 显式实验只读模式：原文依据/材料/历史可看，日期状态清楚；正式任务编辑、提醒开关、手机ICS操作预先禁用并说明替代路径。无日期不能因查看触发默认时间或副作用 | 旧正式编辑/提醒/ICS实现不改，本包不验收它们已支持无日期 |
| src/lib/taskLogic.ts | 现有 calculateTaskPriority/getFocusTasks/getExecutableTasks/getBlockedAndWaitingTasks 增可选实验日期上下文并一致透传；只有有完整证据的缺截止不加日期异常65分，不因纯投影产生的“待确认”误加12分。其他真实待核对/材料/依赖/完成/置顶/稍后/人工优先级保留 | 不传参数与旧输出完全一致；不复制第二套打分器，不整体移除待确认风险 |

## 2. 允许申请新增的文件：8 个源码/测试、2 个脚本

| 实际路径 | 单一职责 |
| --- | --- |
| src/experiments/mainline02/runtime.ts | 结构化隔离依赖契约、显式运行身份和存储/副作用防线；复用真实 canonical repo + capture + IsolatedTestStore，不新写持久化引擎。测试库预建空v8，缺库/不匹配/坏数据停止，绝不fallback旧库。通过类型导入避免默认App加载工程数据 |
| src/experiments/mainline02/reviewAdapter.ts | 纯 canonical→面板读视图，复用 confirmationRevisionV2/reviewEditsV2/confirmationStateV2；明确映射 itemId↔tempId、用户选择、保存意图及版本。不得包含Expected或42字段评分 |
| src/experiments/mainline02/taskDateView.ts | 只读日期状态与显示依据：完整相关时间/材料/事件/来源区分缺截止、仅开始时间、模糊/冲突/坏引用。空deadline不充分；不改canonical、不重做中文解析 |
| src/experiments/mainline02/browser.tsx | 独立本机启动器，只负责建立新库、注入旧人工响应并mount真实App；不另写录入/确认/任务页面，不先注入已确认任务。仅这里/测试导入旧fixtures；显式可见“人工工程响应，非模型预测” |
| src/experiments/mainline02/runtime.test.ts | 真实库/旧迁移/外部请求拒绝、初始化/刷新/缺失/失败、无默认实验入口检查 |
| src/experiments/mainline02/reviewAdapter.test.ts | 原文/首次响应/用户保存分离、版本与ID绑定、批量/部分确认、不可确认状态/兄弟隔离、42字段读回 |
| src/experiments/mainline02/taskDateView.test.ts | 缺日期与模糊/冲突/仅开始时间分离、关联材料时间、排序/日历/提醒/导出正反测试及默认不变 |
| src/experiments/mainline02/mainlineAcceptance.test.tsx | 真实App/组件联动测试；不以直接调用confirmV2代替用户主链验收；测试动作日志与存储快照断言 |
| scripts/serve-mainline-02-i1.mjs | 本机回环内存构建/服务；不读.env，CSP connect-src 'none'，白名单资源，不部署、不落旧dist/cache；支持真实App懒加载页面 |
| scripts/check-mainline-02-i1.mjs | 新临时日志、白名单/保护/默认入口依赖检查、一次适用工程门和隔离验收编排；不运行旧一次性runner |

合计拟申请 9 个已有文件 + 8 个新增源码/测试 + 2 个新增脚本。不是19个都随意改：职责、默认边界与停止条件一并约束。若不需要某个文件则不改；需要第20个源码/脚本或新增语义，先停。

可新增 `docs/recognition-optimization/mainline-02-i1/` 下本轮计划、检查、审查、浏览器记录、审计和下一提示词；仅更新 CURRENT_CONTEXT、追加 OPTIMIZATION_LOG。不覆盖 SCOPE 文档及 R2 证据。

## 3. 必须只读的共用能力

- src/main.tsx、src/types.ts、src/domain/v2/types.ts、两套 Schema/validator、所有迁移、src/domain/v2/repository.ts、src/lib/repository.ts、src/domain/v2/legacyView.ts。
- src/domain/v2/confirmationV2.ts、domainCommit.ts、capture.ts、sourceRetry.ts、所有 RCO 冻结识别组件与旧 tests。
- 旧 mainline01/fixtures.ts、chain.ts、isolatedStore.ts、旧mainline01p1全部文件；仅按职责导入。旧42字段/40/42和FAIL不可修改。禁止导入带评分副作用的观察函数到产品决策。
- calendar.ts、notifications.ts、calendarExport.ts、reports.ts、时间AST、稳定入口/配置/package/lock/CI。本包按现有能力给明确阻断，不能为方便修改这些文件。
- Expected/freeze/dataset/checkpoint/cache、旧runner/result，以及所有未列路径。

repository 实现/Schema/迁移目前不需要改：已有 canonical store 注入可复用。若实际接线证明必须改它们，这是新的申请项，不是本白名单隐含授权。旧库fallback及App自动回写问题应在新隔离runtime和App调用点阻断，不修改迁移引擎。

## 4. 实验开关与副作用边界

- 只由新本机入口传 `mode: 'mainline-02-i1-isolated'` 的显式 runtime；普通入口无此对象。单凭 URL、localStorage 或全局flag不得激活。
- 挂载前验证测试库名称/运行ID/空v8初始化；每次 load/save/transaction 绑定唯一库和 current 记录。不是只断言界面上的“隔离”字样。
- 新库名 `rco-mainline-01-02-i1-<随机ID>` 与此前所有测试库不同；refresh固定同一个本次库，不重新建空库。重置只新建下一测试库，禁止删除/清空旧库或用户库。
- 模型/状态请求、verifier/Repair/retry、OCR/URL网络0；密钥/剪贴板0。实验只允许旧匿名工程通知，输入不匹配要明确拒绝，不能本地规则替代后称“人工正确响应”。
- 未支持操作的UI规则分两类：在本白名单内的组件预先禁用/说明，且处理器拒绝；只读InboxPage/Sidebar没有capability参数，归档和非核心导航可保留可见按钮，但必须由App守卫在任何写入/页面挂载前明确拒绝并给提示。验收0写入/0挂载，不宣称这些按钮已disabled，也不为此偷偷修改InboxPage/Sidebar。
- App从空库的真实录入保存Source→SourceVersion→Run→Draft，人工回调只在recognize位置返回旧响应，按实际sourceId绑定；不绕过capture，不调用模型。
- 常规App默认、RC.4、Production、已有Preview及用户工作区都不触及。实验首页/录入/收件箱/任务中心/日历/详情查看/JSON导出是本包可用范围；其他导航在页面挂载前拒绝且说明。
- 实验关闭旧整份视图自动保存；V2编辑/确认只通过真实服务事务。来源补充、重识别、归档、拒绝、项目拆合、课程更改、正式任务编辑/完成/提醒在本包不承诺，按上述两类UI规则明确拒绝，不通过隐藏控件制造通过。
- 不支持操作不计成功；保留草稿可退出/稍后核对。若核心录入/保存/部分/批量/刷新必须禁用才能安全，则整个包失败，不能用全部不可操作过门。
