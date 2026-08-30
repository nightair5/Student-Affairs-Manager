# Product v2 Beta QA and Acceptance

> Preview：`https://student-affairs-manager-preview.nightsdell.workers.dev/`
> RC：`v2.0.0-beta.1-rc.2`
> Commit：`e3bdf47641b61e546380ff91db5d1b0a4266fe7e`
> Cloudflare Version：`8a471784-db7b-4dc9-a2b2-4337c452a5d9`
> Production：未修改

## 1. 判定规则

- `PASS`：本次 RC 上有与要求同范围的可复核证据。
- `FAIL`：已执行且结果不满足验收标准。
- `NOT RUN`：尚未执行或环境不足；不能用相邻测试替代。
- 自动测试、HTTP 200、静态检查和浏览器人工验收分别记录，不互相冒充。
- Beta 人工门槛：P0 = 0、P1 = 0、数据丢失 = 0、静默错误提交 = 0、Key 泄漏 = 0。

## 2. R9 工程门禁

2026-08-30 在 `release/v2-beta@e3bdf47` 重新执行当前 RC 门禁；`npm ci` 来自依赖图未变化的 RC.1 基线：

| 门禁 | 结果 | 证据摘要 |
| --- | --- | --- |
| `npm ci` | PASS | 241 packages；0 vulnerabilities |
| `npm run lint` | PASS | ESLint 0 errors |
| `npm run typecheck` | PASS | TypeScript build 0 errors |
| `TZ=UTC npm run test` | PASS | Vitest 43 files / 253 tests；Server 8；Worker 19；Functions 5 |
| `TZ=Asia/Shanghai npm run test` | PASS | 同上 |
| `npm run build` | PASS | Vite 1683 modules transformed |
| `npm run security:scan` | PASS | 205 source/build files；无 Secret 命中 |
| `npm audit --audit-level=high` | PASS | 0 vulnerabilities |
| `npm run cloudflare:check` | PASS | Worker 19；Production/Preview dry-run 均成功 |
| `git diff --check` | PASS | 无 whitespace error |

UTC 首次运行发现 canonical 事件 `08:30+08:00` 被宿主时区显示为 `00:30`。缺陷修复并增加显式 offset、naive local datetime 回归后，两套时区完整门禁均重新通过。修复提交：`5c443d4 fix(app): stabilize calendar workspace timezone`。

RC.1 浏览器 E 场景进一步发现：Event 自身的 `event_start` TimePoint 未关联 preparation Task 时，`selectionFromDraftItems` 会把该时间点过滤掉，并进一步静默丢弃用户已选 Event。该问题按 P1 停止发布，修复提交 `e3bdf47 fix(app): preserve selected event timepoints`；新增独立 Event TimePoint 回归后完整测试增至 253。RC.2 已通过真实 Edge 原子提交、刷新与 Calendar Event 复核；该缺陷已关闭，但 RC.1 稳定窗口永久作废，RC.2 必须重新累计完整 48 小时。

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
| D | 报名表、身份证明、承诺书、PDF 命名规则 | 材料不冒充任务；命名要求保留在材料约束 | PARTIAL | 1 Task / 4 Material / 1 TimePoint；刷新后详情仍可回看原文、命名规则及 PDF 约束。真实 Workspace v8 导出进一步证明该 Task 关联 4 个 Material，但 `namingRequirements` / `formatRequirements` 为空，且多出独立 `PDF格式）` 材料；这是无数据丢失、可人工核对的 P2 结构质量问题，不能伪装为通过 |
| E | 线下答辩事件及提前准备材料 | Event 与准备 Task 分离且可追溯 | PASS | RC.1 的 Event 静默丢弃 P1 已修复。RC.2 使用“仅保存链接 → 手工补充 → 本地规则”避免模型调用，形成 1 Event / 1 preparation Task / 2 TimePoint / 1 Material；确认、刷新后 Calendar 明确显示 `14:00 参加课程答辩 · 事件`，重复 preparation Task 以冲突提示而未静默复制 |
| F | “下周前”“答辩前三天”等相对时间 | 标记待确认，不猜测不可可靠归一化日期 | PASS | 2 项 ambiguity、质量标记和“需要重点核对”同时可见；两个 TimePoint 默认不选中，草稿保留待用户决定 |
| G | 纯讲座资讯、无动作要求 | 保存 Source，但不生成伪任务 | PASS | Source 保留且正式实体计数为 0；没有伪任务。information-only 当前显示为 invalid result/识别失败，记为 P2 文案与状态改进项 |
| H | 匿名图片、文本层 PDF、扫描 PDF | 本机 OCR/提取有进度、限制、校对与手动补充 | PARTIAL | Edge 已验证匿名 PNG 剪贴板、OCR 失败边界、人工补充与原子提交。官方 IAB 又验证文本层 PDF 本机读取 1 页，以及扫描 PDF 本机 OCR 1 页并得到可校对文字，均明确不上传文件本体且未进入模型整理；但 IAB 显示 IndexedDB 不可用，Edge 扩展又未启用 file URL 权限，因此 PDF 的同浏览器持久化、确认与刷新全链仍未证明 |
| I | AI timeout、502、invalid schema | Source 不丢；显示安全错误；可用本地规则/手动继续 | PASS | 实测 DeepSeek 返回无效 RecognitionResult 2.0：Source 先保存、错误可见、同源本地规则重试成功并可确认 |
| J | 导出、二次确认清空、导入、刷新、迁移恢复 | JSON round-trip；失败导入不破坏当前 Workspace | PARTIAL | A 的正式任务与 C/F 草稿均经关闭/刷新保留。Edge 实际生成 339,467-byte、可解析的 schema v8 JSON（12 Sources / 12 Tasks / 14 Materials / 20 TimePoints / 11 EvidenceRefs / 40 HistoryRecords；SHA-256 `A8D7953861C794460E5452B452582FB00D7AB3D3DCE29CE65FC9192F48BF2DA1`）；范围扫描未发现 `VITE_*` Key/Secret/Token、私钥或 `data:*;base64` 文件本体。另已冻结匿名 v7 迁移夹具，但公开 Import 只接受 v8，不能替代同源当前记录迁移。浏览器控制层未完成下载事件且文件保留 `.crdownload` 后缀；清空属于不可撤销操作，尚未取得动作时确认，因此清空 → Import、失败导入保护与真实 v7 迁移未执行 |

本轮截图证据已由官方 Browser 在当前任务中捕获：I 的失败 Source 卡片、B 的聚焦复核、A 刷新后的任务来源与历史、C 刷新后的 Calendar 顺序、RC.1 E 的 Calendar 缺失、F 的 ambiguity、G 的 0 实体 Source、H 的人工补充确认、文本层 PDF 与扫描 PDF 本机 OCR，以及 RC.2 E 刷新后正式 Event。手机端另以 `390×844` 验证单栏壳与底部导航，以 `390×667` 验证录入面板 `overflow-y: auto`：面板 `clientHeight=666`、`scrollHeight=768`，滚动 `102.4px` 后主按钮位于视口 `582.15–630.15px`，可完整触达。IAB 同时明确显示 IndexedDB 不可用，因此这些移动端/PDF 观察没有被扩大解释为持久化全链通过。截图：`C:\Users\Winner\AppData\Local\Temp\student-affairs-r9\r9-h-scanned-pdf-ocr.png`、`C:\Users\Winner\AppData\Local\Temp\student-affairs-r9\r9-mobile-intake-390x667.png`。没有把浏览器静态可见性或单元测试代替正式提交与刷新证据。

浏览器边界：应用内浏览器仍报告 IndexedDB 不可用，不能承担持久化验收；Edge 已能执行实际交互，但文件选择因扩展未启用 “Allow access to file URLs” 被拒绝。2026-08-30 约 19:14 一次新 Edge 页出现 `ERR_HTTP2_PING_FAILED`；同一时点 PowerShell 对 Preview 首页/status 与 Production 首页均为 HTTP 200，随后新的 Edge 页立即恢复到应用首页。该客户端瞬时失败窗口已记录，未发现 Cloudflare Version 漂移或工作区数据丢失。

## 4. 安全、可靠性与性能

### 4.1 安全

| 检查 | 自动证据 | 浏览器证据 | 当前判定 |
| --- | --- | --- | --- |
| DeepSeek Key 仅服务端 | secret scan、Worker/Functions tests | bundle/network 人工复核 | PARTIAL |
| Origin / Content-Type / Body Size | Worker/Functions tests | Preview 网络面板 | PARTIAL |
| Prompt injection 作为不可信数据 | Worker test | 场景 I | PARTIAL |
| SSRF、redirect 每跳复核 | Server/Worker tests | Preview URL 输入 | PARTIAL |
| 文件类型、大小、页数和 50k 截断 | fileExtraction 17 tests | 场景 H | PARTIAL |
| Export 不含 Secret/文件本体 | secret scan、repository tests | 场景 J | PASS |
| Preview/Production 隔离 | Wrangler config、独立 Worker URL | Production 404/Preview 页面 | PARTIAL |
| 实验 endpoint 关闭 | Worker test | `/benchmark*`、`/e2*` 等 HTTP 404 | PARTIAL |

### 4.2 可靠性

AI 失败保留 Source、确认单事务、迁移失败不覆盖、导入失败不替换、幂等 operation ID、late run 不覆盖 current version、Error Boundary 与手动继续均有自动测试或代码证据。本轮已补充 AI invalid schema、同源本地重试、部分确认、原子提交、刷新后正式任务与待确认草稿保持的 Edge 证据；浏览器返回、确认按钮重复点击、失败导入和完整网络中断仍未关闭。

### 4.3 性能记录模板

浏览器 A–J 时记录冷/热启动各一次，单位毫秒：

| 指标 | 冷启动 | 热启动 | 状态反馈是否 <20 秒 | 备注 |
| --- | ---: | ---: | --- | --- |
| 首页可交互 | NOT RUN | NOT RUN | NOT RUN |  |
| Inbox 加载 | NOT RUN | NOT RUN | NOT RUN |  |
| Project 加载 | NOT RUN | NOT RUN | NOT RUN |  |
| 普通保存 | NOT RUN | NOT RUN | NOT RUN |  |
| 文件上传/提取 | NOT RUN | NOT RUN | 有反馈 | PNG 剪贴板可进入录入；OCR 失败状态可见；IAB 已实测文本层 PDF 读取与扫描 PDF OCR，但毫秒计时及可持久化浏览器中的 PDF 全链未关闭 |
| AI 请求 | NOT RUN | NOT RUN | 有反馈 | invalid schema 安全失败并保留 Source；耗时未形成可信毫秒记录 |
| 刷新恢复 | NOT RUN | NOT RUN | 有反馈 | 正式任务与待确认草稿均已实测保留；耗时未形成可信毫秒记录 |

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

RC.1 的稳定期从 `2026-08-30T01:45:23.994Z` 起算，但因 E 场景 P1 在约 10 小时后停止并作废，不得与 RC.2 拼接。RC.2 的权威起点采用 Cloudflare Version `8a471784-db7b-4dc9-a2b2-4337c452a5d9` 创建时间：`2026-08-30T11:35:00.005Z`（Asia/Shanghai `2026-08-30 19:35:00.005`）；满 48 小时的最早判定点为 `2026-09-01 19:35:00.005`。

| 观测时间（Asia/Shanghai） | Preview 首页 | Preview status | Preview 实验路径 | Production 首页/版本 | Production 实验路径 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-30 09:54:56（RC.1） | 200 HTML | 200；configured true；`deepseek-v4-flash`；未发起模型调用 | `/benchmark`、`/e2`、`/fact-ledger`、`/selection`、`/blind`、`/research-preview` 均为 JSON 404 | 200；Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 相同路径均为 SPA HTML 200 | Preview 可用且隔离；旧 Production 未变，但字面 404 门槛未满足 |
| 2026-08-30 18:06:40（RC.1） | 200 HTML | 200；configured true；`deepseek-v4-flash`；未发起模型调用 | 六条已知实验路径持续为 JSON 404 | 200；Production 未被 Preview 部署覆盖 | 六条路径持续为 SPA HTML 200 | 起点后约 8 小时 21 分无可用性/版本漂移；Production 字面 404 仍未关闭 |
| 2026-08-30 约 19:14（RC.1） | PowerShell 200；一页 Edge 曾 `ERR_HTTP2_PING_FAILED`，新页随即恢复 | 200；未发送真实正文 | 本次非完整六路径轮询；沿用 18:06 完整观测 | 200；未部署 Production | 本次非完整六路径轮询 | 客户端 HTTP/2 瞬时失败；随后发现 Event 静默丢弃 P1，RC.1 稳定窗口作废 |
| 2026-08-30 19:47:56（RC.2） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条已知实验路径均为 JSON 404 | 200；Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 六条路径均为 SPA HTML 200 | Version `8a471784…` / Deployment `5f6441ed…` 起点后首检通过；Production 字面 404 与 RC.2 Event 浏览器复验仍未关闭 |
| 2026-08-30 20:42:27（RC.2） | 200 HTML | 200；configured true；`deepseek-v4-flash`；仅检查状态，未调用模型 | 六条已知实验路径均为 JSON 404 | 200；Wrangler current Version 仍为 `3b6d6ba2…` | 六条路径均为 SPA HTML 200 | Wrangler current Preview Version 仍为 `8a471784…`，起点后约 1 小时 7 分无部署漂移；Production 未被覆盖，字面 404 仍未关闭 |

已创建当前任务心跳 `v2-beta-preview-48h`，每 6 小时执行只读检查，截止到满 48 小时后的首个观测点。心跳不得调用付费模型、修改 Secret、部署或改变路由。

Production 的 200 响应为旧版本 SPA fallback，不是实验页面或实验 API；但附件明确要求 Production 返回 404，因此该项仍是发布前未关闭证据。未经用户独立明确批准，不得为了修正状态码部署 Production。

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| R9 工程门禁 | PASS | 全量命令已执行 |
| R9 Browser A–J | PARTIAL | A/B/C/E/F/G/I 通过；D/H/J 尚有未执行或未证明子项，完整门槛未关闭 |
| R10 Alpha Test Kit | READY | 本文第 5 节；尚无真实参与者数据 |
| R10 Alpha run | NOT RUN | 不属于 Codex 可伪造范围 |
| R11 Preview RC deployment | DEPLOYED | RC.2 Preview 独立 Worker，Production 未变 |
| R11 48-hour stability | RESTARTED | RC.1 因 P1 作废；RC.2 从 2026-08-30 19:35:00.005 重新计时 |

在 Browser A–J、回滚演练和 48 小时稳定期完成前，状态不得提升为 `PRODUCT V2 BETA RELEASE CANDIDATE READY`。
