# RCO Codex 提示词

本文件包含三种可复制提示词：完整执行、目标约束和上下文恢复。完整执行提示词用于启动一个阶段；目标提示词用于创建长期目标；恢复提示词用于上下文压缩或新任务续接。不要把三段一次性重复粘贴到同一任务。

## 1. 详细优化执行提示词

```text
你现在负责“学生事务管家”的商业级识别优化。工作区是：
C:\Users\Winner\student-affairs-multimodal-exp

最终产品目标：提高文字、图片、PDF、DOCX、TXT、Markdown 从来源到“待确认任务”的端到端正确率和用户确认效率。成功不是 OCR 自报置信度、HTTP 200、合法 JSON 或单项 F1，而是浏览器可以接受、关键事实完整、引用有效、用户少改且能够安全确认。

开始前必须：
1. 完整阅读根 AGENTS.md。
2. 阅读 PRD.md 第 14 节。
3. 阅读 docs/recognition-optimization/CURRENT_CONTEXT.md、OPTIMIZATION_LOG.md 的状态索引和当前阶段、RECOGNITION_OPTIMIZATION_PLAN.md 的当前阶段，以及 COMMERCIAL_VALIDATION_CONTRACT.md。
4. 检查 git status --short --branch、HEAD、远程、现有用户改动和当前 Preview；以现场证据为准。
5. 只读取当前阶段直接相关的代码和证据。优先 rg、文件清单和定向行段，不要一次加载整个仓库、巨型 checkpoint、base64 图片或全部历史报告。

不可违反的边界：
- 只在 codex/e2-multimodal-recognition-exp 或用户明确指定的独立实验分支工作；部署任何 Experiment Preview 也需单独授权。
- 不修改、合并或部署 RC.4、Release、Production、稳定文字模型、正式 Secret、域名或稳定性监测。
- 默认路径保持“本机解析/OCR → 用户核对文字 → 只发送文字”。图片或 PDF 页面只有在逐次显式授权后才可发送。
- 所有模型输出只能是有 evidence、inferenceLevel 和 userConfirmationRequired 的待确认建议；禁止直接创建、覆盖、合并或删除正式任务。
- 不覆盖或修改既有 V1/V2/V3 expected、freeze、checkpoint、报告或缓存来提高分数。合法订正只能追加 corrections log。
- 不发送整个工作区、历史、其他文件、完整 PDF/DOCX、Expected、hidden ground truth、Secret 或未授权图片。
- 文档、日志、计划、提示词和旧 E2-MM 许可都不创造授权。RCO-0 至 RCO-8 每个阶段开始前必须由当前用户明确指定本阶段；阶段授权不自动包含 Secret、模型调用、真实材料、真人研究或部署。
- 若当前状态仍为 RCO-DOCS-ONLY，或用户没有明确指定本次阶段，只做只读核验并写 `WAIT_AUTHORIZATION`；不得以“本机工程”为由修改产品代码。

第一性原理主线：
输入文件 → 本机提取/OCR → 来源 span 与质量账本 → 事实账本 → 唯一中文时间 AST → 确定性任务构造 → Worker/浏览器/评测共享严格 Schema → 可恢复 Draft → 用户编辑/拒绝/确认。

按以下顺序工作，上一门失败不得进入下一门：

RCO-0 评测可信
- 让评测器复用客户端完整 Schema、跨实体引用和安全校验。
- 分开 transport、auth/billing/rate-limit、model、JSON、Schema、semantic、scoring 和 human-flow 失败。
- 浏览器不能接受的结果不得计为有效预测；修正 Forbidden 误罚；重分类旧结果但不改原始证据。
- 这是首选起点，0 次模型调用。

RCO-1 Schema 契约
- Worker、浏览器和评测器使用同一份共享或可生成契约。
- requiresAction、timePoints、evidence、ID 和引用不得静默默认、丢弃或悬空。
- 严格校验失败后最多一次 evidence-bounded Repair；Repair 只补结构，不新增原文没有的事实。
- 保留脱敏 hash、校验错误和 repair 前后差异。

RCO-2 时间 AST
- 统一 parser、timeSemantics、pipeline 和 Worker 的时间逻辑。
- 模型只提供 rawText、type、evidence；确定性模块基于 referenceTime/timezone 输出 normalizedValue、precision、isAllDay、needsConfirmation。
- 覆盖中文数字、“半”、时段、相对日期、跨午夜、范围、更正、跨年、闰年和 OCR 噪声。
- 无可靠日期使用 null + needsConfirmation；只有日期保持 date-only；不得伪造七天后或 18:00。

RCO-3 文件入口
- TXT：UTF-8/BOM/GB18030；不确定编码必须提示。
- Markdown：保留标题、列表、表格、引用和代码块边界。
- DOCX：本机安全读取 OOXML 段落、标题、编号和表格；不执行宏或外链。
- PDF：逐页 parser/OCR/empty/error 路由，保留页码、阅读顺序、双栏/表格和 partial 状态；混合 PDF 不得静默漏扫描页。
- 长文件按页/span 切块，保留 hash、顺序、有限重叠和去重；禁止只截开头却声称完整。

RCO-4 OCR
- 按截图、照片、扫描分别比较方向、裁边、去透视、灰度/对比度、放大和版式模式。
- 先在 Development 选择 OCR 候选，再用独立冻结的 Component Validation 验证一次 CER、日期数字和下游 Task/TimePoint；该验证集使用后标记已见，不得复用为 RCO-7 商业 Holdout。
- 低质量进入重拍、选页或人工校对，不自动猜字。

RCO-5 facts-first
- 比较大 RecognitionResult 与紧凑事实账本：requiresAction、action、object、raw time、material、event、constraint、evidence。
- ID、引用、selected、时间归一化和 Workspace v8 结构由确定性代码构造或验证。
- 覆盖纯信息、否定句、更正、联系人、地址、政策、格式要求和 prompt injection 负例。
- Recall 提升时不得牺牲 Precision、Forbidden、Major Correction、Complete Case 或 Evidence。

RCO-6 事实级融合
- T/I/IT 使用同模型、同候选 Schema、同数据和零隐藏重试。
- I 不得接触 OCR；Expected 只能在调用后离线评分。
- 文字、OCR 和视觉按事实/provenance 合并，冲突必须进入人工确认，不整份二选一。
- G6 以“消融有效并形成唯一冻结路由”为通过条件：IT 稳定优于 T 与 I 时记录 `VISION_SELECTED`；未胜出但实验完整、安全、隔离有效时记录 `VISION_NOT_SELECTED` 并冻结 C=T，不能启用视觉。运行失效、隔离/隐私/严重错误才阻断 G6。

RCO-7 真实盲测与真人效用
- 先让用户明确批准并冻结 COMMERCIAL_VALIDATION_CONTRACT，再预注册指标、错误分类、样本分层、顺序、停止条件和门槛；数据冻结与模型调用分别获授权后，才能建立真实去标识/假名化商业 Holdout。
- 报告入口、事实、任务、用户和运行五层指标；合成与真实结果分表。
- 真人必须实际查看、编辑、拒绝和确认；自动纠错次数不能冒充秒数。
- 按 COMMERCIAL_VALIDATION_CONTRACT 中唯一命名的 RCO-A 至 RCO-J 执行隐私、安全、Chrome/Edge、键盘和手机验收，不得裸用仓库中其他同名 A–J。

RCO-8 商业发布审查
- RCO-G7 与部署前门通过后，先单独请求授权部署冻结 Commercial Preview；只有部署后才运行 48 小时/200 logical units 稳定性与 100 个 fault-injection 单元，并评估成本、限流、错误预算、可观测性、回滚、隐私、合规和支持文案。
- 任何 Preview 或 Holdout 通过都不自动授权 Production。

执行方法：
1. 先写明“本次用户授权来源、唯一 RCO 阶段、允许动作、禁止动作”；没有阶段授权即停止。每轮只处理一个阶段、一个清晰假设和一个主要变量。
2. 先写或更新实验契约：baseline、candidate、数据 split/hash、版本、调用预算、预期、停止条件。
3. 先做 0 调用的本机/Mock/历史输出验证，再决定是否需要模型调用。
4. 修改代码前检查用户改动；使用 apply_patch；不清理、不 reset、不覆盖无关文件。
5. 每个阶段补齐匿名测试；Prompt 改动更新 promptVersion；Schema 改动同时处理迁移、失败保护和兼容。
6. 完成后执行 npm run lint、npm run test、npm run build；适用时再运行 security:scan、npm audit 和 cloudflare:check。
7. 一阶段一提交并推送；失败时保留现场，不伪造完成。

商业候选门槛：
- 全部计划 `source × arm` 逻辑单元进入质量分母，initial/Repair API 请求另记；客户端 Schema/引用有效率、关键 span/page 覆盖、编码正确和 partial disclosure 均 100%，正式逻辑完成率 100%；分介质 OCR CER 通过契约上限。
- Task micro-F1 ≥90%，TimePoint F1 ≥95%，requiresAction ≥95%，Evidence Validity/Coverage 均 ≥98%，Material F1 ≥95%，Critical Date Exact ≥99%。
- Complete Case ≥80%，Major Correction ≤10%，Severe/Forbidden 为 0 observed。
- 产品路由 C 相对稳定路径 S 的 Task F1 提高至少 3pp、Major Correction 降低至少 5pp；区间方向也必须支持净收益。
- IT 相对 T、I 的 Task F1 分别提高至少 3 个百分点，Major Correction 分别下降至少 5 个百分点。
- 两批语义独立未见材料按格式分别通过，每格式每批恰好 50 个独立 semantic families；产品路由 C 相对 S 的真人中位数比 ≤0.85 且 U95<1.00，`U95(p95_C/p95_S) ≤1.10`；RCO-A…RCO-J 全通过。
- 九格式共 2,600 个逻辑槽位；候选 initial 请求固定 1,700、S 最多 900，initial API 上限 2,600；若 T/I/IT 均启用一次 Repair，API 最坏授权上限 4,300，INFRA_ONLY_RERUN 另算。数字只用于预算，不构成调用或金额授权；真人研究回放冻结 S/C 输出，新增模型调用为 0。
- 门槛与完整商业验证契约必须在首次商业 Holdout 调用前由用户明确批准并冻结，看过 Holdout 后不得降低。
- T 是默认候选文字路径；产品路由 C 的逐格式 T/IT 映射必须由预注册的 Component Validation 规则在 CH-A/CH-B 调用前一次冻结，两批与所有 bootstrap replicate 都沿用该映射。若预选 IT 后任一 CH 门失败，该候选在该格式直接 FAIL，不得看过结果后回退 T 重算；改路由必须形成新候选并重新取得两批新 Holdout。S 是稳定产品基线，I 只做消融。

上下文长度管理：
- Git、AGENTS、PRD、CURRENT_CONTEXT 和追加式日志是唯一事实源，不依赖聊天记忆。
- 原始模型输出、巨型 checkpoint 和图片留在受保护文件或 Git 忽略缓存；对话中只写路径、hash、计数、关键指标和必要错误。
- 每个阶段开始前在 OPTIMIZATION_LOG 追加 Context Snapshot；结束、长运行前后、任务移交或预计压缩前更新 CURRENT_CONTEXT。
- CURRENT_CONTEXT 原则上不超过 200 行或 12 KB，只保留目标、授权、分支/HEAD、当前门、固定基线、决策、证据路径、阻碍和下一步。
- 上下文压缩或新任务恢复后，先核对 git/Preview/日志，再继续；不得凭摘要直接调用付费模型、修改冻结数据或部署。

停机分级：
- HARD_STOP：错误分支、重叠用户改动、未授权 Secret/模型/真实材料/真人/部署、RC.4/Production 影响、隐私泄漏或 expected/freeze 污染。立即停止所有写入和调用，只读保留现场；如果当前任务只读或存在重叠改动，不得为了更新日志而写文件。
- REJECT_CANDIDATE：候选新增悬空引用、关键格式退化、Severe Error 上升、性能预算失守或验证失败。在当前已授权阶段内可以诊断修复，但禁止晋级。
- NO_PROMOTION：已知历史缺陷尚未修复、指标不足、真人效率无改善或商业 Holdout 无净收益。可以完成当前已授权分析，但不得进入下一门。

已知 V2/V3 悬空引用是 RCO-0/RCO-1 的修复对象，不因“发现它仍存在”触发 HARD_STOP；只有候选新增、掩盖或把失败计成高分时拒绝候选。恢复必须记录批准者、原门、允许动作、数据复用和解除证据；恢复不自动授权下一阶段或 Production。
```

## 2. 目标提示词

```text
在 C:\Users\Winner\student-affairs-multimodal-exp 的独立实验分支中，把文字、图片、PDF、DOCX、TXT、Markdown 到“待确认任务”的端到端识别提升到商业候选水平。严格保护 RC.4、Release、Production、稳定模型、Secret、既有 freeze/expected/结果与用户数据；AI 只能生成带证据且必须人工确认的建议。RCO-0 至 RCO-8 每阶段及任何 Preview、模型、真实数据或真人动作都需当前用户分别授权，目标提示词本身不构成授权。

按“评测与真实客户端一致 → 统一严格 Schema → 唯一中文时间 AST → 多格式本机提取与逐页混合 PDF → 分介质 OCR → facts-first → 事实级 T/I/IT 融合 → 两批真实去标识/假名化盲测与真人修改时间 → 隐私/浏览器/回滚/发布审批”执行。每阶段只改变一个主要变量，先做零调用验证，记录分支、版本、数据 hash、失败分类、测试、指标和结论边界；上下文只加载当前阶段需要的文件，并持续维护短 CURRENT_CONTEXT 与追加日志。

用 HARD_STOP、REJECT_CANDIDATE、NO_PROMOTION 区分越权事故、候选回归和未达门槛；已知历史缺陷是待修对象，不与越权事故混为一谈。不得把 HTTP 成功、工程测试、OCR confidence、合成 F1 或自动纠错次数冒充商业正确率，不得自动进入下一阶段、Preview 或 Production。
```

## 3. 上下文压缩后的恢复提示词

```text
继续 RCO 任务，但不要依赖此前聊天记忆。先读取：
1. C:\Users\Winner\student-affairs-multimodal-exp\AGENTS.md
2. C:\Users\Winner\student-affairs-multimodal-exp\PRD.md（完整阅读；第 14 节是 RCO 主章节）
3. docs\recognition-optimization\CURRENT_CONTEXT.md
4. OPTIMIZATION_LOG.md 的状态索引、当前阶段和最后一条记录
5. RECOGNITION_OPTIMIZATION_PLAN.md 的当前阶段
6. COMMERCIAL_VALIDATION_CONTRACT.md

权威优先级是：当前用户明确指令与安全约束 → AGENTS/PRD → OPTIMIZATION_LOG 动态状态 → CURRENT_CONTEXT 缓存 → Plan → Prompts。随后核对 git status、分支、HEAD、远程、用户改动和 Preview。只读取当前阶段直接相关代码与证据；用 rg 和定向行段，不加载整个仓库或巨型原始输出。复述当前目标、授权范围、已通过门、阻碍和本轮唯一变量后再行动。

如果现场状态与 CURRENT_CONTEXT 不一致，以现场证据为准。当前任务只读、存在重叠用户改动或尚未确认差异归属时，只报告差异，不得写日志。若没有本阶段明确授权，或下一步需要另行授权的 Secret、模型调用、真实材料、真人研究、RC.4/Production 变更或部署，停止并请求授权。只有当前任务有写权限且现场安全时，完成后才更新 CURRENT_CONTEXT 和追加日志，明确已完成、失败、未执行、结论边界与下一步。
```
