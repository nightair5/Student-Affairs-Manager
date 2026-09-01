# RCO 商业验证契约

**contract_id**：`rco-commercial-validation`

**contract_version**：`0.6.0-draft`

**状态**：`DRAFT_UNAPPROVED / NOT FROZEN / NOT AUTHORIZED TO RUN`

**适用阶段**：RCO-4 组件选择、RCO-6 融合消融、RCO-7 商业 Holdout 与真人效用、RCO-8 发布审查

本文件是 RCO 的指标、样本、真人计时、数据处理、运行预算和浏览器验收的唯一执行契约。PRD 只保留产品门槛摘要；日志记录实际版本、哈希和结果。首次商业 Holdout 调用前，用户必须明确批准本文件的冻结版本与哈希。批准契约不等于授权数据收集、模型调用、真人研究、Preview 或 Production。

`RCO-DOCS` 文档验证通过只表示本草案内部一致、可供决策，不把 `DRAFT_UNAPPROVED` 改为冻结批准，也不授权任何运行。

## 1. 判定原则

1. 全部计划的 `source × arm` 逻辑单元进入质量完成率分母；initial/Repair 是该逻辑单元的 API 子请求，另行完整记账但不各自变成质量样本。任一实验臂 `completed logical units < planned logical units`，该原子配对运行的正式质量结论为 `INVALID_RUN`。可另报条件性诊断分数，但不得晋级。
2. 两批商业 Holdout 必须语义独立、此前未见、分别过门；不得合并两批掩盖一批失败。
3. Development、组件验证集、Golden、商业 Holdout 分开冻结并记录哈希。商业 Holdout 的“未见”是指候选开发者、运行人员与模型在冻结前未见输入/Expected；独立标签人员制作 Expected 不破坏未见资格。
4. 一次预注册的非视觉 `S/T` 或视觉 `S/T/I/IT` 配对运行是一个原子使用事件：运行开始后数据状态从 `UNSEEN_FROZEN` 变为 `EVALUATION_IN_PROGRESS`，必须按冻结顺序完成全部计划臂，再统一揭盲评分。C 由 T/IT 结果确定性派生，不增加调用。第一臂调用不会使同一原子运行的剩余臂失去资格。
5. 绝对质量门适用于拟进入产品的候选路径；T/I/IT 的相对门只决定是否启用“发送本次图片”视觉附加能力。
6. 状态只有 `NOT_RUN / BLOCKED / INVALID_RUN / INSUFFICIENT_N / NOT_OBSERVABLE / FAIL / PASS`。历史 `PARTIAL` 在商业门中按 `FAIL` 处理；任何非 `PASS` 不得被总体平均掩盖。
7. 合成、Mock、工程、真实去标识/假名化材料、真人效用、Preview 稳定性和 Production 审批分层，不得互相替代。

## 2. 冻结对象与版本

每次正式运行的 manifest 必须记录：

- `contract_version`、本文件 SHA-256 与冻结 commit；
- `dataset_id/split/sha256/seen_status`、冻结 canonical source roster、`semantic_family_id`、`risk_family`、输入格式和来源页；
- `model`、`promptVersion`、`pipelineVersion`、`clientSchemaVersion`、`scorerVersion`；
- 本机提取器、OCR、时间 AST、事实构造器和浏览器构建的 commit/hash；
- T/I/IT/S 输入边界、repair 上限、重试政策、计划调用、金额上限和批准记录；
- 冻结 Task/TimePoint/Material/Event/ExecutionConstraint alias/category 表及其 SHA-256；
- scorer、PRNG 与依赖版本、reference device、浏览器版本、网络档位、测试时间和 Preview endpoint。

任一冻结项变化即形成新候选版本；不得把前后运行拼成同一正式结果。

影响公式、分母、门槛、格式范围、实验臂、区间、真人计时或数据保留的变更属于 breaking change：首个冻结版以前的 `0.x` 草案递增 minor，冻结到 `1.0.0` 后递增 major；增加不参与门控的描述指标升级 minor；不影响判定的文字修正升级 patch。CH-A 揭盲后若发生任何门控变更，旧 CH-A 只能诊断，新候选必须重新取得两批证据。

## 3. 实验臂与可比较性

| Arm | 输入 | 用途 |
|---|---|---|
| S | 当前稳定产品的本机文字路径与稳定模型 | 产品基线；不用于隔离视觉增量 |
| T | 候选模型只接收同一份冻结文字/OCR，不接收图片 | 候选文字基线 |
| I | 候选模型只接收授权图片/选页，不接收 OCR 文字 | 视觉消融；不作为默认产品路径 |
| IT | 候选模型接收同一授权图片/选页与对应 OCR 文字 | 视觉附加候选 |
| C | 在任一商业 Holdout 开始前冻结的拟上线产品路由：非视觉格式固定走 T；每个视觉格式预先固定走 T 或 IT | 真人效用与 Commercial Preview 候选；不是第五个模型消融臂，也不得由 CH 结果事后选择 |

T/I/IT 必须使用同一模型、Prompt、Schema、解码参数、调用顺序策略、Repair 政策和零隐藏重试。I 的 initial 与 Repair 请求体都不得包含 OCR、文件名泄漏的正文、Expected 或 ground truth。S 与候选的差异用于产品价值判断，不得冒充纯模态消融。

C 的逐格式路由表必须在 CH-A 与 CH-B 任何调用前随候选 manifest 一次冻结，并由 Component Validation 的预注册规则产生；两批使用完全相同的路由。CH-A、CH-B 只确认这个既定候选，不参与选路由，bootstrap 每次重采样也直接使用冻结映射，绝不在 replicate 内重选。若某视觉格式预先选择 IT，则 IT 必须在 CH-A、CH-B 各自通过绝对门及 IT-vs-T、IT-vs-I 增量门；任一失败使该候选在该格式 `FAIL`，不得在同批回落到 T 后重算 C。若预先选择 T，则该候选不申请该格式的云端视觉附加能力，IT 结果只作独立消融。改变任何格式的 C 映射都形成新候选，必须重建两批新的商业 Holdout 证据。

RCO-G6 判定的是消融是否完整可信并能冻结唯一产品路由，不把“视觉必须胜出”作为文字候选的前提：配对运行、输入隔离、provenance、隐私/严重错误与预注册评分全部有效时，IT 达增量线记 `VISION_SELECTED`，否则记 `VISION_NOT_SELECTED` 并冻结 C=T，两者都可使 G6 为 `PASS`。任一臂 `INVALID_RUN`、输入串臂、隐藏重试、隐私/Severe/Forbidden 或无法唯一判定时 G6 非 PASS。`VISION_SELECTED/NOT_SELECTED` 是路由决策标签，不是第 1 节结果状态。

门槛映射唯一如下：

- Formal Completion、隐私与 Severe/Forbidden 对 S/T/I/IT 全部报告；候选 T/I/IT 必须通过同一候选客户端 Schema，S 按冻结的当前稳定客户端与只读 evaluation adapter 评分。S 对尚不支持的格式返回明确 `unsupported/manual fallback` 是可评分终态，不算 transport 缺失，但按任务/用户指标记失败。任一正式臂没有可评分终态即该配对运行 `INVALID_RUN`。
- T 在九种格式中通过绝对门，证明默认候选文字路径；仅当冻结 C 路由已为某视觉格式预注册 IT，且 IT 在该格式的两批中同时通过绝对门和 IT-vs-T/I 增量门，才证明该预注册视觉候选可用。
- I 只作为视觉消融，不因绝对质量低而单独阻止 T；但 I 的输入隔离、完成率、客户端有效性、隐私与 Severe/Forbidden 仍是阻断门。
- 产品自动质量比较为 T-vs-S；视觉增量比较为 IT-vs-T 与 IT-vs-I；真人效用比较为 C-vs-S。“对应基线”只允许按此映射解释。

## 4. 数据集与样本下限

### 4.1 数据集角色

- `Development`：可迭代调试；允许选择候选，不产生晋级结论。
- `Component Validation`：在单个组件候选选择前冻结，用于 RCO-3/RCO-4；首次查看结果后标记 `SEEN_DIAGNOSTIC`，不得成为商业 Holdout。
- `Golden`：匿名合成/确定性回归集，只验证已知业务规则与工程不退化；可重复运行，但不产生真实泛化或商业结论。
- `CH-A / CH-B`：真实去标识、语义独立的商业 Holdout；只有预注册的原子多臂运行可以接触，逐批揭盲，分别判门。

`INVALID_RUN` 后默认不得在同批重跑。仅当失败被独立确认是认证、计费、网络或平台中断，候选/契约/数据均未变化，Expected 和有效输出未向开发者揭示，且用户明确批准 `INFRA_ONLY_RERUN` 时，才可用新 run ID 重跑整个受影响配对 block；旧输出保留并单列。模型、Prompt、Schema、semantic、scoring 或候选质量失败不得在同一 CH 修复后重跑；一旦结果用于改候选，该批永久转为 `SEEN_DIAGNOSTIC`。

### 4.2 商业 Holdout

- 使用两批独立商业 Holdout：`CH-A` 与 `CH-B`；任何素材不得与 Development、Golden、组件验证集或另一批共享语义模板、通知改写或仅换皮渲染。
- 每个对外声称“商业支持”的输入格式，每批固定 **恰好 50 个独立 semantic-family clusters**；同一语义的截图、照片、PDF 或措辞变体只计 1 个 cluster。50 是本契约的固定商业样本，不保证区间必然过门；区间未过即 `FAIL`，不得在同一批事后扩样。需要更大 n 时必须升级契约、另获授权并建立两批新 Holdout。
- 每个 `batch × format × semantic_family_id` 必须且只能冻结 1 个 canonical `source_id`，因此每批每格式恰好 50 个门控 sources。页、区块和同一 source 的重复读取是该 canonical source 内部观测，不增加 logical unit、API 请求或样本 n；同一 family 的其他渲染/措辞变体只能进入 Development/诊断，不得混入商业分母。商业 manifest 必须列出两批共 `2 × 9 × 50 = 900` 个 canonical source tuples；缺一、重复或额外加入都使运行 `INVALID_RUN`。
- 当前目标格式为：直接文字、TXT、Markdown、DOCX、文本 PDF、混合 PDF、截图、照片、扫描 PDF。冻结前不足 50 标记 `INSUFFICIENT_N`；冻结后计划或完成数不等于 50 使原子运行 `INVALID_RUN`。不得对非 PASS 格式作商业正确率声明。
- 图片增量结论覆盖混合 PDF、截图、照片、扫描 PDF 四类；每类每批完成原子 S/T/I/IT，共 `2 × 4 × 50 × 4 = 1,600` 个 logical execution slots。
- 直接文字、TXT、Markdown、DOCX、文本 PDF 五类完成 S/T 端到端配对，共 `2 × 5 × 50 × 2 = 1,000` 个 logical execution slots。当前九格式商业声明固定 `N_logical=2,600`。预算不足时应缩小商业声明范围并升级契约，不能少跑后仍声称九格式商业可用。
- 每个格式、每批还需至少 30 个 expected tasks、20 个 TimePoints、15 个 Materials、4 个 no-action cases 和 4 个 partial/limit cases；不足的适用指标标记 `INSUFFICIENT_N`，不得以空分母记 PASS。

### 4.3 样本构成

每个格式必须覆盖：简单单任务、多任务、多时间点、材料与格式约束、事件与准备任务、相对/模糊时间、纯资讯无任务、失败/回退至少八类中的适用类别。高风险类别（截止时间、更正通知、纯资讯误建任务）每批各不少于 5 clusters。

去标识或格式转换不得破坏任务数、时间、材料、版式关系和难度。独立标签人员可以在冻结前制作 Expected；运行人员和候选开发者不得查看。揭盲后的任何合法标签订正只追加 corrections log，并使该材料退出未来未见集资格。

## 5. Metric Contract v1

正式 scorer 标识为 `rco-metric-v1`。所有指标按 source 评分并保留逐例错误；以下定义未经冻结批准不得临时解释。

| 指标 | 唯一定义 | 商业绝对门 |
|---|---|---:|
| Formal Completion | 冻结逻辑 pipeline 在最多一次预注册 Repair 后得到可评分终态的 logical sources / 全部计划 logical sources；transport、认证、计费、限流或 Repair 后仍存在模型/JSON/Schema 失败均算未完成 | 100% |
| Client Validity | 通过对应冻结客户端完整 Schema、安全规则、ID 唯一性、Evidence 与跨实体引用校验的完成 logical units / 全部计划 logical units；Repair 只决定该 logical unit 的最终结果 | 100% |
| Critical Span/Page Coverage | 按 5.1 节：本机提取结果中内容、page/segment 与偏移均正确的 `critical_truth.required_span_id` / 全部冻结 required span IDs | 100% |
| Encoding Fidelity | TXT/Markdown 冻结可见字符逐 code point 正确，且 U+FFFD、确定性乱码和未声明替换为 0 | 100% |
| OCR CER | `(替换+删除+插入)/ground-truth characters`；逐格式汇总，不使用 OCR 自报置信度 | 截图 ≤5%；扫描 PDF ≤8%；照片 ≤12%；混合 PDF OCR 页 ≤8% |
| Partial/Truncation Disclosure | 所有漏页、空页、上限、错误页或截断都被正确标记且阻止“完整”声明 / 全部 partial cases | 100% |
| Task micro-F1 | 在全批汇总 TP/FP/FN 后计算；TP 必须 action、object、requiresAction 语义一致且能一对一匹配，不平均逐例 F1 | ≥90% |
| TimePoint F1 | 时间值、precision、type、timezone/isAllDay 与关联任务均一致才计 TP；模糊时间正确保留待确认也可匹配 | ≥95% |
| requiresAction Accuracy | 每个 source 的行动性二分类完全正确 / 全部 source | ≥95% |
| Evidence Validity | 按 5.1 节：五类全部 prediction entities 中，一对一匹配 truth 且至少一条 evidence 能定位并蕴含完整事实的比例；不因 inference/selected 状态排除 | ≥98% |
| Evidence Coverage | 按 5.1 节：正确预测且至少有 1 条 Valid evidence 的 `critical_truth` / 全部 `critical_truth`；漏预测或无效 evidence 均计失败 | ≥98% |
| Material F1 | 必需材料集合一对一匹配后的 micro-F1；材料名称、数量与关键格式约束共同判定 | ≥95% |
| Critical Date Exact | 按 5.1 节固定关键类型：完整 TimePoint 匹配键完全正确的关键时间 truth / 全部关键时间 truth；缺失或错误计失败，额外时间另由 TimePoint FP 惩罚 | ≥99% |
| Complete Case | 按 5.1 节逐 source 同时满足行动性、critical/optional truth、零多余预测、全部 evidence 与错误门的比例 | ≥80% |
| Major Correction | 用户必须新增/删除任务，或修改 requiresAction、动作、对象、截止时间、必需材料、事件关系才能正确确认的 source 比例 | ≤10% |
| Severe Error | 错误截止导致可能错过义务、纯资讯/否定项被建任务、漏掉强制行动、无证据编造、越权写正式任务或隐私泄漏 | 0 observed |
| Forbidden Task | 联系方式、地址、背景、政策、格式说明或材料名称在无独立动作时被单独建成任务 | 0 observed |
| Repair Invocation / Harm | 启用 Repair 时，发生第二请求的 logical sources 比例；Repair 新增错误、事实或使正确结果变坏均为 harm | ≤5% / 0 observed |

入口指标适用矩阵固定如下：`DT` 直接文字、`TX` TXT、`MD` Markdown、`DX` DOCX、`PT` 文本 PDF、`PM` 混合 PDF、`SS` 截图、`PH` 照片、`SP` 扫描 PDF。

| 指标 | DT | TX | MD | DX | PT | PM | SS | PH | SP | 每格式每批最低分母 |
|---|---|---|---|---|---|---|---|---|---|---:|
| Critical Span/Page Coverage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 全部 expected 关键 spans |
| Encoding Fidelity |  | ✓ | ✓ |  |  |  |  |  |  | 50 clusters 的全部可见字符 |
| OCR CER |  |  |  |  |  | ✓ | ✓ | ✓ | ✓ | 10 个 OCR 页面且 500 个 ground-truth 字符 |
| Partial/Truncation Disclosure | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 4 个 partial/limit cases |

空白格使用 manifest 标记 `NA_BY_CONTRACT`，它是适用性说明，不是结果状态，也不参与父门归约。只有矩阵中带 ✓ 的指标出现零分母时才标记 `INSUFFICIENT_N`。Task、TimePoint、requiresAction、Evidence、Material、Complete Case、Major、Severe、Forbidden 与适用的 Repair 对九格式均为必测。

### 5.1 冻结真值实体与分母

Expected manifest 只允许以下门控真值实体，冻结后 scorer 不得再解释“关键”的含义：

| Truth kind | 一个计数单位的完整匹配键 | Span Coverage | Evidence Validity | Evidence Coverage | Complete Case | Critical Date Exact |
|---|---|---:|---:|---:|---:|---:|
| `Task` | action + object + requiresAction + 关联目标 | ✓ | ✓ | ✓ | ✓ |  |
| `TimePoint` | normalized value + precision + type + timezone/isAllDay + 关联 Task/Event | ✓ | ✓ | ✓ | ✓ | 仅下述关键类型 |
| `Material` | name + quantity + format constraint + 关联 Task | ✓ | ✓ | ✓ | ✓ |  |
| `Event` | event type + object + 关联 Task；时间另计 TimePoint | ✓ | ✓ | ✓ | ✓ |  |
| `ExecutionConstraint` | category + normalized value + appliesTo；只含会改变执行方式的渠道、地点、收件对象、数量或格式要求 | ✓ | ✓ | ✓ | ✓ |  |
| source-level `requiresAction` | 每个 source 一个布尔 truth |  |  |  | ✓ |  |

每个 truth entity 必须有唯一 `truth_id`、上述完整匹配字段、`requiredness=required|optional`、`inference_level` 和至少一个 source reference。`critical_truth` 被机械定义为：所有 required Task；所有与 required Task/Event 相连且影响履约的 TimePoint、Material、Event、ExecutionConstraint。背景、无执行作用的联系人/地址/政策说明和措辞信息固定为 `context`，不得由 scorer 临时升降级。关键时间类型全集固定为 `deadline / event_start / event_end / appointment / window_start / window_end`；其他日期只进 TimePoint F1，不进 Critical Date Exact。

- `Critical Span/Page Coverage` 分母是全部 `critical_truth` 在 Expected 中列出的 `required_span_id`；每个 required fact 至少 1 个，否则该数据集 `INVALID_RUN`。一个 span 只有在提取文本保留规范化等价内容、page/source segment 正确且起止偏移可定位时计入分子。直接文字使用虚拟页 `source:1`。多个 required spans 各自计数，禁止用一个大范围覆盖多个漏失事实。
- `Evidence Validity` 分母是候选输出中上述五类事实的全部 prediction entities，不论其 inference level 或 selected 状态；只有 prediction 与 truth 一对一匹配，且至少一条 evidence 的页/span 有效并蕴含完整匹配键时进入分子。把无证据事实标成 optional 不能逃避分母。
- `Evidence Coverage` 分母是全部 `critical_truth` entities；分子要求该 truth 被正确一对一预测且至少有 1 条 Valid evidence。漏预测、只有无效引用或只引用不蕴含该事实的背景文字都计失败。
- `Complete Case` 逐 source 判定：source-level requiresAction 正确；全部 critical truth 精确匹配；optional prediction 只能匹配 Expected 中同样标记 optional 的 truth 且必须默认未选；上述五类 prediction 不得有未匹配项；全部 prediction evidence 有效；同时无 Major、Severe、Forbidden。任一条件失败，该 source 记 0。
- `Critical Date Exact` 分母是 Expected 中属于固定关键时间类型的全部 TimePoint truth entities；其完整匹配键全部一致才入分子。分母为 0 的格式/batch 是 `INSUFFICIENT_N`，不得跳过。

Task/TimePoint/Material 使用冻结 alias 表和最大二分一对一匹配；Event/ExecutionConstraint 使用各自冻结 alias/category 表和同一算法。同权重匹配按 truth ID、prediction ID 字典序确定，避免实现差异。truth 与 prediction 都为空时该集合指标不增加 1 分，只由 requiresAction、Complete Case 和 no-action 指标覆盖；任一门控分母为 0 时状态为 `INSUFFICIENT_N`。

措辞润色、同义词和不影响执行的标题编辑不计 Major Correction，也不使 Complete Case 失败，但必须单独记录 minor edit。自动 Repair 或本机纠错次数不是用户修改次数。

## 6. 比较门与统计区间

- IT 相对 T、I 的 Task micro-F1 点差均须 `≥ +3pp`，且调整后单侧 bootstrap 区间下界 `> 0`。
- IT 相对 T、I 的 Major Correction 点差均须 `≤ -5pp`，且调整后单侧 bootstrap 区间上界 `< 0`。
- 产品路由 C 相对 S 的 Task micro-F1 点差须 `≥ +3pp` 且调整后区间下界 `>0`，Major Correction 点差须 `≤ -5pp` 且调整后区间上界 `<0`；非视觉格式 C=T，视觉格式严格读取第 3 节在两批运行前冻结的逐格式路由，禁止依据当前 batch 或当前 bootstrap replicate 的 IT 结果重选。
- 非视觉每格式的联合主比较数 `K=2`（冻结 C-vs-S 的 F1、Major）；视觉每格式 `K=6`（冻结 C-vs-S、IT-vs-T、IT-vs-I 各自的 F1、Major）。即使冻结 C=T 或 C=IT 使部分统计量共享数据，也保持 K=6，不减少校正。每项使用 `alpha=0.05/K`：改善指标的单侧下界是 bootstrap delta 分布的 `quantile(alpha)`，下降指标的单侧上界是 `quantile(1-alpha)`。禁止改用普通 95% 区间。
- T 相对 S、IT 相对 T/I 的 Precision、Recall、TimePoint、Material、requiresAction、Evidence Validity、Evidence Coverage 与 Complete Case **点差**不得低于 `-1pp`；这些是无额外 CI 的安全非退化门。Severe/Forbidden 仍须 0 observed。
- 自动指标采用 10,000 次 paired stratified cluster bootstrap。在每个 batch × format 内按冻结的 `risk_family` 分层，对 `semantic_family_id` 有放回抽样；每层每次抽取与原层相同数量的 clusters，同一 family 的 S/T/I/IT、页面与重复观测始终成组进入同一次重采样。每次重新汇总 TP/FP/FN 和 source 事件后计算指标，并按上一条的 alpha 取 percentile 单侧界；不得平均 case F1，不把渲染变体当独立 n。
- 随机种子唯一生成：`uint32(first_8_hex(SHA256(contract_hash | dataset_hash | batch_id | format_id | comparison | metric)))`。自动分格式使用实际 batch/format；真人 pooled 分析固定写 `batch_id=HUMAN_POOLED`、`format_id=ALL_FORMATS`。manifest 保存输入字符串、SHA-256 和十进制 seed；实现不允许自行换 seed 或重跑挑区间。
- PRNG 固定为 `PCG32 XSH-RR 64/32 v1`：无符号 64 位模 `2^64` 运算，`multiplier=6364136223846793005`、`increment=1442695040888963407`；初始化 `state=0`，调用一次 `next()`，令 `state=(state+seed) mod 2^64`，再调用一次 `next()`。`next()` 先保存 `oldstate`，再执行 `state=(oldstate×multiplier+increment) mod 2^64`，令 `xorshifted=uint32(((oldstate>>18)^oldstate)>>27)`、`rot=oldstate>>59`，最后返回 32 位 `rotate_right(xorshifted, rot)`。bounded draw 使用 rejection sampling：`threshold=(2^32-bound) mod bound`，持续取 `r` 直到 `r>=threshold`，返回 `r mod bound`；禁止直接取模。
- 每次运行把 `risk_family` 按 UTF-8 byte lexicographic 排序，层内 canonical sources 按 `semantic_family_id`、`source_id` 同序排序；replicate 从 1 到 10,000 连续消费同一 PRNG stream。bootstrap delta/ratio 的分位数统一使用 Hyndman-Fan Type 7，对 10,000 个值升序后计算；任何 replicate 出现零分母、NaN、Infinity 或缺失配对，整项标记 `INSUFFICIENT_N`，不丢弃、不补抽、不换 seed。reference scorer 必须对固定 fixture 产出冻结的前 20 个 PRNG uint32、前 20 个抽样 index 和区间结果，跨语言实现逐字节一致才可运行正式集。
- 缺失配对、无法评分或任何门控分母为 0 分别触发 `INVALID_RUN` 或 `INSUFFICIENT_N`，不得插补为正确。除第 4.1 节批准的整 block 基础设施复跑外，不进行隐藏重试。
- 每个绝对门槛在 CH-A、CH-B 以及每个声称支持的格式中分别判定。总体 PASS 不能挽救任何格式 FAIL。
- Severe 与 Forbidden 分别在每个 `arm × batch × format` 上报告原始错误实例总数，以及含至少一个该类错误的 logical-source 数 `x`；同一 source 多个实例时 `x` 只加 1。Clopper-Pearson 的分母 `n` 是该单元全部 planned logical sources，`x<n` 时一侧 95% 精确上界 `U95=BetaInv(0.95; x+1, n-x)`，`x=n` 时为 1；`x=0` 的等价式为 `1-0.05^(1/n)`。reference scorer 固定实现与 12 位小数 fixture；`0 observed` 同时要求实例数与 x 均为 0，且仅表示本次未观察到，不得表述为风险为零。

## 7. 真人效用协议 v1

真人研究需另行明确授权并在收集前冻结同意说明、任务顺序和排除规则。

- `participant_started` 是完成同意并打开第 1 个 trial 的人；`participant_completed` 必须完成全部 6 个 trial 的最终确认/全部拒绝。至少 40 人 started，且 `participant_completed / participant_started ≥95%`（40 人时至少 38 人）。
- 六个 trial 在参与者开始时即全部预分配。`planned_trials_all = participant_started × 6`，`planned_trials_S = participant_started × 3`，`planned_trials_C = participant_started × 3`；参与者退出后尚未打开的预分配 trial 仍在对应臂分母中。`trial_completed` 是在 900 秒内完成确认/全部拒绝的 trial。总体、S、C 各自的 `completed/planned ≥95%`，每臂还需至少 100 个 completed trials。所有 started 参与者按 intention-to-treat 进入主分析，部分完成者不被删除。
- 每人处理 6 份互不重复材料，S 与第 3 节定义的产品路由 C 各 3 份，采用 Latin-square 平衡顺序、材料、格式和学习效应。每个格式、每个条件至少 12 个 completed trials 且覆盖至少 6 个 semantic families；I 只做离线消融，不让用户走非产品路径。
- 真人研究使用商业原子运行已冻结的 S/C 输出做本机回放，模型调用为 0；不允许研究中重新调用或挑选输出。C 的 active-edit 起点是建议首屏可交互；S 对 unsupported/manual fallback 的起点是 Source 与空白手动编辑器同时可交互。另将正式运行观测到的 source-to-interactive latency 与 active_edit_time 相加，报告 `experience_time_proxy`，不得冒充真人实时网络计时。
- `active_edit_time`：建议完整可见且可编辑起，到最终确认/全部拒绝止；`wall_time`：用户提交来源起，到最终确认/全部拒绝止。两者均记录，不能扣除看似“非编辑”的人工核对时间。
- 主门：C 相对 S 的 active edit time 中位数比 `≤0.85`，且 participant/semantic-family 聚类 bootstrap 的 `U95(median_C / median_S) < 1.00`。
- 真人区间采用 10,000 次 two-way pigeonhole bootstrap：参与者与 semantic family 分别有放回抽样，交叉观测按两者抽样次数乘积计权；每次重算 condition median 与 Type-7 p95，使用 percentile 一侧 95% 上界。seed 按第 6 节公式生成，并把 `comparison=C_vs_S` 写入输入。
- 尾部非劣：`U95(p95_C / p95_S) ≤ 1.10`。完成率低于 95%、completed trials 不足或计时事件缺失时分别标记 `INSUFFICIENT_N` 或 `NOT_OBSERVABLE`，总体为 `FAIL`。
- 单 trial 上限冻结为 900 秒。用户主动放弃、超时、页面崩溃或候选失败不删除：trial_completed 记 0，active/wall time 记 900 秒并进入 intention-to-treat 主分析。影响分配、计时或主要结果的研究者操作错误使研究运行 `INVALID_RUN`；不影响主变量的 deviation 只追加记录。不得删除、替换 trial 或另招样本后挑选结果。
- 同时报告确认完成率、放弃率、Major/minor 修改字段、依据查看率、误确认和主观困难；不得仅挑完成者中最快样本。

## 8. 运行、成本与错误预算

以下是拟冻结预算；正式值必须与 reference device 和金额上限一起由用户批准。任何字段 `NOT_OBSERVABLE` 均阻止商业晋级。

| 项目 | 候选预算 |
|---|---:|
| 直接文字/TXT/Markdown 本机处理 p95 | ≤ 1 秒 |
| DOCX/文本 PDF 本机提取 p95 | ≤ 5 秒 |
| 单图本机 OCR p95 | ≤ 15 秒 |
| 用户选定 1–4 页本机 OCR p95 | ≤ 45 秒 |
| 云端候选请求 p95 | ≤ 40 秒；IT/T 的 p95 比一侧 U95 ≤1.20 |
| 来源提交到建议可编辑 wall-time p95 | 单图/单页 ≤50 秒；最大 4 页范围 ≤90 秒 |
| 峰值增量内存 | 桌面 ≤512 MiB；参考移动设备 ≤256 MiB |
| Worker 结束 60 秒残留 / 连续 20 来源增长 | ≤64 MiB / ≤5 MiB 每来源 |
| 未恢复的 transport/Schema failure | 0；允许的 Schema Repair 后仍失败或任一 transport 失败均使对应 logical unit 未完成，原子块 INVALID_RUN |
| Source/Draft 保留与本地回退成功率 | 100% |
| 自动/隐藏 transport retry | 商业 Holdout 为 0；首试失败使配对 block INVALID_RUN，基础设施复跑只按 4.1 节处理 |
| token 与单份完成成本 | 100% 可观测；IT mean ≤2×T、p95 ≤2.5×T，且不超过运行前用户批准的绝对数值上限 |

延迟与内存的 p95 使用 Type-7 quantile。IT/T 延迟比采用与第 6 节相同的 10,000 次 paired semantic-family bootstrap和 percentile 一侧 95% 上界；seed 固定使用 `batch_id=RUNTIME_HOLDOUT`、实际 `format_id`、`comparison=IT_vs_T`、`metric=latency_p95_ratio`。Commercial Preview 聚合运行指标使用 `batch_id=RUNTIME_PREVIEW`、`format_id=ALL_FORMATS`。

商业调用预算按冻结样本量计算：

```text
N_logical = 2 batches × [4 × sum(n_visual_format) + 2 × sum(n_nonvisual_format)]
N_candidate_initial = 2 batches × [3 × sum(n_visual_format) + 1 × sum(n_nonvisual_format)]
N_stable_initial_max = 2 batches × [1 × sum(n_visual_format) + 1 × sum(n_nonvisual_format)]
N_initial_api_max = N_candidate_initial + N_stable_initial_max
N_repair_max = 2 batches × [3 × sum(n_visual_format) + 1 × sum(n_nonvisual_format)]
N_api_authorized_max = N_initial_api_max + N_repair_max
```

S 不使用候选 Repair；T/I/IT 共享同一最多一次 evidence-bounded Repair，非视觉只有 T 可 Repair。n=50 时：`N_logical=2,600`、候选 initial 请求固定 1,700、S initial 请求最多 900，因此 `N_initial_api_max=2,600`；`N_repair_max=1,700`，`N_api_authorized_max=4,300`。S 的 unsupported/manual fallback 可能产生 0 个 API 请求，所以实际 initial 请求可少于 2,600，但 logical 分母不变。Repair 是单独可见的第二请求，必须逐项记录且不得用于 transport 重试。任何 `INFRA_ONLY_RERUN` 不包含在上限内，必须另获调用和金额授权。

以下两段是 **Commercial Preview 获得单独部署授权之后** 收集的 RCO-G8 证据，不是申请部署该 Preview 的前置条件。部署后需独立至少 48 小时、至少 200 个 planned logical units 的候选稳定性验证；九格式各至少 20 个，其余按冻结风险配额分配。`user_visible_failure = 在最多一次允许 Repair 后，未能在对应 wall-time 预算内给出可编辑建议或明确安全 fallback 的 logical units / 全部 planned preview logical units`，门槛 ≤1%。Repair 成功不算 user-visible failure，但进入 Repair rate；超时后才恢复仍算失败。Schema/unknown/data loss/Severe/Forbidden/隐私事件均为 0，p95 不超过上述预算。

Fallback 另跑至少 100 个必需 fault-injection logical units，九格式各至少 10 个。以下每项是独立故障：not-configured、timeout、HTTP 502、rate-limit、invalid JSON after allowed Repair、invalid Schema after allowed Repair、semantic rejection 分别对九格式至少 1 次；local extraction failure 对 TX/MD/DX/PT/PM/SS/PH/SP 各至少 1 次，OCR failure 对 PM/SS/PH/SP 各至少 1 次，其余配额按冻结风险比例补足。`eligible failure` 是上述注入故障或自然发生且在允许 Repair 后仍进入同一安全 fallback 契约的故障；`fallback recovery = 正确保留 Source/Draft、正式任务为 0 且可进入本地/手动路径的 eligible failures / 全部自然与注入 eligible failures`，门槛 ≥99%。注入保证分母非 0；自然失败追加到分母，不替代注入配额。该候选稳定性验证不替代正在进行的 RC.4 稳定性监测，也不授权 Production。

## 9. 数据与隐私协议 v1

- 可识别真实原件只在参与者同意与用户另行授权后进入访问受限、与数据集隔离的本机 intake staging；此动作开始 7 天删除时钟，但不代表材料已进入研究数据集。原件不得进入 Git、日志、导出、截图附件、聊天上下文、标签界面或模型调用。
- 原件必须先完成双人去标识，去除姓名、学号、电话、邮箱、地址、账号、二维码和可追踪元数据，同时保持任务语义与版式难度；只有复核通过的去标识副本才能进入标签、冻结数据集与任何模型调用。日志只保存去标识 case ID、hash、格式、计数与错误类型。
- 云端默认只发送用户可预览的文字。正式消融中：T 只发送该冻结文字/OCR；I 只发送逐次授权的当前 1 图或选定 1–4 页，绝不附 OCR；IT 才发送相同授权图片/选页及与 T 完全相同 hash 的 OCR 文字。永不发送完整 DOCX/PDF、其他页面、整个工作区、历史、Expected 或 Secret。
- intake 前冻结保留表：可识别原件的 `delete_at = min(intake_at + 7 天, deidentification_approved_at)`；双人去标识一经通过立即删除原件，若 7 天内未通过则到期删除且该样本不得进入标签、冻结或调用。关联/contact key 与屏幕录像最长 30 天；去标识 stimuli、labels、原始模型 I/O 与假名事件日志最长 180 天；聚合指标、匿名 hash、manifest 和 deletion ledger 最长 24 个月。每类都记录 owner、位置、访问控制、计时起点、`delete_at` 与删除回执。参与者可在聚合冻结前撤回其材料与计时记录。
- 只有 linkage key 已销毁且不能被合理重识别时才称“匿名”；此前一律称“去标识/假名化”。脱敏双人复核需覆盖文本 PII、文件名、EXIF、DOCX core properties/comments/track changes/custom XML、PDF metadata/attachments/JavaScript，以及二维码、头像、签名和背景标识。
- 数据集制作、标签裁决和模型运行人员分权；模型调用前不得接触 Holdout expected，调用人员只能看到运行 manifest。
- Provider 的数据保留期、处理区域和删除政策必须已知且不超过批准范围；未知或不可审计时禁止真实材料调用。

## 10. RCO-A 至 RCO-J 浏览器契约

本矩阵吸收但不等同于两套历史 A–J：`docs/release/v2-beta/QA_ACCEPTANCE.md` 的 Beta Core A–J，以及 `docs/e2-multimodal-experiment/PRIVACY_SECURITY_BROWSER_ACCEPTANCE.md` 的 E2-MM Privacy A–J。RCO 记录必须写完整 ID `RCO-A`…`RCO-J`，禁止裸写“A–J”。

| ID | 阻断式验收 |
|---|---|
| RCO-A 输入与默认边界 | 文字、TXT、Markdown、DOCX、文本/混合 PDF、截图、照片、扫描 PDF 都先建立 Source 与可恢复 Draft；图片开关默认关闭，默认请求只有用户预览过的文字 |
| RCO-B 说明、同意与可访问性 | 开关旁逐项说明发送/不发送范围；键盘可聚焦、切换和读取；同意不跨来源、面板或请求保存 |
| RCO-C 图片/选页最小化 | 只发送当前 1 图或用户填写的 1–4 页；越界、超限、换文件、关闭开关、返回页面都撤销或阻止；请求体与网络证据一致 |
| RCO-D 本机提取完整性 | 编码、Markdown 结构、DOCX 安全解析、PDF 逐页 parser/ocr/empty/error、页码/顺序/partial/上限均可见；不得静默漏页或声称完整 |
| RCO-E 业务语义闭环 | 单/多任务、多时间、材料、事件、相对时间、纯资讯都能逐项编辑、拒绝、部分确认；材料/背景不冒充任务 |
| RCO-F Schema、时间与证据 | Worker/浏览器/评测共享契约；0 悬空引用、0 静默默认；时间 AST 保留真实精度；每个 explicit 关键事实可定位 provenance |
| RCO-G Worker 与数据安全 | 拒绝无 consent、未知字段、MIME 不匹配、非支持格式、数量/大小超限、非法 Origin 与缺 Secret；IndexedDB、备份、导出、控制台、Worker 日志无文件/图片字节或 data URL |
| RCO-H 失败与回退 | 未配置、超时、502、限流、模型/JSON/Schema/语义失败均保留 Source/Draft、正式任务为 0，并可回到文字、本地规则或手动路径 |
| RCO-I 确认、持久化与恢复 | 输出只进待确认；编辑、拒绝、部分确认、刷新恢复、重复点击、网络中断、DomainCommitPlan 原子提交、Workspace v8、导入导出与清空失败保护通过 |
| RCO-J 浏览器、响应式与性能 | Chrome/Edge 桌面及 320/375/390/430/768/1024px；Tab/Escape、焦点、reduced motion、进度、错误、页码和提交可用；满足第 8 节性能/内存预算 |

冻结的原子子案例如下，不能用父项一句话代替：

- `RCO-A1` 九格式 Source/Draft；`A2` 图片同意默认关；`A3` 默认网络载荷只有预览文字。
- `RCO-B1` 发送/不发送清单；`B2` 标签、焦点、键盘与读屏；`B3` 同意不跨请求保存。
- `RCO-C1` 截图/照片单图范围；`C2a` 选定 1 页；`C2b` 选定 4 页；`C2c` 页码越界；`C2d` 选择超过 4 页；`C3a` 换文件撤销；`C3b` 返回页面撤销；`C3c` 关闭开关撤销。
- `RCO-D1` TXT 编码；`D2` Markdown 结构；`D3` DOCX 安全 OOXML；`D4` 文本 PDF；`D5` 混合 PDF 逐页；`D6` 截图/照片/扫描质量路由；`D7a` partial 标记；`D7b` 页数上限；`D7c` 字数上限。
- `RCO-E1` 单/多任务；`E2` 材料与格式约束；`E3` Event/准备任务；`E4` 相对/模糊时间；`E5a` 纯资讯不建任务；`E5b` 否定句不建任务；`E6` 编辑、拒绝与部分确认。
- `RCO-F1` 共享 Schema/ID/引用；`F2` 时间 AST；`F3` evidence/provenance；`F4` 缺字段与悬空引用 fail-closed。
- `RCO-G1a` 无 consent；`G1b` 未知字段；`G1c` 数量超限；`G1d` 大小超限；`G2a` MIME 不匹配；`G2b` 非支持格式；`G3a` 非法 Origin；`G3b` 缺 Secret；`G4` IndexedDB/备份/导出/控制台/Worker 日志字节扫描。
- `RCO-H1` 未配置；`H2a` timeout；`H2b` HTTP 502；`H2c` rate-limit；`H3a` 模型拒绝/错误；`H3b` invalid JSON；`H3c` invalid Schema；`H3d` semantic rejection；`H4` Source/Draft 保留、正式任务为 0 与本地/手动回退。
- `RCO-I1` 待确认与逐项操作；`I2` 刷新恢复；`I3a` 重复点击幂等；`I3b` 提交中网络中断；`I3c` DomainCommitPlan 事务失败原子回滚；`I4` Workspace v8、导入导出、清空和迁移失败保护。
- `RCO-J1` Chrome/Edge 桌面；`J2` 320/375/390/430/768/1024px；`J3` Tab/Escape/焦点；`J4` reduced motion；`J5` 进度/错误/页码/提交；`J6` 第 8 节性能与内存。

必需实例集合由以下笛卡尔积机械生成，不允许人工挑选：

```text
F = {DT, TX, MD, DX, PT, PM, SS, PH, SP}
V = {PM, SS, PH, SP}
L = {TX, MD, DX, PT, PM, SS, PH, SP}
B = {Chrome, Edge}
M = {320, 375, 390, 430, 768, 1024}
W = {1440x900, 320, 375, 390, 430, 768, 1024}
Q = {H1,H2a,H2b,H2c,H3a,H3b,H3c,H3d}

{A1,E1,E2,E3,E4,E5a,E5b,E6,F1..F4,I1,I2,I3a,I3b,I3c,I4} × F × B × W
Q × F × B × W
H4[cause] × Q × F × B × W
{A3,B1,G1b,G1c,G1d,G3a,G3b,G4} × F × B × W
{G2a,G2b} × L × B × W
{A2,B2,B3,C3a,C3b,C3c,G1a} × V × B × W
C1 × {SS,PH} × B × W
C2a × {PM,SP} × B × W
C2b × {PM,SP} × B × W
{C2c,C2d} × {PM,SP} × B × W
D1×{TX}×B×W, D2×{MD}×B×W, D3×{DX}×B×W, D4×{PT}×B×W,
D5×{PM}×B×W, D6×{SS,PH,SP}×B×W
{D7a,D7b,D7c}×F×B×W
J1 × B × W                                    # 汇总链接该浏览器/视口全部 A-I rows
J2 × F × B × M
{J3,J4,J5,J6} × F × B × W
```

每个生成 row 都必须保存唯一 `case_id` 和 `condition_id`、构建 commit、浏览器/视口、去标识输入 ID、步骤、期望、实际、网络/存储证据路径和唯一状态。一个 row 只能断言一个 condition；上述 `a/b/c/d` 后缀就是不可合并的 condition 维度，格式、浏览器和视口仍按公式全交叉。A–I 的授权、回退、恢复、幂等和事务条件必须在桌面与六个移动/平板宽度全部执行；`J2` 只验证布局本身，不能替代这些业务行。`G1a..G3b/H1..H3d` 各使用对应的单一边界或失败负例；H4 对每个 H1..H3d 的结果分别断言，不合并成一条。其余每个原子 condition 至少一个正例。公式未生成的组合只能在契约已明确排除该格式时标记 `NA_BY_CONTRACT` 并记录静态 reason code；不得因设备、工期或失败手工豁免。父项状态是其全部 required rows 的逻辑 AND：任一原子 condition、格式、浏览器或视口组合遗漏为 `NOT_RUN`，任一非 PASS 使父项非 PASS。RCO-G7 只在 RCO-A 至 RCO-J 十个父项全部 `PASS` 时通过。

## 11. 唯一放行算法

### 11.1 请求部署 Commercial Preview

商业候选只有在以下条件全部为真时才能请求用户授权部署 Commercial Preview：

1. RCO-G0 至 RCO-G6 已各自通过，且阶段和调用均有明确授权记录；
2. 本契约已由用户在 Holdout 前批准冻结，运行版本与哈希完全一致；
3. CH-A 与 CH-B 的 Formal Completion、每项绝对门、每个声称支持格式和统计区间分别通过；
4. 若申请视觉附加能力，IT 对 T、I 的两组增量门分别通过；否则图片保持本机 OCR/文字路径；
5. 真人效用、商业 Holdout 内可观测的延迟/内存/成本预算、数据协议和 RCO-A…J 全部通过；第 8 节部署后 48 小时稳定性与 fault injection 尚不在此前置集合内；
6. 没有未解除的 HARD_STOP、REJECT_CANDIDATE 或 NO_PROMOTION；所有 `INVALID_RUN/INSUFFICIENT_N/NOT_OBSERVABLE/BLOCKED/FAIL` 均已按原门规则解决并留下新证据；
7. 用户另行明确授权部署 Commercial Preview；该授权只允许部署冻结 commit/hash，不包含 Production。

### 11.2 Commercial Preview 后的 RCO-G8 与 Production

部署冻结候选后，必须完成第 8 节 48 小时/200 planned logical units 稳定性和 100 个 fault-injection 单元，并通过回滚、支持文案、隐私/合规、成本/限流和残余风险审查。上述证据全部 `PASS` 才能判 RCO-G8 通过；随后仍须由用户单独明确批准 Production。任何文档、分数或 Preview 状态都不能自动替代该批准。
