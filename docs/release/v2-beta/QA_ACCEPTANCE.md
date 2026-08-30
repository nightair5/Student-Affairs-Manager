# Product v2 Beta QA and Acceptance

> Preview：`https://student-affairs-manager-preview.nightsdell.workers.dev/`
> RC：`v2.0.0-beta.1-rc.4`
> Commit：`2a95dba23e18ea2fcde8e1e0dd9754db4f79fce8`
> Cloudflare Version：`1d6dc48e-167f-491b-ae55-908a9f2f27b9`
> Production：`https://student-affairs.site/`；Deployment `b353533d-53d1-4f4f-a9eb-d62cdc028051`；Version `d245a1dc-73a7-42fe-a088-ae0b0ddc3678`

## 1. 判定规则

- `PASS`：本次 RC 上有与要求同范围的可复核证据。
- `FAIL`：已执行且结果不满足验收标准。
- `NOT RUN`：尚未执行或环境不足；不能用相邻测试替代。
- 自动测试、HTTP 200、静态检查和浏览器人工验收分别记录，不互相冒充。
- Beta 人工门槛：P0 = 0、P1 = 0、数据丢失 = 0、静默错误提交 = 0、Key 泄漏 = 0。

## 2. R9 工程门禁

2026-08-30 在 `release/v2-beta@2a95dba` 重新执行当前 RC 门禁：

| 门禁 | 结果 | 证据摘要 |
| --- | --- | --- |
| `npm ci` | PASS | 241 packages；0 vulnerabilities |
| `npm run lint` | PASS | ESLint 0 errors |
| `npm run typecheck` | PASS | TypeScript build 0 errors |
| `TZ=UTC npm run test` | PASS | Vitest 43 files / 256 tests；Server 8；Worker 19；Functions 5 |
| `TZ=Asia/Shanghai npm run test` | PASS | 同上 |
| `npm run build` | PASS | Vite 1683 modules transformed |
| `npm run security:scan` | PASS | 清理 QA 临时脚本后的 205 source/build files；无 Secret 命中 |
| `npm audit --audit-level=high` | PASS | 0 vulnerabilities |
| `npm run cloudflare:check` | PASS | Worker 19；Production/Preview dry-run 均成功 |
| `git diff --check` | PASS | 无 whitespace error |

UTC 首次运行发现 canonical 事件 `08:30+08:00` 被宿主时区显示为 `00:30`。缺陷修复并增加显式 offset、naive local datetime 回归后，两套时区完整门禁均重新通过。修复提交：`5c443d4 fix(app): stabilize calendar workspace timezone`。

RC.1 浏览器 E 场景进一步发现：Event 自身的 `event_start` TimePoint 未关联 preparation Task 时，`selectionFromDraftItems` 会把该时间点过滤掉，并进一步静默丢弃用户已选 Event。该问题按 P1 停止发布，修复提交 `e3bdf47 fix(app): preserve selected event timepoints`；新增独立 Event TimePoint 回归后完整测试增至 253。RC.2 已通过真实 Edge 原子提交、刷新与 Calendar Event 复核；该缺陷已关闭，但 RC.1 稳定窗口永久作废，RC.2 必须重新累计完整 48 小时。

RC.2 的隔离 Edge J 场景发现 Export → 清空 → Import 后，兼容 autosave 会改写 canonical 材料截止、提醒启用状态、版本号与来源状态，按数据完整性 P0 立即作废窗口。`5ed3de7 fix(app): preserve canonical facts after import` 增加导入 revision 绑定与 canonical no-op merge，完整测试增至 254；RC.3 的 v8 round-trip、失败导入、v7 迁移和恢复演练随后通过。

RC.3 的 H 场景又发现长 PDF 子句使 `TimePoint.rawText` 超过 RecognitionResult 上限，以及把项目型建议改为独立事项时 TimePoint 残留 dangling milestone，导致本地规则失败或确认无法写入，按 P1 作废窗口。`2a95dba fix(app): confirm local PDF suggestions safely` 对时间证据做有界展示并清除 standalone TimePoint 的阶段引用，新增两个回归后完整测试增至 256。精确提交 CI `33315897535` 成功；RC.4 的文本层 PDF、扫描 PDF、J round-trip 与迁移恢复均已在隔离 Edge 真实通过。

## 3. 浏览器 A–J 证据矩阵

每个场景必须验证：

```text
Capture → Source 先保存 → RecognitionRun → Draft → Evidence
→ Human Review → DomainCommitPlan → Atomic Commit → Workspace v8
→ Refresh → 数据保持
```

并检查错误提示、键盘操作、移动端、浏览器返回、重复点击和网络中断。证据必须为当前 RC 的截图或录屏。

| 场景 | 匿名合成输入 | 关键预期 | 状态 | 2026-08-30 Edge 实测摘要 |
| --- | --- | --- | --- | --- |
| A | 简单课程通知：提交一次课程作业 | 1 个显式任务；日期、动作和依据可编辑 | PASS | AI 无效结构后复用同一 Source 本地重试；1 Task / 1 Material / 1 TimePoint 原子提交；刷新后任务、来源依据与 1 条 created 历史仍在 |
| B | 同一通知含提交选题表、联系老师、上传报告 | 多任务逐项编辑、拒绝、部分确认 | PASS | 3 项建议触发聚焦复核；取消 1 项后按钮从 3 变 2，最终仅原子创建 2 项；未静默创建被取消项 |
| C | 报名与作品终稿两个截止日期 | 多 timePoint 正确关联，最早行动进入 Today | PASS | RC.2 原子确认后刷新保持；Calendar“即将到来”按 9/10 12:00 完成报名、9/15 18:00 提交终稿排列。Today 继续优先既有逾期事项，没有被未来任务错误抢占 |
| D | 报名表、身份证明、承诺书、PDF 命名规则 | 材料不冒充任务；命名要求可回看、可调整 | PASS（P2） | 1 Task / 4 Material / 1 TimePoint；完整 Capture→确认→刷新链通过，详情中的原文、Evidence、命名规则和 PDF 约束可回看，材料可在确认前取消。Workspace v8 的 `namingRequirements` / `formatRequirements` 为空且多出独立 `PDF格式）` Material，透明记录为不造成数据丢失、静默提交或核心流程中断的 P2 结构质量问题 |
| E | 线下答辩事件及提前准备材料 | Event 与准备 Task 分离且可追溯 | PASS | RC.1 的 Event 静默丢弃 P1 已修复。RC.2 使用“仅保存链接 → 手工补充 → 本地规则”避免模型调用，形成 1 Event / 1 preparation Task / 2 TimePoint / 1 Material；确认、刷新后 Calendar 明确显示 `14:00 参加课程答辩 · 事件`，重复 preparation Task 以冲突提示而未静默复制 |
| F | “下周前”“答辩前三天”等相对时间 | 标记待确认，不猜测不可可靠归一化日期 | PASS | 2 项 ambiguity、质量标记和“需要重点核对”同时可见；两个 TimePoint 默认不选中，草稿保留待用户决定 |
| G | 纯讲座资讯、无动作要求 | 保存 Source，但不生成伪任务 | PASS | Source 保留且正式实体计数为 0；没有伪任务。information-only 当前显示为 invalid result/识别失败，记为 P2 文案与状态改进项 |
| H | 匿名图片、文本层 PDF、扫描 PDF | 本机 OCR/提取有进度、限制、校对与手动补充 | PASS | RC.4 隔离 Edge 152.0.4191.53：文本层 PDF 本机读取 1 页/199 字，创建 2 Task；扫描 PDF 本机 OCR 1 页/124 字、置信度 0.90，创建 1 Task。两者均完成校对、本地规则、原子确认、刷新保持；Workspace 不含 PDF base64，模型调用 0 |
| I | AI timeout、502、invalid schema | Source 不丢；显示安全错误；可用本地规则/手动继续 | PASS | 实测 DeepSeek 返回无效 RecognitionResult 2.0：Source 先保存、错误可见、同源本地规则重试成功并可确认 |
| J | 导出、二次确认清空、导入、刷新、迁移恢复 | JSON round-trip；失败导入不破坏当前 Workspace | PASS | RC.4 隔离 Edge 真实下载最终 `.json`（32,874 bytes；SHA-256 `1FE2797A7E04E9112CC10162316EEE2E5D33D604D0A66D6DB989F440D47046C3`），双确认清空后导入，canonical 在导入后及刷新后均逐值一致；非法 JSON 不改变 Workspace。匿名 v7 同源注入后自动迁移到 v8，迁移备份与原夹具逐值一致；故障注入触发恢复面板，指定备份下载、准备恢复、二次确认和再次刷新均通过，模型调用 0 |

本轮保留了官方 Browser 的 A–I 交互截图，并由隔离 Edge 补齐当前 RC 的可持久化 H/J 证据。手机端以 `390×844` 验证单栏壳与底部导航，以 `390×667` 验证录入面板独立滚动与主按钮可触达。RC.4 截图：`C:\Users\Winner\AppData\Local\Temp\student-affairs-r9\r9-h-rc4-text-layer-persisted.png`、`C:\Users\Winner\AppData\Local\Temp\student-affairs-r9\r9-h-rc4-scanned-ocr-persisted.png`、`C:\Users\Winner\AppData\Local\Temp\student-affairs-r9\r9-j-rc4-recovered.png`。IAB 的 IndexedDB 限制只作为工具边界记录，不再用来否定独立 Edge 已完成的同范围证据。

浏览器边界：应用内浏览器仍报告 IndexedDB 不可用，不能承担持久化验收；文件上传、下载和 IndexedDB 全链改由全新隔离 Edge context 执行，不读取或覆盖用户浏览器数据。2026-08-30 约 19:14 一次扩展控制的新 Edge 页出现 `ERR_HTTP2_PING_FAILED`，PowerShell 与随后新页均正常；该客户端瞬时失败未发现 Cloudflare Version 漂移或数据丢失。

## 4. 安全、可靠性与性能

### 4.1 安全

| 检查 | 自动证据 | 浏览器证据 | 当前判定 |
| --- | --- | --- | --- |
| DeepSeek Key 仅服务端 | secret scan、Worker/Functions tests | RC.4 已部署 bundle 范围扫描 | PASS |
| Origin / Content-Type / Body Size | Worker/Functions tests | RC.4 匿名拒绝探针 | PASS |
| Prompt injection 作为不可信数据 | Worker + recognition 聚焦测试 | 固定 system prompt 与不可信 user 数据分层 | PASS |
| SSRF、redirect 每跳复核 | Server/Worker 聚焦测试 | RC.4 私网目标拒绝探针 | PASS |
| 文件类型、大小、页数和 50k 截断 | fileExtraction 17 tests | 场景 H | PASS |
| Export 不含 Secret/文件本体 | secret scan、repository tests | 场景 J | PASS |
| Preview/Production 部署隔离 | Wrangler config、独立 Worker URL | 两套 Worker 与 Deployment/Version 仍独立；Production 部署未覆盖 Preview | PASS |
| RC 候选实验 endpoint 关闭 | Worker test | Preview 六条已知路径均为 JSON 404 | PASS |
| 当前 Production 字面 404 | RC.4 Production 上线后直接探针 | 六条路径均为 JSON 404 | PASS；旧 Production 的 SPA HTML 200 保留为历史记录 |

RC.4 已部署首页及其 2 个 JS/CSS 资产共扫描 627,422 bytes：有界 Secret-like key 模式命中 0，前端资产中的 `DEEPSEEK_API_KEY` 名称命中 0。扫描仅输出计数，不输出任何疑似值；status 检查没有发送正文或调用模型。

2026-08-30 22:37 Asia/Shanghai 对 RC.4 发送四个必然在上游前终止的匿名探针：不受信任 Origin 返回 `403 ORIGIN_NOT_ALLOWED` 且无 CORS 放行头；同源错误 Content-Type 返回 `415 INVALID_CONTENT_TYPE`；同源超过 100 KB 的请求返回 `413 INPUT_TOO_LARGE`；`https://127.0.0.1/private` 返回 `400 WEB_PRIVATE_ADDRESS_FORBIDDEN`。随后 6 个聚焦 Worker 安全测试与 1 个 recognition prompt-injection 测试全部通过，覆盖固定 system prompt、unknown field、私网/IP、逐跳 redirect 和 DNS rebinding。Worker 日志只记录 requestId、路径、状态、时长、输入长度、token 数与错误类型，不记录匿名正文；本轮付费模型调用为 0。

### 4.2 可靠性

AI 失败保留 Source、确认单事务、迁移失败不覆盖、导入失败不替换、幂等 operation ID、late run 不覆盖 current version、Error Boundary 与手动继续均有自动测试或代码证据。RC.4 的隔离 Edge 152.0.4191.53 又实测：Enter 打开录入并把焦点落到 textarea，Escape 关闭；对确认按钮派发连续两次 click 只创建 1 Task，刷新后仍只有 1 Task；拦截并中断 `/api/deepseek/extract` 后，Source 先保存、正式 Task 为 0、约 922 ms 出现失败反馈，本地规则重试后确认并刷新保持。两组上游付费模型调用均为 0，可靠性门槛 `PASS`。浏览器返回从 Inbox 离开到 `about:blank`，作为不影响数据或应用内导航的 P2 体验问题保留。

### 4.3 性能记录

浏览器 A–J 时记录冷/热启动各一次，单位毫秒：

| 指标 | 冷启动 | 热启动 | 状态反馈是否 <20 秒 | 备注 |
| --- | ---: | ---: | --- | --- |
| 首页可交互 | 1772 | 995 | 是 | 隔离 Edge，等待主标题可见；同轮重复观测曾为 1914 / 1188 ms |
| Inbox 加载 | 49 | — | 是 | 从应用内导航点击到 Inbox 标题可见 |
| Project 加载 | 363 | — | 是 | 从应用内导航点击到 Project 标题可见 |
| 普通保存 | 134 | — | 是 | 从确认 click 到复核面板关闭；重复 click 仍只创建 1 Task |
| 文件上传/提取 | 文本层 PDF 840 | 扫描 PDF OCR 3379 | 是 | 两者均为 1 页；随后确认和刷新保持通过，模型调用 0 |
| AI 请求 | NOT RUN（禁止付费调用） | 模拟断网反馈 922 | 是 | Source 先保存、无正式 Task；本地规则恢复确认 926 ms |
| 刷新恢复 | 1747–1918 | 995 | 是 | PDF 两次刷新恢复为 1747/1918 ms；普通热刷新 995 ms |

性能记录覆盖附件要求的首页、Inbox、Project、普通保存、文件处理、失败请求反馈和刷新恢复；真实上游 AI 成功延迟按“不得调用付费模型”约束明确保留为 `NOT RUN`。未观察到主页面卡死、无限 Loading、20 秒无反馈或 AI 处理阻塞整个页面。

## 5. R10：5–10 名学生 Alpha Test Kit

Alpha 只使用 Preview，不使用 Production。Codex 仅准备测试包，不伪造参与者、完成时间、满意度或接受率。

### 5.1 测试说明

目标：判断学生能否独立完成“录入 → 理解待确认 → 核对依据 → 修改 → 确认 → 从 Today 继续行动”，以及 AI 失败时是否知道如何手动继续。

- 建议样本：5–10 名在校学生，覆盖至少两种年级和三类事务经验。
- 单人时长：30–45 分钟。
- 设备：参与者自己的桌面或手机浏览器，记录浏览器与视口，不记录账号。
- 测试材料：仅使用下列匿名合成通知；参与者不得粘贴真实姓名、学号、联系方式、成绩、证件或未公开通知。
- 观察者不提示具体按钮；只有参与者停滞 60 秒后才能按统一话术提醒“请说出你现在认为下一步是什么”。

### 5.2 隐私、退出与数据删除

开始前逐项告知并取得口头或书面同意：

1. 数据保存在当前浏览器 IndexedDB，同一域名和浏览器可恢复，不会自动跨设备同步。
2. 仅当参与者主动选择智能整理时，当前匿名文字可能发送到 Preview 的 DeepSeek 服务；文件本体和图片不发送。
3. 研究记录只使用参与者编号 `P01`–`P10`，不记录姓名、学号、联系方式、账号或屏幕中的其他个人内容。
4. 参与者可随时跳过任务或退出，不影响任何权益。
5. 退出后先导出需要保留的匿名反馈，再通过应用内二次确认清空测试工作区；观察者核对刷新后为空。

### 5.3 五个核心任务

**任务 1：简单录入与确认**

> 课程通知：请在 9 月 8 日 18:00 前提交一份 800 字阅读回应，文件名为“课程号-序号”。

观察是否能独立 Capture、识别“待确认”、查看 Evidence、修改任一字段并确认。

**任务 2：复杂通知部分确认**

> 匿名比赛通知：9 月 5 日前报名，9 月 12 日提交 PDF 方案和承诺书，9 月 18 日 14:00 参加说明会。方案命名为“队伍编号-方案”。答辩时间另行通知。

要求拒绝一项建议、修改一项材料、保留相对/未知时间为待确认，再只确认其余事项。

**任务 3：纯信息通知**

> 本周五图书馆延长开放到 22:30，供有需要的同学自习，无需报名。

观察是否识别为信息保存而非伪任务，以及参与者能否理解该结果。

**任务 4：Today 到行动**

从已确认事项进入 Today，解释 Top 3 排序，找到下一步动作，并将一项设为稍后或完成。观察 Today 是否帮助行动，而非只展示信息。

**任务 5：AI 失败恢复**

使用测试环境提供的失败模拟或断网步骤触发不可用，要求参与者继续保存 Source、选择本地规则或手动补充，并最终得到可确认 Draft。不得为了制造失败改动 Production 或真实 Secret。

### 5.4 观察与计时表

每名参与者一行；只记录真实观测值：

| 字段 | 记录规则 |
| --- | --- |
| participantId | `P01`–`P10` |
| device / browser / viewport | 设备类别、浏览器版本、宽高 |
| firstCoreFlowSeconds | 首次打开 Capture 到第一次成功确认 |
| captureToConfirmSeconds | 每份 Source 分别计时 |
| editedFieldCount | 标题、日期、材料、项目、优先级等实际修改数 |
| acceptanceClass | `complete_accept` / `minor_edit` / `major_rework` / `abandoned` |
| aiFailureRecovered | `yes` / `no` / `not_triggered` |
| recapturedVoluntarily | 测试尾声是否主动再次 Capture |
| evidenceHelpfulness | 1–5 分及一句原因 |
| todayActionability | 1–5 分及一句原因 |
| observerPrompts | 统一提示次数 |
| dataDeleted | 清空并刷新核对后才写 `yes` |

聚合指标只从已完成的真实参与者行计算；样本数作为分母同时报告。Strict Structural、Golden 或自动测试成绩不得代替这些指标。

### 5.5 AI 修改分类

- `complete_accept`：未修改任何正式字段即确认。
- `minor_edit`：1–2 个字段小修，未改变任务集合或关键日期含义。
- `major_rework`：新增/删除任务，或重写关键日期、材料、项目关联。
- `abandoned`：无法或不愿完成确认。

同一 Draft 只归入一个最高影响类别。

### 5.6 反馈表

完成后让参与者用 1–5 分回答，并补充一句话：

1. 我理解“待确认”与“已进入任务中心”的区别。
2. 我能找到每项建议对应的原文依据。
3. 修改错误日期、材料或任务的成本可接受。
4. Today 帮助我决定下一步。
5. AI 失败后，我知道如何继续。
6. 我愿意在下次收到复杂通知时再次使用 Capture。

开放题：最困惑的一步、最想保留的一步、一个必须修复的问题、是否发现任何隐私担忧。

### 5.7 Bug 模板

```text
Bug ID:
Participant ID:
RC / commit:
Device / browser / viewport:
Scenario / task:
Severity: P0 / P1 / P2 / P3
Precondition:
Steps:
Expected:
Actual:
Data impact:
Recovery available: yes / no
Screenshot or recording path:
Console/network evidence (redacted):
Reproducibility: always / intermittent / once
```

P0/P1 立即停止该参与者后续操作并保留现场；先保护/导出匿名数据，再处理缺陷。P2/P3 记录到 Beta 后清单，不在 48 小时稳定期增加功能。

## 6. 当前 R9/R10/R11 判定

### 6.1 R11 稳定性观测记录

RC.1 因 Event 静默丢弃 P1 作废，RC.2 因 Export/Import canonical 改写 P0 作废，RC.3 因 PDF 本地规则确认 P1 作废，均不得与后续窗口拼接。RC.4 在 Preview 完成 H/J 与 Version 回退演练后曾从 Deployment `8bad8cc4-ea86-4a1e-ad7a-1560e010cae2` 计时；用户于 2026-08-31 明确批准提前部署 Production 并接受稳定期重新计时，因此该 Preview 窗口不再作为完整 48 小时结论。新的权威稳定窗口从 Production Deployment `b353533d-53d1-4f4f-a9eb-d62cdc028051` 创建时间 `2026-08-30T16:57:56.978876Z`（Asia/Shanghai `2026-08-31 00:57:56.978876`）起算，最早判定点为 `2026-09-02 00:57:56.978876`。

| 观测时间（Asia/Shanghai） | Preview 首页 | Preview status | Preview 实验路径 | Production 首页/版本 | Production 实验路径 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-30 09:54:56（RC.1） | 200 HTML | 200；configured true；`deepseek-v4-flash`；未发起模型调用 | `/benchmark`、`/e2`、`/fact-ledger`、`/selection`、`/blind`、`/research-preview` 均为 JSON 404 | 200；Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 相同路径均为 SPA HTML 200 | Preview 可用且隔离；旧 Production 未变，但字面 404 门槛未满足 |
| 2026-08-30 18:06:40（RC.1） | 200 HTML | 200；configured true；`deepseek-v4-flash`；未发起模型调用 | 六条已知实验路径持续为 JSON 404 | 200；Production 未被 Preview 部署覆盖 | 六条路径持续为 SPA HTML 200 | 起点后约 8 小时 21 分无可用性/版本漂移；Production 字面 404 仍未关闭 |
| 2026-08-30 约 19:14（RC.1） | PowerShell 200；一页 Edge 曾 `ERR_HTTP2_PING_FAILED`，新页随即恢复 | 200；未发送真实正文 | 本次非完整六路径轮询；沿用 18:06 完整观测 | 200；未部署 Production | 本次非完整六路径轮询 | 客户端 HTTP/2 瞬时失败；随后发现 Event 静默丢弃 P1，RC.1 稳定窗口作废 |
| 2026-08-30 19:47:56（RC.2） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条已知实验路径均为 JSON 404 | 200；Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 六条路径均为 SPA HTML 200 | Version `8a471784…` / Deployment `5f6441ed…` 起点后首检通过；Production 字面 404 与 RC.2 Event 浏览器复验仍未关闭 |
| 2026-08-30 20:42:27（RC.2） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条已知实验路径均为 JSON 404 | 200；Wrangler current Version 仍为 `3b6d6ba2…` | 六条路径均为 SPA HTML 200 | Wrangler current Preview Version 仍为 `8a471784…`，起点后约 1 小时 7 分无部署漂移；Production 未被覆盖，字面 404 仍未关闭 |
| 2026-08-30 21:13:09（RC.2） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条已知实验路径均为 JSON 404 | 200；Wrangler current Version 仍为 `3b6d6ba2…` | 六条路径均为 SPA HTML 200 | Wrangler current Preview Version 仍为 `8a471784…`，起点后约 1 小时 38 分无部署漂移；Production 未被覆盖，字面 404 仍未关闭 |
| 2026-08-30 21:51:28（RC.3） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条已知实验路径均为 JSON 404 | 200；Wrangler current Version 仍为 `3b6d6ba2…` | 六条路径均为 SPA HTML 200 | Wrangler current Preview Version 为 `e6da1443…`，与 RC.3 起点一致；Deployment `efd34105…` 无意外变化。Production 未被覆盖，字面 404 仍未关闭 |
| 2026-08-30 约 21:55（RC.3） | 200；文本层 PDF 提取成功 | 通过拦截安全置为未配置；模型调用 0 | 本次缺陷复现不改变路由 | Production 未部署 | 沿用 21:51 完整观测 | 本地规则因超长 TimePoint evidence 返回 `INVALID_RECOGNITION_RESULT`，H 核心闭环 P1；RC.3 窗口立即作废 |
| 2026-08-30 22:08:27（RC.4，回退演练前） | 200 HTML；H 两类 PDF 全链 PASS | 仅本地规则；模型调用 0 | 六条路径 JSON 404 | 200；Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 六条路径 SPA HTML 200 | Version `1d6dc48e…` 初检通过；J 于 22:12:34 继续通过。随后按计划执行 Preview-only Version 回退，故此短窗口不计入 48 小时 |
| 2026-08-30 22:13:52（RC.4，最终恢复） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条路径均为 JSON 404 | 200；Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 六条路径均为 SPA HTML 200 | 回退到 RC.3 后已恢复 RC.4 Version `1d6dc48e…`；最终 Deployment `8bad8cc4…`，R11 从本行重新起算 |
| 2026-08-30 22:24:13（RC.4） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条已知实验路径均为 JSON 404 | 200；Wrangler current Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 六条路径均为 SPA HTML 200 | Wrangler current Preview Deployment `8bad8cc4…` / Version `1d6dc48e…` 未变；连续覆盖约 10 分 21 秒，无失败窗口；Production 未被覆盖，字面 404 仍未关闭 |
| 2026-08-30 22:32:38（RC.4） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条已知实验路径均为 JSON 404 | 200；Wrangler current Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 六条路径均为 SPA HTML 200 | Wrangler current Preview Deployment `8bad8cc4…` / Version `1d6dc48e…` 未变；连续覆盖约 18 分 46 秒，无失败窗口；Production 未被覆盖，字面 404 仍未关闭 |
| 2026-08-31 约 01:00（RC.4，Production 起点） | 200 HTML；Deployment `8bad8cc4…` / Version `1d6dc48e…` 未变 | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条路径均为 JSON 404 | 200；Deployment `b353533d…` / Version `d245a1dc…`，100% 流量 | 六条路径均为 JSON 404 | 用户明确批准提前部署并接受重新计时；Production 首页、主 JS/CSS 与本地 RC.4 制品逐字节一致，旧 Deployment `bc1719b0…` / Version `3b6d6ba2…` 保留为回滚锚点；新 48 小时窗口从 00:57:56.978876 起算 |

当前任务心跳 `v2-beta-preview-48h` 已更新为 Production RC.4 监测，每 6 小时执行只读检查，截止到新窗口满 48 小时后的首个观测点。心跳不得调用付费模型、修改 Secret、部署或改变路由。

旧 Production 的 SPA HTML 200 记录保留为历史证据。用户独立明确批准 Production 部署后，RC.4 已使六条实验样式路径实际返回 JSON 404，该字面门槛已关闭；本次未发送真实正文或调用付费模型。

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| R9 工程门禁 | PASS | 全量命令已执行 |
| R9 Browser A–J | PASS | A–J 的核心链均通过，P0 = 0、P1 = 0；D 的 structured material requirements 作为已披露 P2 保留 |
| R10 Alpha Test Kit | READY | 本文第 5 节；尚无真实参与者数据 |
| R10 Alpha run | NOT RUN | 不属于 Codex 可伪造范围 |
| R11 Preview RC deployment | DEPLOYED | RC.4 Version `1d6dc48e…` / Deployment `8bad8cc4…`；仍作为隔离对照环境 |
| Production RC.4 deployment | DEPLOYED | 用户明确批准提前部署；Version `d245a1dc…` / Deployment `b353533d…`；首页/status/实验路径与制品身份初检通过 |
| R11 / Production 48-hour stability | RESTARTED | 从 2026-08-31 00:57:56.978876 起连续计时；最早 2026-09-02 00:57:56.978876 判定 |

在 Production RC.4 连续稳定满 48 小时并完成最终 R12 审计前，状态不得提升为 `PRODUCT V2 BETA RELEASE CANDIDATE READY`。Production 已上线不等于稳定性门槛已经通过。
