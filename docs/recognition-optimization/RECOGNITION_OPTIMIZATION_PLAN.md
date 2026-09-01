# 商业级识别优化执行计划

**计划代号**：RCO（Recognition Commercialization Optimization）

**状态**：`PLANNED / RCO-DOCS PASS / WAIT_AUTHORIZATION / DO NOT LAUNCH`

**实验范围**：`codex/e2-multimodal-recognition-exp`；任何 Experiment Preview 部署需单独授权

**固定保护对象**：RC.4、Release、Production、稳定文字模型、既有稳定性监测

## 1. 目标

把文字、图片和文件可靠地转化为带逐字依据、可编辑、可拒绝的待确认任务，并在真实未见材料中显著降低用户修改时间。商业级不是“模型能回答”，而是以下闭环持续成立：

```text
来源完整进入
  → 关键事实不漏、不编
  → 时间和实体关联有效
  → 浏览器能接受并展示
  → 用户少改、快确认
  → 失败可见且不破坏数据
```

RCO-DOCS 已完成根约束、PRD、计划、日志、短上下文、提示词和商业验证契约的编写与文档验证；本次提交推送完成后等待用户决定是否授权 RCO-0。RCO-0 至 RCO-8 每个阶段开始前都需要当前用户明确授权；阶段授权不自动包含模型调用、真实材料、真人计时或部署。同一分支旧 E2-MM 的调用许可不能复用。

## 2. 第一性原理与优先级

端到端成功率受每一层共同限制。即使 OCR、模型和 Schema 各有较高单项分数，只要时间或引用结构失败，整份材料仍不能直接确认。因此采用以下原则：

1. **先修测量**：评测器必须与真实浏览器接受规则一致。
2. **先修确定性损失**：编码、漏页、阅读顺序、时间归一化和悬空引用优先于换模型。
3. **先事实后规划**：先抽取是否行动、动作、对象、时间、材料和证据，再构造任务。
4. **只融合事实**：文字、OCR 和视觉在事实层合并，冲突进入人工确认。
5. **只承认端到端证据**：工程测试、合成代理、真实文件、真人效用和发布批准逐级分开。

`RCO-n` 表示工作阶段，`RCO-Gn` 表示该阶段的通过门。为避免与产品既有 P0/P1/P2 分期混淆，本计划不再用 P0/P1/P2/P3 指代 RCO。执行波次固定为：

```text
Wave A: RCO-0 评测 → RCO-1 Schema → RCO-2 时间
  → Wave B: RCO-3 文件 → RCO-4 OCR → RCO-5 facts-first
  → Wave C: RCO-6 多模态事实融合
  → Wave D: RCO-7 商业 Holdout/真人时间 → RCO-8 发布审查
```

## 3. 当前基线与阻断

| 事实 | 当前证据 | 产品含义 |
|---|---|---|
| V2 文字 Task F1 约 63.74% | 合成代理 36 例 | 默认路径任务召回不足 |
| V2/V3 直接图片 Task F1 约 71.4% | 两批有限模板代理 | 只能说明有限任务匹配复现 |
| Complete Case Accuracy 0 | V2/V3 | 没有整份材料可免修改确认 |
| TimePoint F1 0 | V2/V3 | 截止时间链路是硬阻断 |
| Major Correction Rate 100% | V2/V3 | 每份都需要实质修改 |
| V3 28/36 含悬空时间引用 | 端到端只读复核 | 部分服务端成功结果无法被客户端接受 |
| DOCX 不支持；混合 PDF 漏扫页风险 | 当前 fileExtraction | 文件在进入模型前已损失信息 |
| 真人修改时间 NOT_RUN | 当前协议 | 无法证明用户效率收益 |

详细数值、路径和订正只在追加式日志维护，避免计划文件随每轮结果漂移。

## 4. 目标架构

```text
Input Router
  ├─ Direct text / TXT / Markdown parser
  ├─ Safe local DOCX parser
  ├─ Per-page PDF parser-or-OCR router
  └─ Image OCR quality router
          ↓
Source Spans + Quality Ledger
          ↓
Fact Ledger
  requiresAction / action / object / raw time / material / event / constraint / evidence
          ↓
Deterministic Time AST + Fact Validator
          ↓
Task Composer + Reference Builder
          ↓
Shared Strict Schema
  Worker = Browser = Evaluator
          ↓
Editable ExtractionDraft
          ↓
User edit / reject / partial confirm / confirm
```

视觉模型不是总路由。只有 OCR 质量低、版式关联重要且用户逐次授权时，才接收当前图片或选定页面；输出仍回到同一事实账本和严格验证链路。

## 5. 阶段计划

### RCO-0：评测可信与历史重分类

**目的**：让“评测成功”与“真实浏览器可接受”成为同一件事。

**工作**：

- 复用客户端完整 Schema、跨实体引用校验和安全规则重放历史结果。
- 将 transport、auth/billing/rate-limit、model、JSON、Schema、semantic、scoring 和 human-flow 错误分开。
- 修正 Forbidden 评分范围，禁止把描述中的地点、否定句或分数条件误判为禁建任务。
- 将 V2/V3 标为诊断/有限模板代理，不再按 72 个独立语义案例解释。

**产物**：共享验证入口、重分类报告、corrections log、更新后的基线表。

**模型调用**：0。

**通过线**：同一结果在 Worker、浏览器和评测器得到相同 PASS/FAIL；浏览器拒绝结果不计质量成功；空结果与失败不能获高分。
**停止条件**：历史原始结果不可验证、需要改 expected 才能通过、评分规则无法复算。

### RCO-1：统一严格 Schema

**目的**：消除悬空引用和关键字段静默默认。

**工作**：

- 建立 Worker、浏览器、评测器共享的 RecognitionResult 契约或可生成 Schema。
- 关键字段缺失、非法时间、无效 evidence、重复 ID、跨实体引用错误必须显式失败。
- 若上游不能提供严格结构化输出，先验证，再允许一次 evidence-bounded Repair。
- 保存脱敏结果 hash、校验错误、Repair 前后差异和 harm 标记；不保存完整用户正文或图片。

**产物**：共享 Schema、validator、repair contract、契约测试、错误码映射。

**模型调用**：首次实现与 Mock 验证为 0；若另获调用授权，可使用共享预算 `B1` 的一部分，RCO-1 与 RCO-5 合计不超过 24 次；若候选启用一次 Repair，可另使用两阶段共享预算 `B2`，最多 12 次。

**通过线**：100% 客户端有效、0 悬空引用、0 关键字段静默默认、Repair 不新增无证据事实。
**停止条件**：为提高成功率而放松客户端 Schema、隐藏失败或删除失败样本。

### RCO-2：唯一中文时间 AST

**目的**：把时间从模型自由生成改成可测试、可解释的事实归一化。

**工作**：

- 合并 parser、timeSemantics、pipeline 和 Worker 的重复时间逻辑。
- 模型只提供 rawText、type、evidence；确定性代码基于 referenceTime/timezone 生成 normalizedValue 等字段。
- 覆盖 date-only、中文数字、“半”、时段、相对日期、跨午夜、范围、更正、跨年、闰年和 OCR 噪声。
- 无日期、无时刻、模糊或冲突分别保留真实精度，不伪造七天后或 18:00。

**产物**：时间 AST、属性测试、跨时区测试、旧草稿兼容说明、字段映射。

**模型调用**：0；可在历史模型输出上离线融合。

**通过线**：冻结时间集的值/类型/时区/关联逐项正确；不同主机时区结果一致；旧回归不退化。
**停止条件**：需要破坏性迁移、旧确认数据可能被重写、模糊时间被自动具体化。

### RCO-3：本机文件提取

**目的**：确保模型看到的是完整、按正确顺序组织的事实来源。

**工作**：

- TXT：UTF-8/BOM/GB18030 探测与乱码失败状态。
- Markdown：保留标题、列表、表格、引用和代码块边界。
- DOCX：安全读取 OOXML 段落、标题、编号和表格；禁止宏、外链和远程资源。
- PDF：逐页 parser/OCR/empty/error 路由，保留页码、reading order、双栏/表格和 partial 状态。
- 长文件：按页/span 切块并保留 hash、顺序、有限重叠和去重，禁止静默头部截断。

**产物**：分格式解析器、真实文件 fixture、页/span 数据结构、质量旗标、端到端提取报告。

**模型调用**：0；若另获调用授权，最佳候选进入下游时与 RCO-4 共用预算 `B3`，合计最多 12 次筛查。

**通过线**：关键动作、时间、材料页覆盖 100%；部分提取不声称完整；真实 fixture 可从文件走到待确认草稿。
**停止条件**：外链/宏可能执行、页序无法稳定、重复合并、资源上限失控。

### RCO-4：分介质 OCR 与质量路由

**目的**：降低截图、照片和扫描中的确定性字符损失。

**工作**：

- 分别评估方向、裁边、去透视、灰度/对比度、2–3 倍放大和版面模式。
- 先离线比较 CER 与日期数字 exact match，再让最佳候选进入下游任务评测。
- 建立经实测校准的低质量路由；低质量进入重拍、选页或人工校对。

**产物**：OCR 消融、质量路由、性能预算、可见质量提示。

**模型调用**：离线 0；若另获调用授权，最佳候选下游验证与 RCO-3 共用预算 `B3`，合计最多 12 次。

**通过线**：冻结的组件验证集上 CER、日期数字和 Task/TimePoint 同时改善，Severe Error 不增加，p95 时延/内存满足预注册预算。组件验证集一经用于选择候选即标记为已见，不得复用为 RCO-7 商业 Holdout。
**停止条件**：只改善 OCR 自报 confidence、下游无净收益或预处理抹掉关键字符。

### RCO-5：facts-first 与任务构造

**目的**：减轻一次生成大 Schema 的竞争，让关键事实优先完整。

**工作**：

- 比较当前完整 Schema 与紧凑事实账本：requiresAction、action、object、raw time、material、event、constraint、evidence。
- 由确定性代码创建 ID、TimePoint、引用、selected 默认值和 Workspace v8 兼容结构。
- 对纯信息通知、否定句、更正通知、联系人、地址、政策、格式要求和 prompt injection 建立负例。
- Validator 同时检查动作+对象、事实—任务—时间关联、证据逐字有效和禁建任务。

**产物**：fact schema、task composer、跨字段 validator、负例集、单变量消融报告。

**模型调用**：若另获调用授权，完整 Schema 与 facts-first 使用 RCO-1/RCO-5 共享预算 `B1`（合计最多 24 次）；原子动作候选使用 `B4`，最多 12 次。

**通过线**：Recall 上升时 Precision、Forbidden、Major Correction 和 Complete Case 不退化；客户端有效率保持 100%。
**停止条件**：层级变简单但事实丢失、过度拆分增加、无证据事实增加。

### RCO-6：事实级多模态融合

**目的**：验证视觉是否提供文字路径没有的稳定增量。

**工作**：

- 保持 T/I/IT 同模型、同候选 Schema、同数据和零隐藏重试。
- I 不接触 OCR；Expected 只在模型调用后进入离线评分。
- OCR、文本层和视觉按事实及 provenance 合并；冲突进入待确认，不整份结果二选一。
- 仅发送用户授权的当前图或 1–4 页；记录页覆盖范围。

**产物**：事实融合器、新 Development 三臂报告、隐私边界测试。

**模型调用**：若另获调用授权，12 个新语义家族三臂使用 `B5` 共 36 次；格式矩阵筛查使用 `B6`，最多 48 次且相同输入去重。

**通过线**：配对消融完整有效、零请求失败、输入隔离/provenance 与安全门通过，并形成唯一冻结路由决策。IT 达到预注册 F1 与修改率净收益时记录 `VISION_SELECTED`；未达到但实验有效时记录 `VISION_NOT_SELECTED`、冻结 C=T，G6 仍可通过。
**停止条件**：任一臂运行失效、输入隔离被破坏、融合冲突被静默覆盖、隐私/严重错误出现或结果不足以形成可信决策。IT 仅无稳定净收益本身不阻断文字候选，但禁止选择视觉路由。

### RCO-7：真实去标识/假名化盲测与真人效用

**目的**：证明产品对真实文件和真实用户有价值。

**工作**：

- 先由用户明确批准并冻结 `COMMERCIAL_VALIDATION_CONTRACT.md`，再创建两批语义独立、与开发集和组件验证集隔离的真实去标识/假名化商业 Holdout；数据清单冻结与模型调用分别需要授权。
- 分格式报告入口、事实、任务、用户和运行五层指标。
- 自动质量运行平衡 T/I/IT 调用顺序；真人研究只按契约比较产品基线 S 与拟上线产品路由 C，并记录从建议可交互到确认/放弃的真实时间与修改字段。
- 按商业验证契约执行隐私、安全、键盘、手机、Chrome/Edge 和 `RCO-A`…`RCO-J` 浏览器矩阵。

**产物**：用户批准的冻结验证契约、预注册、数据清单、盲测结果、人类计时报告、RCO-A…RCO-J 证据。

**模型调用**：通过前置门并另获数据、调用与金额授权后，九格式每格式每批恰好 50 个 semantic families，共 2,600 个 `source × arm` logical slots；其中候选 initial 请求固定 1,700，S 最多 900，所以 initial API 上限 2,600。若 T/I/IT 启用一次 Repair，最坏额外 1,700 请求，API 授权上限 4,300；S 的 manual fallback 可使实际请求更少，基础设施复跑另行授权。没有相应授权时保持 `NOT_RUN`；样本不足标记 `INSUFFICIENT_N`。

**通过线**：`COMMERCIAL_VALIDATION_CONTRACT.md` 的绝对门槛在两批中分别满足，真人修改时间和 p95 满足冻结区间门，RCO-A…RCO-J 全通过；IT 增量门只决定是否启用视觉附加能力。
**停止条件**：样本污染、隐私授权不足、严重错误出现、用户时间无改善或统计区间指向反方向。

### RCO-8：商业发布审查

**目的**：把质量候选变成可控、可回退的商业候选，而不是自动上线。

**工作**：RCO-G7 与部署前门通过后，另获用户授权部署冻结的 Commercial Preview；在该环境完成契约规定的 48 小时/200 logical units 稳定性、100 个 fault-injection 单元，再审查成本和限流、错误预算、可观测性、回滚、支持文案、隐私说明、合规与人工发布批准。

**产物**：Commercial Preview 部署批准记录、发布决策记录、回滚演练、稳定性/fault-injection 报告、残余风险清单。

**通过线**：部署后证据与发布门全部通过；进入 Production 仍需用户另行明确批准。
**停止条件**：任何证据缺失、回滚不可验证、成本不可观测或审批未获得。

## 6. 调用预算与最短信息路径

进入商业 Holdout 前的候选选择预算使用唯一预算 ID；同一请求不得在多个阶段重复计数：

| Budget ID | 用途 | 使用阶段 | 最大调用 |
|---|---|---|---:|
| B1 | Schema / facts-first 配对开发验证 | RCO-1 与 RCO-5 共用 | 24 |
| B2 | 失败案例一次 Repair | RCO-1 或 RCO-5 | 12 |
| B3 | 文件提取 / OCR 最佳候选下游验证 | RCO-3 与 RCO-4 共用 | 12 |
| B4 | 原子动作候选 | RCO-5 | 12 |
| B5 | 新 Development 三臂 | RCO-6 | 36 |
| B6 | 格式矩阵筛查 | RCO-6 | 48 |
| **合计** |  |  | **144** |

以上只是上限，不构成模型调用授权。每个预算 ID 仍需用户批准具体模型、数据、金额上限和调用次数；只有前述结果支持净收益，才可请求运行商业 Holdout。解析输出相同、假设已被否定或早停条件满足时应停止。

## 7. 角色责任

- **程序负责**：提取范围、哈希、时间 AST、ID/引用、Schema、失败分类、回退、日志和确定性评分。
- **模型负责**：在明确证据范围内判断是否行动、动作、对象、材料、事件和语义关联。
- **用户负责**：授权图片/页面、核对原文、编辑/拒绝/确认建议、批准真实研究和发布。
- **评审负责**：冻结门槛、检查污染、裁决高风险错误、确认结论没有超出证据。

## 8. 不做什么

- 不先换模型、扫 temperature/max tokens 或无限扩 Prompt。
- 不把已见 V2/V3 重新包装成未见集。
- 不把 HTTP 200、单元测试、OCR confidence 或合成 F1 当商业证据。
- 不上传完整文件、工作区或历史换取正确率。
- 不让 AI 自动创建正式任务，不绕过用户确认。
- 不在上下文里复制巨型 checkpoint、完整图片/base64 或无关历史；按路径和摘要读取。

## 9. 当前下一步

当前正在完成 RCO 文档冻结与验证，尚未通过 `RCO-DOCS`。验证并提交后，若用户明确授权开始实施，第一项应是 **RCO-0：评测可信与历史重分类**；它默认 0 次模型调用，也不改变 RC.4 或 Production。

## 10. 停机与恢复

停机统一使用根 `AGENTS.md` 的三级规则：`HARD_STOP`、`REJECT_CANDIDATE`、`NO_PROMOTION`。已知历史悬空引用属于 RCO-0/RCO-1 的修复对象，本身只触发 `NO_PROMOTION`；若候选新增或掩盖悬空引用，则触发 `REJECT_CANDIDATE`。只有错误分支、越权、隐私、expected/freeze 污染或 Production 影响等触发 `HARD_STOP`。

恢复时必须在日志记录批准者、允许动作、原门、可复用数据和解除证据。`REJECT_CANDIDATE` 需新候选版本重新通过原门；`NO_PROMOTION` 需新授权证据补齐原门或由用户终止路线；恢复只回到原门，上一门通过和故障解除都不自动授权下一阶段。
