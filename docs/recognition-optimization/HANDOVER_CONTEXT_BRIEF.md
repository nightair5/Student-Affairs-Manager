# 学生事务管家：跨工作区交接文档（Handover & Context Brief）

> 核验日期：2026-09-20（Asia/Shanghai）。主线：`MAINLINE-REAL-INPUT-01`。
> 本文核验的已提交代码基点：`9f4128ea520f852913cb1d8ebf6b3f9a991a98ae`，开始时本机与远端一致、工作区干净。撰写期间出现并行脚本改动，见 §3.1；这些改动不属于本文验证结论。本文自身随后作为文档提交保存；恢复时以实际 Git 为准。
> 交接范围：产品架构、当前隔离实验、真实保存证据、离线 candidate10、继续开发所需命令与边界。已有工程验证、历史模型比较、实际用户库证据分别标明；本文不是生产发布验收报告。

## 1. 项目概览与技术基线

### 1.1 核心目标与业务定位

项目把大学生收到的通知、群消息、文件文字整理成可核对的任务，保留截止时间、材料要求、条件、前置关系和来源依据。典型场景包括影展送审、实验送样、展览布置、比赛报名和报销补件。

核心产品路径是：**输入 → 识别建议 → 查看原文/编辑/拒绝/主动确认 → 任务中心 → 首页与日历 → 刷新恢复和备份导出**。AI 输出始终是建议。用户确认之前，不能创建正式任务或用新回答覆盖已经确认的内容。

当前开发重点是减少复杂通知中的多余任务、材料遗漏/错归属和无依据依赖，并确保正确建议能够保存。支付、账号、后台自动同步和真实微信接入不属于当前交付范围。

**三个容易混淆的状态：**

| 对象 | 当前事实 |
|---|---|
| 既有完整产品代码 | 首页、收件箱、草稿确认、任务、日历、资料、报告、知识检索和服务接入基础均有实现；PRD 的旧分期不是当前数据库版本 |
| 当前 6632 隔离试用 | 复用真实 App，回放 9 份已结算历史回答；允许本地核对保存；网络模型发送关闭 |
| candidate10 | 已提交的离线候选，只有构造请求和工程测试；模型效果 `NOT_RUN`，状态 `OFFLINE_CANDIDATE_NOT_ADOPTED`，未接入 6632 |

### 1.2 技术栈与版本

以下为本次读取 `package-lock.json` 得到的锁定版本，而非仅 package.json 的范围：

| 层 | 组件与版本 | 用途 |
|---|---|---|
| 运行环境 | 本机 Node **24.18.0**，npm **11.16.0**，Windows PowerShell | Node 脚本、构建、实验运行 |
| 前端 | React / React DOM **18.3.1**，TypeScript **5.7.3** | 严格类型、函数组件和 hooks |
| 构建 | Vite **6.4.3**，esbuild **0.25.12** | 普通 App；实验入口另用 esbuild 构建 |
| UI | Lucide React **0.468.0**，自有 CSS | 深蓝/墨绿校园事务界面，无重型 UI 框架 |
| 本地文件 | PDF.js **6.2.108**、Tesseract.js **7.0.0**、fflate **0.8.3** | PDF 文字、本机 OCR、压缩与导出 |
| 测试/静态检查 | Vitest **3.2.7**、ESLint **10.8.0**、Node 内置测试 | 纯规则、组件适配、网关与预算 |
| 发布基础 | Wrangler **4.120.0**；Cloudflare / Firebase 目录 | 存在部署适配，当前任务不运行部署 |
| 数据 | 浏览器 IndexedDB，Workspace **schema v8** | canonical 事实源；React 状态是视图与交互状态 |

`package.json` 声明 Node >=20，但当前锁定的 PDF.js、ESLint、Wrangler 要求更高；新环境优先使用上述已验证 Node 24 版本。`npm ci` 按现有锁文件安装，不通过升级依赖解决历史检查差异。esbuild 当前来自已锁定工具链，准备脚本直接使用它。

### 1.3 架构拓扑和目录职责

```text
普通产品入口 src/main.tsx                  隔离入口 realInput01/browser.tsx
             │                              │ origin/库名/网络保护
             └────────────── src/App.tsx ◀───┘ 注入 MainlineRuntime
                                   │
                      原文 + 草稿 + 确认面板
                                   │
         输入/不可变来源索引 → 模型或历史回答 → modelWire 解析/本机时间归一化
                                   │
                   semanticComposer → 核对项、冲突、确认资格
                                   │
                  明确保存纠正 + 主动确认 + 修订号检查
                                   │
                 SemanticRepository → CanonicalWorkspaceRepository
                                   │
                 IndexedDB 原子事务 / schema v8 canonical arrays
                                   │
             任务中心、日历、详情、独立 repository 读回、JSON 导出
```

普通路径使用 `domain/v2` 的正式 capture/confirmation/domainCommit。隔离路径在同一个真实 App 中注入 `MainlineRuntime`，通过语义适配器和相同 canonical 仓储接口保存。两条路径不能混为两个独立正式存储系统；实验库和默认用户库必须隔离。

| 路径（仓库相对路径） | 关键职责 / 从哪里开始找 |
|---|---|
| `AGENTS.md`、`PRD.md` | 当前约束、产品原则、阶段边界。恢复时先读当前相关段落 |
| `src/App.tsx` | 应用状态、普通/注入运行时切换、页面导航、工作区快照；runtime 一旦绑定不能静默更换 |
| `src/components/IntakePanel.tsx`、`DraftReviewPanel.tsx`、`TaskDetailPanel.tsx` | 录入、原文/建议核对、任务详情；复用这些组件，不另造演示面板 |
| `src/pages/` | Dashboard、Inbox、Tasks、Calendar、Library、Archive、Knowledge、Reports、Services、Privacy；部分页面 lazy load |
| `src/styles.css`、`src/mobile.css`、`src/visual.css` | 桌面/移动端布局与视觉；桌面核对双栏、移动单栏 |
| `src/domain/v2/types.ts`、`repository.ts` | v8 类型、canonical 仓储、IndexedDB/内存 store；记录键 `current` |
| `src/domain/v2/capture.ts`、`confirmationV2.ts`、`domainCommit.ts` | 先持久化来源链，明确确认，再按计划原子提交 |
| `src/domain/v2/migration.ts`、`repository.ts`、`validators/` | 迁移、形状/实体/引用/依赖/时间校验；不可丢弃旧数据凑合法 |
| `src/lib/repository.ts`、`src/types.ts` | React 兼容视图/旧接口；不能反向覆盖 canonical 材料、时间、证据 |
| `src/lib/fileExtraction.ts`、`ocrPreprocessing.ts`、`timeSemantics.ts` | 本机文件文字/OCR、图像预处理、中文时间 AST 归一化 |
| `src/recognition/scopeIndexV11.ts`、`scopeReferenceContract.ts` | 不可变来源片段与引用；引用存在只能证明出处，不能证明语义正确 |
| `src/recognition/` | 普通识别 pipeline、规则/评估、历史任务形成实验；大量文件是历史冻结实验 |
| `src/experiments/mainline01/isolatedStore.ts` | 独立 IndexedDB：版本 1，object store `records`；只对指定库执行事务 |
| `src/experiments/mainline02/runtime.ts` | App 可注入运行时契约 |
| `src/experiments/mainline04/semanticContract.ts`、`semanticComposer.ts` | 实验语义契约、实体组合、时间归属与冲突、核对包 |
| `src/experiments/mainline05/semanticState.ts`、`semanticRepository.ts` | 原答/首次建议/纠正操作状态，来源和历史不变性，事务保存 |
| `src/experiments/mainline05/semanticConfirmation.ts`、`semanticView.ts` | 材料/事实核对、确认计划、状态显示与具体阻碍 |
| `src/experiments/realInput01/inputAcquisition.ts`、`inputReceipt.ts` | 输入获取、内容哈希、发送快照及范围记录 |
| `src/experiments/realInput01/modelWire.ts`、`modelClient.ts` | 请求/响应格式、身份、确定性转换；服务端执行与前端请求分离 |
| `src/experiments/realInput01/runtime.ts`、`browser.tsx` | 真实 App 接线、历史回放身份检查、示例恢复、独立读库和下载 |
| `src/experiments/realInput01/factCorrections.ts`、`FactCorrectionEditor.tsx` | 有限材料/条件/依赖人工纠正；用户选依据、写说明、明确保存 |
| `src/experiments/realInput01/candidate03.ts` | 可靠基线指令 `real-input-source-semantics-3`；不要原地改历史基线 |
| `candidate10.ts`、`candidate10.test.ts`、`contrastiveEvidenceExamples.ts`、`contrastiveDevelopmentCases.ts`（均在 realInput01） | 当前离线候选、8 个教学正反例、12 个开发例，尚无模型质量结果 |
| `scripts/real-input-model-gateway.mjs`、`real-input-budget.mjs` | 服务端凭据使用、模型/请求/用量核验、统一追加账本和预算 |
| `scripts/run-mainline-real-input-01.mjs`、`serve-mainline-real-input-01.mjs` | 历史模型实验运行/服务；不能作为普通启动命令随意执行 |
| `scripts/build-real-input-preview.mjs` | 安全读取固定回答 SHA、构建临时产物、`--local` 启动 6632 |
| `scripts/prepare-opensource-recognition.mjs` | candidate10 离线请求包生成；无发送功能，每次输出新临时目录 |
| `server/`、`cloudflare/`、`functions/` | 普通产品 Node / Cloudflare / Firebase 服务适配；与 6632 回放服务不同 |
| `docs/recognition-optimization/` | 短交接、追加日志、阶段报告、冻结输入/原答/检查/账本 |

### 1.4 状态与实体关系

`Source → SourceVersion → RecognitionRun → ExtractionDraft` 先形成持久化来源链。模型原答和首次建议保留在实验草稿的 `legacyData.mainline05` 等实验命名空间中；用户纠正通过附加操作和历史表达，不覆盖原答。

正式任务、材料、时间、来源版本、运行、草稿、历史等是 v8 独立数组。`SemanticRepository` 使用整体修订身份和事务校验，拒绝过期编辑、历史前缀变化、来源丢失与已确认实体覆盖。确认前的业务判断与数据库写入必须保持一致。

材料 `required` 回答“通知是否需要”，`status=unverified` 回答“准备情况尚未核实”。这两项不同。条件 unknown、真实前置未满足、坏引用、时间冲突和未保存编辑仍可阻止确认。

## 2. 已完成的工作（Progress & Milestones）

### 2.1 按模块的完成程度

| 模块 | 已落地内容 | 验证口径与限制 |
|---|---|---|
| 基础产品 | 通知录入、持久化草稿、逐项编辑/拒绝/部分和批量确认、任务中心、首页三项重点、日历、来源回看 | 有实现和历史测试；本次文档核验未重新验收所有页面 |
| 本机增强 | TXT/Markdown/PDF 文字、本机 OCR、课程避让、材料/里程碑、报告/知识/ICS 导出 | 有实现与历史证据；当前 6632 仅开放批准的历史回放能力 |
| v8 数据底座 | canonical 实体、引用校验、迁移备份/失败保护、原子确认、历史追踪 | 复用既有仓储验证；不能将旧 PRD v3–v6 描述当当前版本 |
| 材料核对 | required 与准备状态分开，显式 unverified 持久化，满足身份条件时共享核对复用 | 当前实际导出中 5 份材料均 required + unverified |
| 时间归属 | 共享材料不再把任务 A 的私有截止传给 B；保留真正冲突、模糊日期和无日期区别 | U11/V02 存量零调用反例与正常对照已验证；这是本机修复 |
| 难例纠正 | 修改材料/条件；依赖编辑需原文依据、说明、主动保存；拒绝多余建议留历史 | 12 份 None 回放由正确工程保存 12 项增至 13 项，4 处明确纠正 |
| 依赖编辑器交互 | 打开、改选择、选依据、输入说明、保存、刷新恢复、资格更新、主动确认 | 2026-09-20 临时工程浏览器验证；不等于当前用户库新增任务 |
| 最新历史回答入口 | L01-A、L02-A、L04-A 直接打开真实 App 核对面板 | 已接线；同来源另一臂不覆盖，重复载入恢复既有草稿 |
| 当前用户库保存和导出 | 两个实际文件中工作区完整一致，独立读取 writes=0 | 当前 4 任务；不代表最新 L04 已在此用户库实际确认 |
| candidate10 | 固定 8 个原创教学正反例，12 个新编开发例，24 个离线配对请求 | 工程构造通过；效果尚未运行、没有采用 |

### 2.2 关键里程碑与实验结论

以下均为开发实验结果，不是线上总体准确率或真人转化率：

- candidate05/06/07/08/09 是历史探索。它们涉及事实组装、指令顺序或输出结构，不作为当前默认基线。
- candidate08 的角色跨表契约增加结构负担；后续 candidate09 简化字段仍未取得净收益。candidate09 同期 20 份：candidate03 无需实质纠正 17/20，candidate09 11/20，保留 candidate03。
- Flash / Pro 同期 20 份：Flash 无需实质纠正 17/20，Pro 15/20；Pro 目标错误、结构问题和等待代价更高，未采用。
- 初次 none/low 仅派发 2 次，low 在 8192 输出上限下截断；后续 38 次未执行。不能把计划请求算成实际请求。
- Max 正式先行 8 对：none 6/8 无需实质纠正，Max 5/8；实质错误 5→9，中位等待约 8.66 秒→100.15 秒，停在首批，未采用。
- low16 实际 12 对：none 10/12 无需实质纠正，low 5/12，中位等待 7.790 秒→43.190 秒；保留 none。历史实际累计 **290 次**。
- 难例工程回放：12 来源、19 原文任务事实、20 模型建议；明确纠正后正确保存 13 项；2 项条件未知待处理，4 项因取消/替代/条件 false 正确不形成当前待办，1 条多余建议拒绝。
- 2026-09-20 当前双下载关闭保存证据缺口；随后并行 candidate10 工作已提交。新会话从最新 Git 接续，不能退回先前提交重做实验。

关键提交：

| 提交 | 含义 |
|---|---|
| `5519b7a540d1cf803fbae54b8b443266f454f5ab` | 共享材料时间归属阶段交付 |
| `f057417b798778dacc17de01e0acab6f828d8a05` | 明确依赖纠正与工程保存转化 |
| `226d7b1f6c872e03253fbef08f1a6809d4c3a5e3` | 最新可靠历史回答入口 |
| `f74b6e7746df35ef8ce3508e720b570afb4d836f` | 纠正编辑器交互证据 |
| `119cebe9487ea47128c34ef79f3e3eccb49f3107` | 当前库双实际下载与保存收口 |
| `f7a0f2da0d62625341864aa85e8e80bbd8e3ec20` | candidate10 离线候选、教学例、开发包 |
| `9f4128ea520f852913cb1d8ebf6b3f9a991a98ae` | candidate10 集成回执；本文核验基点 |

### 2.3 架构与技术决策（ADR 摘要）

1. **模型提建议，用户作决定。** 自动写入会把材料说明、取消事项和猜测日期变成真实义务；正式确认必须经已保存的核对值和原子事务。
2. **Canonical 数据与 React 投影分离。** v8 独立数组保存正式事实；旧卡片兼容视图不回写重建材料/时间，避免一处显示转换悄悄丢事实。
3. **原答、首次建议、修改历史分别保留。** 才能区分模型错误、本机转换错误和人工纠正，不用最终成功覆盖首次失败。
4. **原文索引在本机生成，时间归一化在本机执行。** 模型只引用已给出的 scope 和逐字时间；本机检查引用存在，不声称因此证明语义蕴含。
5. **显式隔离运行时复用真实 App。** 页面和确认组件一致，但实验库、网络能力和历史回答身份受限，避免假演示和碰到稳定用户库。
6. **未知保持未知。** 材料准备可 unverified，条件可 unknown，时间可待定；不能用缺少、false 或假日期过校验。
7. **预算和回答有效性分开。** 截断回答不可确认，但若身份/usage 完整可信，可以追加结算；总输出包含推理用量时只计费一次，历史失败不改成功。
8. **候选采用看用户纠正净减少。** 严格文本差异不能直接叫重大错误；能解析/能写入也不能叫事实正确。更贵模型或更强思考不自动采用。

### 2.4 已修复或规避的坑

- **共享材料串时间：** 图遍历曾从共享 M 将 A 的 TA 传播给 B，造成假 `MULTIPLE_DEADLINES`。修复按显式任务/材料关系投影；材料共享不等于截止共享。
- **不知道材料是否备齐而卡住：** 实验显式支持 unverified 并贯通保存/显示；没有用旧枚举伪装。
- **无依据依赖阻断独立任务：** W12“保存最终版展签”曾被附加制作任务前置。当前可对照原文修改依赖、保存后重新计算资格；自引用、环、缺失目标仍拒绝。
- **页面入口载入后不便核对：** 示例通过 App 回调刷新 canonical snapshot 并直接打开已有草稿；加载不自动选择或确认。
- **不同浏览器/地址库不共享：** HTTPS、6631、6632、Edge 与内置浏览器彼此隔离。曾有 `TEST_DATABASE_OPEN_FAILED`，应保持原库，不能 fallback 默认用户库。
- **官方控制通信：** 曾跨任务返回 `nodeRepl.fetch request failed`；页面能手动打开不证明控制恢复。反馈已提交，当前主线不重复插件诊断。
- **独立读库 busy：** 上一临时会话卡住，新临时库约 1 秒正常完成，底层原因未完全确定；没有据此加入空库 fallback。当前用户实际工程 JSON 已取得。
- **下载链接有了但没有文件：** 无头会话缺少可观察的下载落盘策略；配置工程下载目录后可落地。产品用“异步准备 + 显式点击 download 链接”保留用户激活。当前两个实际用户文件已比较。

## 3. 当前状态与断点上下文（Current State & WIP）

### 3.1 最新现场

- 唯一开发仓库：`C:\Users\Winner\student-affairs-multimodal-exp`。
- 分支：`codex/e2-multimodal-recognition-exp`。
- 远端：`https://github.com/nightair5/Student-Affairs-Manager.git`。
- 本次核验 HEAD/远端均为 `9f4128ea520f852913cb1d8ebf6b3f9a991a98ae`；开始时没有未提交改动。
- 本次只读 HTTP 检查：6632 `/api/status` 返回 9 个记录、`modelCallsEnabled=false`、`candidateAdopted=false`。此检查不代表重新操作了页面或数据库。
- 最新业务模块是 candidate10 离线包；目前没有获准派发的待执行请求。新会话不能把“预备 24 次”当作授权。

**撰写期间的并行 WIP（非本文实现、尚未据此更新验收结论）：** 已观察到 `scripts/real-input-budget.mjs`、`scripts/real-input-model-gateway.mjs` 有未提交修改，新增 `scripts/run-contrastive-recognition.mjs`、`scripts/score-contrastive-recognition.mjs`；另有 `scripts/contrastive-recognition.node-test.mjs` 出现在文件列表。它们涉及 candidate10 调度、预算和评分接线，仍在其他工作中变化。本文不暂存、不回滚、不运行这些脚本；迁移前必须再次 `git status --short --branch`，与改动负责方确认最终提交和授权。下文调用数、账本、检查及候选状态均绑定已核验基点和报告，不推断并行实现已通过或已获派发授权。

### 3.2 当前实际库证据

| 项目 | 结果 |
|---|---|
| 完整导出 | `C:\Users\Winner\Downloads\mainline-real-input-01-workspace (11).json`，393016 bytes |
| 独立读库文件 | `C:\Users\Winner\Downloads\real-input-local-evidence (14).json`，307607 bytes |
| 比较 | 完整导出对象与独立文件的 `workspace` 深度相等 |
| 对象数 | tasks 4；materials 5；timePoints 4；sources/sourceVersions/recognitionRuns/drafts 各 3；historyRecords 16 |
| 独立读库 | `effects.writes=0`；foreignDatabase/forbiddenNetwork/blockedDatabaseUpgrades 均 0 |
| 正式任务 | 填写送样登记单、提交放映授权书、上传预告片、上传校样PDF |
| 材料 | 送样登记单、放映授权书、版权方邮件许可截图、预告片、校样PDF，均 required + unverified |
| 替代关系 | **没有顶层 revisions 集合**；`source:09fec1bb:draft:1:1` 的原答和处置历史保存 supersedes；旧寄送任务未进入 canonical tasks |
| 证据时间 | workspace.savedAt 为 `2026-09-13T14:27:36.528Z`，不是本轮新建 4 项任务 |

原始文件 SHA256：

```text
workspace (11): 7EA80DA638C379A986F66077EFEE22AEC2B9212FCC74D883793040AB038D16CC
evidence (14):  B49CA7D644CB7E7C58EF7D37F343893847CF4736946A869F4F17856620B1D452
```

证据包装层不同，不能要求两个文件字节哈希相同。两份同时间快照的一致性也不能单独证明所有历史操作从未覆盖：旧记录不变、幂等和刷新证据须按对应历史报告范围复用。当前库快照不含 L04“保存最终版展签”，不能拿临时工程浏览器或旧回放数字说它已在当前库确认。

### 3.3 未完成工作与两组准备材料

**candidate10 待办：** 8 个固定教学例附加到 candidate03 指令，沿用既有 JSON Schema、source/scopes 和 none 模式。每个请求比基线增加 4126 字节（不是实测 token/费用）。12 个匿名开发例的基线/候选请求共 24 个，冻结在：

`docs/recognition-optimization/mainline-real-input-01/runs/opensource-methods-20260920a/prepared/`

其中 `REQUESTS.json`、`REFERENCES.json`、`MANIFEST.json` 已分开。生成脚本没有发送功能；统一预算、调度、返回身份及 promptVersion 接续仍需有限适配和测试才能派发。教学/开发例由同一实施者编写且结构相近，只能称开发对照，不能称独立盲测。

**另一组 6 份准备材料：** `read-download-closeout-20260920a/NEXT_SCOPE.json`，状态 `PREPARED_NOT_DISPATCHED`。它们未进入 candidate10 教学或开发包。后续选择如何用于验证前，先检查裁决质量；当前文件中的 `tasks` 有“当前待办”口径，而取消旧实体也要存在于语义响应，不能直接拿数组长度当完整语义任务分母。作者已见的合成通知不能凭“没调用过模型”宣称独立商业盲测。

### 3.4 账本、检查与技术债

- 权威账本：`docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl`。
- 595 行、历史实际请求 290 次；SHA256 `acd7a263be10887b5727b695faaaa8970cba4c57fd253df33a80116dcf42d0e5`。
- 当前最新报告的累计费用保守上界 13.663183 元，项目上限 20 元，含 A01 永久未知预留 3.30 元；不是服务商实扣。
- 历史请求上限 290 已用完。candidate10 提议最多 24 次、累计最多 314 次，只是待授权范围；本次写交接文档不启动这些调用。
- 最近 candidate10 检查：lint/type/contract/新增 5 测试/构建/扫描通过；Vitest 初次 1393 通过、1 缺 `REAL_INPUT_CARRIERS_MANIFEST` 失败、1 跳过，补既有路径后该项通过。
- Node 60 通过、1 历史 `RCO-5-007 FREEZE_HASH_MISMATCH:package-lock.json` 失败；Functions 5 通过。旧冻结断言未改，不能声称全套全绿。
- 已登记开发依赖漏洞尚未整体解决；本轮未做新依赖审计。现有 lint 4 warning、bundle >500 kB warning 保留。不要把 secret scan PASS 说成完整供应链审计通过。
- 首次模型错误仍主要在任务/材料边界、归属、条件和依赖；工程承接改善没有自动提高模型准确率。
- 账号、持续后台提醒、互联网可信同步、真实微信接入、商业化用户研究和发布验收仍不是已完成能力。

## 4. 整条线的全景规划（Roadmap & Next Steps）

### Phase 1：新工作区即刻执行的三件事

1. **恢复准确现场。** 核实际分支/HEAD/远端，读本文和短交接；确认 6632 当前库与两份备份仍可保留。若没有源码变化和新故障，直接复用已收口的保存/下载证据。
2. **集中审阅 candidate10 与固定裁决。** 唯一主问题仍是“任务动作 vs 材料要求，并保证取消/替代/依赖有实际目标”。检查 8 教学例、12 开发例是否互相泄漏和误标；特别避免把任务对象一律建材料、把取消一律要求有新替代项、把条件满足等同任务完成。将当前待办数、全部语义任务数和合理待处理数分别定义。
3. **把一个有边界的比较准备完整。** 在实际获准后，以同一 Flash none 配置运行 candidate03/candidate10 的固定配对；先完善统一预算与版本身份接线，不独立 fetch。报告无需实质纠正来源数、各类错误、正确保存任务数、等待和费用。没有净收益则保留基线并停止该候选。

### Phase 2：有净收益之后

- 对 candidate10 或下一项获准方案进行独立、未用于教学和调参的评估；现有 12 例只作开发材料。取消、条件、时间和正常独立任务是防退化对照。
- 将已结算、身份完整的合适历史结果接入 6632；用真正发生变化的示例检验核对→纠正→保存，避免重复造任务。只有新增行为需要新页面验收。
- 用明确事件口径观察输入、建议可用、必要纠正、主动确认、正确保存各环节。先记录事实，再谈转化率；代理点击和工程回放不能当真人节省时间。
- 如果错误集中在已正确提取文字之后，继续聚焦语义边界；只有输入文字本身丢失时才独立评测 OCR/PDF 工具。不要将两层优化混进同一个配对结论。

### Phase 3：稳定发布与扩展

- 按 `docs/recognition-optimization/COMMERCIAL_VALIDATION_CONTRACT.md` 和 AGENTS 的商业阶段要求，完成获准的真实去标识材料/真人核对、跨浏览器/手机/键盘、失败恢复、成本与运行稳定性验证。
- 分阶段处理依赖漏洞、bundle 拆分及性能；升级时给出受影响测试和冻结差异处理，不降低历史断言。
- Preview 和 Production 各需明确发布授权、受控服务端凭据、额度/身份/数据隔离、回滚和稳定性证据。现有仓库配置不能证明域名或生产服务当前健康。
- 账号同步、后台提醒、微信、支付等另开产品范围；PRD 有基础接口/状态模型，不等于已有外部账号与服务验收。

以上为接续路线，不自动授权新付费调用、真实学生材料采集或部署。

## 5. 迁移与启动指南（Quick Start）

### 5.1 迁移前必须保留什么

Git 分支包含代码、锁文件、冻结匿名原答、评估及报告；**不包含浏览器 IndexedDB、Downloads 中的实际文件、临时构建目录或服务端凭据**。

1. 保留当前浏览器及 `http://127.0.0.1:6632/` 站点数据；移动代码目录不会搬走/清除该库。端口、协议、主机名、浏览器 profile 任一变化都可能进入另一个存储空间。
2. 单独安全备份上述两个实际 JSON 并校验 SHA；不要为交接把真实用户导出默认加入 Git。
3. 新机器上克隆代码后页面不会自动恢复旧库。当前实验格式也不能直接导入稳定产品。跨机器恢复需要审查已有恢复能力和原子写入范围；在完成前保持原浏览器可用，不把新空库当原库验收。
4. 临时 `carriers.json`、字体和构建产物不会随 Git 自动迁移；需要相关测试时按下述生成器重建既有工程载体。

### 5.2 获取代码与依赖

```powershell
# 新目录：自行选择路径；不要覆盖已有工作区。
git clone --branch codex/e2-multimodal-recognition-exp --single-branch https://github.com/nightair5/Student-Affairs-Manager.git Student-Affairs-Mainline
Set-Location Student-Affairs-Mainline
git status --short --branch
git log -5 --oneline
git ls-remote origin refs/heads/codex/e2-multimodal-recognition-exp
node --version
npm --version
npm ci
```

已有仓库只核对现场；不要强制 checkout、reset、清理或自动变基。Functions 单独跑测试时先检查 `functions/package.json` 与其锁文件，有需要再 `npm --prefix functions ci`。

### 5.3 启动当前隔离试用（首选）

```powershell
# 先检查已有服务；已正常运行就直接使用。
Invoke-RestMethod http://127.0.0.1:6632/api/status -TimeoutSec 5

# 状态失败时先查监听；没有输出才表示当前未查到 TCP 监听。
Get-NetTCPConnection -LocalPort 6632 -State Listen -ErrorAction SilentlyContinue

# 仅确认端口无监听时，在仓库根目录启动；终端保持打开。
node scripts/build-real-input-preview.mjs --local
```

该脚本核验固定原答 SHA，在系统临时目录生成产物并监听 `127.0.0.1:6632`，输出 manifest；不加载根 `.env`，不需要模型密钥。HTTP 超时/异常不等于服务未运行；监听查询本身因权限等报错时也不能推断没有服务。端口已有监听但状态不符时保留现场并定位，不为启动而随意结束进程。允许的 host/origin 被固定，不能直接换成 `localhost:6632` 或随便换端口。

本次状态应含 Q01-06、Q07-06、R11-07、R12-07、U11-09、V02-09、L01-A、L02-A、L04-A，共 9 份；`modelCallsEnabled=false`。HTTP 服务禁止 POST 写入/模型请求，**浏览器本地经确认的 IndexedDB 写入仍可用**。

普通 UI 开发使用 `npm run dev`（Vite 配置端口 4173、/api 代理到 8787），但它是另一个入口/数据库范围，不是 6632 的替代验收。普通 `npm run build` 是 `tsc -b && vite build`，Vite 可能加载根 `.env`，不作为当前隔离检查默认命令。

### 5.4 环境变量与服务边界

| 场景 | 配置 |
|---|---|
| 6632 历史回放、离线包生成 | 无需 Secret，无需根 `.env` |
| 工程载体测试 | `REAL_INPUT_CARRIERS_MANIFEST` 指向既有 `carriers.json`，只含匿名工程路径 |
| 获准的真实实验调用 | 统一 gateway 服务端读取 `DEEPSEEK_API_KEY`；使用已批准路由、账本/身份策略，禁止在本文填值 |
| 普通 Node 服务（可选） | `SAM_SERVICE_HOST` 默认 127.0.0.1；`SAM_SERVICE_PORT` 默认 8787；`SAM_ALLOWED_ORIGIN` 默认 http://localhost:4173；`SAM_DATA_DIR` 默认 .data |
| 同步/邮件/抓取（可选） | `SAM_SYNC_TOKEN`；`SAM_EMAIL_PROVIDER`/`SAM_EMAIL_WEBHOOK_URL`/`SAM_EMAIL_WEBHOOK_TOKEN`/`SAM_EMAIL_FROM`；`SAM_WEB_FETCH_ENABLED`；均需对应外部接入授权 |
| 普通 DeepSeek 服务（非实验路由） | `DEEPSEEK_API_URL`、`DEEPSEEK_MODEL`，默认 Chat Completions / deepseek-v4-flash；不能误认为与实验 deepseek-flash Responses 配置相同 |

`npm run server` 会通过 `--env-file-if-exists=.env` 加载环境；不为普通本机回放运行它。Secret 不放 `VITE_*`、源码、日志、URL、浏览器库或导出。`.data`、OAuth 登录文件和凭据不属于迁移文档交付物。

### 5.5 无模型调用的检查命令

```powershell
npm run lint
npm run typecheck
npm run recognition:contract:check
npx --no-install vitest run --config scripts/mainline-01.vitest.config.mts src/experiments/realInput01/candidate10.test.ts
npm run security:scan
git diff --check
```

`scripts/mainline-01.vitest.config.mts` 明确 `envDir:false`、node 环境、无缓存。若改动确认/材料/时间，选择相应现有 test 文件；完整 `npm run test` 还串联多个 Node 和 Functions 套件，含已知历史冻结失败，不能只报 Vitest 绿色。

安全临时构建（根 `.env` 不读取）：

```powershell
npm run typecheck
node --input-type=module -e "import {build} from 'vite'; import react from '@vitejs/plugin-react'; import {mkdtempSync} from 'node:fs'; import {join} from 'node:path'; import {tmpdir} from 'node:os'; const outDir=mkdtempSync(join(tmpdir(),'student-affairs-handover-')); await build({configFile:false,envDir:false,plugins:[react()],base:'/',build:{outDir,emptyOutDir:false}}); console.log(outDir);"
```

已有工程载体缺失时，`scripts/render-mainline-real-input-01-fixtures.mjs --output=<新临时目录绝对路径>` 可生成旧 8 通知的格式载体和 `carriers.json`；先检查函数所需字体路径与本机依赖，再设置 `REAL_INPUT_CARRIERS_MANIFEST` 指向该文件。它是旧匿名素材的工程重建，不是新模型数据，不能由临时路径缺失推断产品回归。

candidate10 离线准备可用 `node scripts/prepare-opensource-recognition.mjs`；仅在需要重现构造时执行。它会生成一个新临时目录，不覆盖已经冻结的 prepared 包，也不会发送请求。不要将临时 manifest 和已冻结 manifest 混用。

### 5.6 典型操作与验收定位

入口与记录的固定映射：**体验多任务通知 = L01-A；核对送样与共享材料 = L02-A（W11）；核对展签与前置关系 = L04-A（W12）**。W11/W12 是原材料案例别名，不是新增运行身份。

1. 打开 `http://127.0.0.1:6632/`。已有库应恢复；新浏览器需要显式创建实验库，不能冒充旧库恢复。
2. “新事务”选择“体验多任务通知”“核对送样与共享材料”或“核对展签与前置关系”。同源已有另一批次记录时继续已有草稿，避免两臂各建一套任务。
3. 原文与建议一起核对。L01 正确事实只做必要核对；W11 多余材料任务/条件/归属需纠正；W12 从“核对前置依赖”选原文、写说明、保存后重新算资格。准备情况无证据时显式 unverified。
4. 主动确认合法任务；未知条件和真实未满足依赖继续待处理。刷新后去任务中心、日历相应日期/无日期区、详情找回。
5. 工程工具“独立仓储读回全对象”完成后点“下载本次工程证据JSON”；完整导出先“准备完整测试库 JSON”，再“下载已准备的完整测试库 JSON”。实际文件比较 `完整文件` 与 `工程文件.workspace`。

这套闭环已经有当前实际文件证据。恢复新会话不必重做；仅当新增实现改变相关行为或出现新故障时追加对应验收。

### 5.7 最短阅读顺序与证据索引

以下报告均位于 `docs/recognition-optimization/mainline-real-input-01/runs/`：

| 路径 | 用途 |
|---|---|
| `read-download-closeout-20260920a/AUDIT.md` | 当前库 4 任务、双文件、writes=0、无顶层 revisions 的交付依据 |
| `read-download-closeout-20260920a/NEXT_SCOPE.json` | 独立保留的 6 份未派发准备材料 |
| `opensource-methods-20260920a/AUDIT.md`、`CHECKS.json`、`prepared/MANIFEST.json` | 最新 candidate10 实现、测试、配对请求与待授权边界 |
| `baseline-hard-corrections-20260915a/AUDIT.md` | W11/W12 错误、4 处纠正及 12→13 工程正确保存 |
| `correction-editor-interaction-closeout-20260920a/AUDIT.md` | 编辑器完整事件链的临时工程浏览器证据 |
| `latest-none-browser-delivery-20260916a/AUDIT.md` | L01/L02/L04 最新 None 回答接线 |
| `reasoning-low16-compare-20260914a/AUDIT.md`、`BUSINESS_ADJUDICATION.json` | 最新 12 对 none/low 与逐项业务裁决 |
| `candidate09-20260913a/AUDIT.md` | 结构路线取舍与早期实际保存证据 |
| `usage-resume-20260907a/CALL_LEDGER.jsonl` | 唯一累计账本，追加式，不覆盖 |

新会话按“本文 → `docs/recognition-optimization/CURRENT_CONTEXT.md` → 实际 Git → 当前阶段 AUDIT/CHECKS → 直接修改的代码”读取即可。`docs/recognition-optimization/OPTIMIZATION_LOG.md` 用于定点追溯，不重新加载全部原始回答和历史报告。

可直接发给新会话的起始指令：

```text
继续 MAINLINE-REAL-INPUT-01。先读 docs/recognition-optimization/HANDOVER_CONTEXT_BRIEF.md、docs/recognition-optimization/CURRENT_CONTEXT.md，并核实际 Git/远端及并行未提交改动。
当前可靠基线是 Flash + candidate03 + reasoning=none；6632 保存和双下载已收口。candidate10 已离线提交但尚未采用、尚未评测。
先完成 candidate10 教学例/开发裁决及既有预算接线的只读差异检查，给出一个最小的后续实施范围；不重复保存下载收尾，不派发模型，不部署、不改用户库。
保留旧候选、原答、Expected、评分器、账本及当前未提交工作。后续执行按本次用户明确任务范围继续，不把本文路线图当付费调用授权。
```

本文可以恢复代码与决策上下文；原浏览器数据、外部凭据及尚未取得的模型/商业证据必须按各自边界交接，不能由文档补造。
