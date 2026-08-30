# Product v2 Beta QA and Acceptance

> Preview：`https://student-affairs-manager-preview.nightsdell.workers.dev/`
> RC：`v2.0.0-beta.1-rc.1`
> Commit：`5c443d40d986483b983e98ff52efedd26d9b87fc`
> Cloudflare Version：`64d9b827-0787-4188-9cf3-032202c672c1`
> Production：未修改

## 1. 判定规则

- `PASS`：本次 RC 上有与要求同范围的可复核证据。
- `FAIL`：已执行且结果不满足验收标准。
- `NOT RUN`：尚未执行或环境不足；不能用相邻测试替代。
- 自动测试、HTTP 200、静态检查和浏览器人工验收分别记录，不互相冒充。
- Beta 人工门槛：P0 = 0、P1 = 0、数据丢失 = 0、静默错误提交 = 0、Key 泄漏 = 0。

## 2. R9 工程门禁

2026-08-30 在 `release/v2-beta@5c443d4` 执行：

| 门禁 | 结果 | 证据摘要 |
| --- | --- | --- |
| `npm ci` | PASS | 241 packages；0 vulnerabilities |
| `npm run lint` | PASS | ESLint 0 errors |
| `npm run typecheck` | PASS | TypeScript build 0 errors |
| `TZ=UTC npm run test` | PASS | Vitest 43 files / 252 tests；Server 8；Worker 19；Functions 5 |
| `TZ=Asia/Shanghai npm run test` | PASS | 同上 |
| `npm run build` | PASS | Vite 1683 modules transformed |
| `npm run security:scan` | PASS | 201 source/build files；无 Secret 命中 |
| `npm audit --audit-level=high` | PASS | 0 vulnerabilities |
| `npm run cloudflare:check` | PASS | Worker 19；Production/Preview dry-run 均成功 |
| `git diff --check` | PASS | 无 whitespace error |

UTC 首次运行发现 canonical 事件 `08:30+08:00` 被宿主时区显示为 `00:30`。缺陷修复并增加显式 offset、naive local datetime 回归后，两套时区完整门禁均重新通过。修复提交：`5c443d4 fix(app): stabilize calendar workspace timezone`。

## 3. 浏览器 A–J 证据矩阵

每个场景必须验证：

```text
Capture → Source 先保存 → RecognitionRun → Draft → Evidence
→ Human Review → DomainCommitPlan → Atomic Commit → Workspace v8
→ Refresh → 数据保持
```

并检查错误提示、键盘操作、移动端、浏览器返回、重复点击和网络中断。证据必须为当前 RC 的截图或录屏。

| 场景 | 匿名合成输入 | 关键预期 | 状态 |
| --- | --- | --- | --- |
| A | 简单课程通知：提交一次课程作业 | 1 个显式任务；日期、动作和依据可编辑 | NOT RUN |
| B | 同一通知含报名、交材料、参加说明会 | 多任务逐项编辑、拒绝、部分确认 | NOT RUN |
| C | 报名、初稿、终稿三个截止日期 | 多 timePoint 正确关联，最早行动进入 Today | NOT RUN |
| D | 报名表、承诺书、PDF 命名规则 | 材料不冒充任务；命名要求保留在材料约束 | NOT RUN |
| E | 线下答辩事件及提前准备材料 | Event 与准备 Task 分离且可追溯 | NOT RUN |
| F | “下周前”“答辩前三天”等相对时间 | 标记待确认，不猜测不可可靠归一化日期 | NOT RUN |
| G | 纯讲座资讯、无动作要求 | 保存 Source，但不生成伪任务 | NOT RUN |
| H | 匿名图片、文本层 PDF、扫描 PDF | 本机 OCR/提取有进度、限制、校对与手动补充 | NOT RUN |
| I | AI timeout、502、invalid schema | Source 不丢；显示安全错误；可用本地规则/手动继续 | NOT RUN |
| J | 导出、二次确认清空、导入、刷新、迁移恢复 | JSON round-trip；失败导入不破坏当前 Workspace | NOT RUN |

当前阻断证据：应用内浏览器报告 IndexedDB 不可用；Chrome 扩展未连接；官方 Windows 电脑控制因 Edge 窗口含多个页面、无法唯一确认当前 URL 而安全终止。因此本表保持 `NOT RUN`，不能宣布 R9 通过。

## 4. 安全、可靠性与性能

### 4.1 安全

| 检查 | 自动证据 | 浏览器证据 | 当前判定 |
| --- | --- | --- | --- |
| DeepSeek Key 仅服务端 | secret scan、Worker/Functions tests | bundle/network 人工复核 | PARTIAL |
| Origin / Content-Type / Body Size | Worker/Functions tests | Preview 网络面板 | PARTIAL |
| Prompt injection 作为不可信数据 | Worker test | 场景 I | PARTIAL |
| SSRF、redirect 每跳复核 | Server/Worker tests | Preview URL 输入 | PARTIAL |
| 文件类型、大小、页数和 50k 截断 | fileExtraction 17 tests | 场景 H | PARTIAL |
| Export 不含 Secret/文件本体 | secret scan、repository tests | 场景 J | PARTIAL |
| Preview/Production 隔离 | Wrangler config、独立 Worker URL | Production 404/Preview 页面 | PARTIAL |
| 实验 endpoint 关闭 | Worker test | `/benchmark*`、`/e2*` 等 HTTP 404 | PARTIAL |

### 4.2 可靠性

AI 失败保留 Source、确认单事务、迁移失败不覆盖、导入失败不替换、幂等 operation ID、late run 不覆盖 current version、Error Boundary 与手动继续均有自动测试或代码证据；刷新、重复点击、浏览器返回和网络中断仍需 A–J 当前 RC 人工证据。

### 4.3 性能记录模板

浏览器 A–J 时记录冷/热启动各一次，单位毫秒：

| 指标 | 冷启动 | 热启动 | 状态反馈是否 <20 秒 | 备注 |
| --- | ---: | ---: | --- | --- |
| 首页可交互 | NOT RUN | NOT RUN | NOT RUN |  |
| Inbox 加载 | NOT RUN | NOT RUN | NOT RUN |  |
| Project 加载 | NOT RUN | NOT RUN | NOT RUN |  |
| 普通保存 | NOT RUN | NOT RUN | NOT RUN |  |
| 文件上传/提取 | NOT RUN | NOT RUN | NOT RUN |  |
| AI 请求 | NOT RUN | NOT RUN | NOT RUN | 记录成功、超时或不可观测 |
| 刷新恢复 | NOT RUN | NOT RUN | NOT RUN |  |

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

稳定期权威起点采用 Cloudflare Version 创建时间：`2026-08-30T01:45:23.994Z`（Asia/Shanghai `2026-08-30 09:45:23.994`）；满 48 小时的最早判定点为 `2026-09-01 09:45:23.994`。

| 观测时间（Asia/Shanghai） | Preview 首页 | Preview status | Preview 实验路径 | Production 首页/版本 | Production 实验路径 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-30 09:54:56 | 200 HTML | 200；configured true；`deepseek-v4-flash`；未发起模型调用 | `/benchmark`、`/e2`、`/fact-ledger`、`/selection`、`/blind`、`/research-preview` 均为 JSON 404 | 200；Deployment `bc1719b0…` / Version `3b6d6ba2…` 未变 | 相同路径均为 SPA HTML 200 | Preview 可用且隔离；旧 Production 未变，但字面 404 门槛未满足 |

已创建当前任务心跳 `v2-beta-preview-48h`，每 6 小时执行只读检查，截止到满 48 小时后的首个观测点。心跳不得调用付费模型、修改 Secret、部署或改变路由。

Production 的 200 响应为旧版本 SPA fallback，不是实验页面或实验 API；但附件明确要求 Production 返回 404，因此该项仍是发布前未关闭证据。未经用户独立明确批准，不得为了修正状态码部署 Production。

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| R9 工程门禁 | PASS | 全量命令已执行 |
| R9 Browser A–J | NOT RUN | 等待唯一可验证的 Edge/Chrome 浏览器状态 |
| R10 Alpha Test Kit | READY | 本文第 5 节；尚无真实参与者数据 |
| R10 Alpha run | NOT RUN | 不属于 Codex 可伪造范围 |
| R11 Preview RC deployment | DEPLOYED | Preview 独立 Worker，Production 未变 |
| R11 48-hour stability | IN PROGRESS | 需从部署时间起真实观察满 48 小时 |

在 Browser A–J、回滚演练和 48 小时稳定期完成前，状态不得提升为 `PRODUCT V2 BETA RELEASE CANDIDATE READY`。
