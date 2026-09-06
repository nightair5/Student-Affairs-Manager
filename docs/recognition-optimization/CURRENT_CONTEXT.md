# RCO Current Context

## 当前状态

- 当前包 MAINLINE-REAL-INPUT-01：仅方案准备，未授权实施或模型调用。
- 主线：真实输入→可核对提取文字→真实模型建议→用户确认→隔离保存→找回。
- 本轮只读追踪现有代码；不重审RCO历史、不重造同义语义契约。
- 独立范围复核PASS_SCOPE_REVIEW；预算仍有调用前阻断条件，见本包审查/检查。
- 模型识别准确率：本轮未测量。
- 唯一仓库 C:\Users\Winner\student-affairs-multimodal-exp。
- 唯一分支 codex/e2-multimodal-recognition-exp；不在默认比赛工作区实施。
- 起点/live远端 0eedbf7fc1523d6be476c704ed02b273bdb513bf。
- 上一业务交付 1ae10d8afef8c27fbf2f27ca44072a5ffa98612f；不回切。
- 本轮最终方案提交以Git HEAD/远端核验为准，不用起点冒充交付。

## 当前权威与短入口

- AGENTS/PRD当前主线条款及本次用户授权共同约束。
- mainline-real-input-01/PLAN.md为单一主计划，§7为待批准整包提示词。
- IMPLEMENTATION_WHITELIST.json列41路径：13已有显式增量、28新增。
- VALIDATION_AND_BUDGET.md定义U01–U16、分层指标、A/B/C与硬预算前置条件。
- SCOPE_REVIEW.md绑定方案SHA；CHECKS.json记录本轮保护和文档检查。
- 下一实施起点须取本轮最终文档提交，不能沿用旧checker硬编码HEAD。
- 最新追加日志在OPTIMIZATION_LOG末尾；长证据只按上述入口读取。

## 保护与来源基线

- 起点工作区干净，本机26实现/863保护/4计划/20静态证据/3审查绑定均匹配。
- 旧实现逐字SHA与Git存储SHA分开，沿j03-20260906a/delivery.json。
- 24项Git逐字同，EventDetailPanel/domainCommit仅已登记CRLF→LF映射。
- 不归一化旧文件后重写freeze；不把合法存储映射当无条件忽略换行。
- 全部954个旧只读tracked文件另有工作区摘要，覆盖源码/测试/依赖/历史。
- 本轮起点日志248835字节，SHA 435f7fcd8c4d44fcf6f542a27f54c6f0a203f232f74fdb2521d84786a5d7e20d。
- 只允许本包5方案文件、此短交接与日志追加；所有产品代码本轮只读。

## 下一包拟新增能力（尚未实施）

- 真实App接文字/TXT/MD/PNG/JPEG/WebP/最多6页PDF，文件边界见PLAN。
- 本机OCR与PDF文本层读取，逐页终态和未读范围；不外发图片/文件本体。
- 原读取、校对文字、发送范围、raw模型、适配、首次、真实编辑分别留痕。
- 新real-input-01 profile及mainline-real-input-state-1，旧默认不变。
- 复用WorkspaceV8与mainline04-task-semantics-1，不声称稳定入口可导入。
- SourceOnly先存；未改文字复用版本建Run，正文更正新版本。
- 仅首尾空白的修订在保存前解释并留buffer，不能静默trim或假装已保存。
- 历史草稿绑定自己的版本，当前Source状态由最新Run推导；旧确认不覆盖。
- 新profile完整内存构造/联合校验后CAS原子保存，不允许写后才发现坏图。
- 有限事实纠错：动作对象scope、普通日期、材料字段/显式归属，首次不改。
- 不支持任意漏项补建/复杂共享时间改写；必须明确解释，不能算验收成功。
- 拟采用模型初始不默认选、逐项核对后主动选择；此政策需用户明确批准。
- 自动选择标NOT_ENABLED；错漏候选仍计分，必须有非零真实确认成功。
- 任务中心/首页/日历/详情/真实下载对独立读库复用真实组件，不做玩具页。

## 调用与质量前置条件

- 本次外部识别/模型网络/费用/密钥/剪贴板均0。
- 官方公开模型/Responses参数/人民币表已查；账号/Secret/余额NOT_CHECKED。
- 拟模型deepseek-v4-flash-vision-exp，只发本次确认文字/必要scope信息。
- 拟A8文字+B8文件路径，最多C8新候选已见复测；总24次/人民币10元。
- verifier/Repair/传输retry均0；浏览器与runner同逻辑单元/持久预算账本。
- 单次input上界100000token/output8192的预算仅条件方案，尚未证明。
- 计费上界或服务商硬配额无法证明时PAID_BLOCKED，首个请求前停止付费。
- 优先复用合法服务端Secret，不读剪贴板或将密钥存前端/日志/Git。
- 旧8及B8仅已见诊断；格式载体不是新语义数据集，不称盲测/真实照片。
- 旧V2内存42/42与所有历史40/42、17、FAIL、环境3/1保持只读。
- 新读取完整性、首次建议错漏、最终保存、等待/用量费用分层；真人时间NOT_RUN。

## 实施节奏与停止

- 用户统一批准41路径/政策/条件预算后，连续实现、修补、审查、工程、Edge、Git。
- 普通白名单内问题不拆阶段；每次只修有证据的主因并保留正常对照。
- 未变化SHA证据复用，变化链路重验，最终证据绑定最终实现。
- 保护/重叠修改、文件职责扩大、重大安全或预算失控才停止申请。
- 不改全局Schema/repository/validator/capture/confirmationV2/domainCommit/时间AST/依赖。
- 唯一MAINLINE04拟例外为composer显式profile；其余7与旧测试冻结不变。
- 未授权新数据集/盲测、真人/真实材料、直接视觉外发、真实库、稳定接入、部署/RCO-6。
- 正式任务执行、ICS/真实提醒、账号支付/同步不在本包。
- 方案交付后停止，不自动实施；工程绿不等于模型准确或商业通过。
