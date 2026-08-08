# Product v2.0 — E1 Phase A 领域契约

## 状态与边界

E1 Phase A 冻结了 Workspace v8 的类型、校验和离线迁移契约。经批准的 E1 Phase B 已把 v8 接入本机 IndexedDB 加载、保存、导入导出和正式确认路径；`ParsedSuggestion`、`recognitionToLegacySuggestions` 和 `materializeWorkspaceEntities` 只作为现有 React UI 的兼容视图保留，不再是正式提交路径。本轮没有生产部署。

这一区隔避免 Phase A 用未经生产验证的新结构触碰真实用户工作区，也避免 v7 的投影逻辑覆盖 v8 的独立实体数组。

## Canonical Domain Matrix

| Entity | Canonical / Derived | Source of truth | Main relations | Persisted in v8 | Notes |
| --- | --- | --- | --- | --- | --- |
| Source | Canonical | `sources[]` | workspace, current SourceVersion | Yes | 外部来源逻辑身份 |
| SourceVersion | Canonical | `sourceVersions[]` | Source | Yes | 每次具体内容版本；原文或安全引用 |
| RecognitionRun | Canonical | `recognitionRuns[]` | SourceVersion | Yes | provider/model/prompt/schema/pipeline 与执行状态 |
| ExtractionDraft | Canonical | `extractionDrafts[]` | RecognitionRun | Yes | AI/规则建议与正式事实隔离 |
| Project | Canonical | `projects[]` | workspace | Yes | 不再以内嵌 milestone 作为 v8 权威表示 |
| Milestone | Canonical | `milestones[]` | Project | Yes | 稳定 ID、独立生命周期 |
| WorkPackage | Canonical | `workPackages[]` | Project, Milestone | Yes | 简单项目可不用 |
| Task / Subtask | Canonical | `tasks[]` | Project/Milestone/WorkPackage/parent Task | Yes | Subtask 继续用 `parentTaskId`，最大一层 |
| Material | Canonical | `materials[]` | Project, Task, deadline TimePoint | Yes | 格式、命名和状态不再压成字符串 |
| TimePoint | Canonical | `timePoints[]` | Project/Milestone/Task/Material/Event | Yes | date-only、zoned datetime、relative/vague 分离 |
| Event | Canonical | `events[]` | Project, start/end TimePoint | Yes | 参加事件与准备动作分开 |
| EvidenceRef | Canonical | `evidenceRefs[]` | SourceVersion, field path | Yes | 不伪造 quote/page/bbox |
| ChangeProposal | Canonical contract | `changeProposals[]` | Project, SourceVersion, RecognitionRun | Yes | 本阶段只定义，不实现 Follow AI |
| HistoryRecord | Canonical | `historyRecords[]` | any canonical entity | Yes | 通用实体历史 |
| ReminderRecord | Canonical | `reminderRecords[]` | Task | Yes | draft/scheduled/sent/failed/unsupported 分离 |
| ProjectState | Derived cache | canonical graph recomputation | Project and related facts | No canonical persistence | `nextDeadline` 只能引用 TimePoint |
| Risk / Priority | Derived | pure rules over canonical facts | Task/Material/TimePoint | No | 原因可解释，可重算 |
| TodayRecommendation | Derived | pure ranking | Task and derived signals | No | 不成为第二任务事实源 |
| Material/Project progress | Derived | entity status aggregation | Material/Task/Milestone | No | 可随事实重算 |

## Workspace Schema v8

```ts
interface WorkspaceV8 {
  schemaVersion: 8
  workspace: WorkspaceIdentity
  settings: { defaultTimezone: string; locale: string }
  sources: Source[]
  sourceVersions: SourceVersion[]
  recognitionRuns: RecognitionRun[]
  extractionDrafts: ExtractionDraft[]
  projects: Project[]
  milestones: Milestone[]
  workPackages: WorkPackage[]
  tasks: Task[]
  materials: Material[]
  timePoints: TimePoint[]
  events: Event[]
  evidenceRefs: EvidenceRef[]
  changeProposals: ChangeProposal[]
  historyRecords: HistoryRecord[]
  reminderRecords: ReminderRecord[]
  preferences: WorkspacePreferences
  migrationMetadata: MigrationMetadata[]
  savedAt: string
}
```

v7 的材料、时间点、证据、历史和提醒数组曾由 Task/Source/Draft 投影重建。v8 明确相反：这些顶层数组就是事实源；当前 canonical repository 只允许 schema detection、migration、default normalization、validation 和轻微修复，不得用 Task 投影覆盖它们。

## 时间语义

- `date_only`：`YYYY-MM-DD` 是本地日历日期，不转换成 UTC midnight，ICS 使用 `VALUE=DATE`。
- `exact`：本地日期时间必须搭配 IANA timezone，或值自身含 `Z`/offset。
- `relative` / `vague`：`normalizedValue=null`、`needsConfirmation=true`，不伪装为精确时刻。
- Workspace 默认时区集中在 `settings.defaultTimezone`，中国高校场景默认 `Asia/Shanghai`。
- `1900-01-01`、`1970-01-01`、`9999-12-31` 禁止作为未知日期。

## Domain Graph Validator

校验器拆分为实体、引用、层级、依赖、时间和工作区聚合六个职责，覆盖全局 ID 唯一、引用完整、Project 内关系一致、Subtask 最大一层、Task dependency 无环、必填字段，以及时间合法性。它不判断中文标题是否“漂亮”、AI 是否拆分合理或材料是否应成为任务；这些属于 Recognition Quality。

## v7 → v8 Migration Mapping

| v7 field | v8 target | Level | Rule |
| --- | --- | --- | --- |
| `sources[]` | `Source[]` | SAFE | 保留 ID、类型、标题、状态和时间 |
| Source content/rawText/fileHash | `SourceVersion` | SAFE / REVIEW | 原文转 version 1；无 hash 标记 review，不伪造 hash |
| Draft metadata + RecognitionResult | `RecognitionRun` + `ExtractionDraft` | SAFE / REVIEW | 有 rich result 原样保存；provider 无法判断时 review |
| `projects[]` | `Project[]` | SAFE | 保留稳定 ID；旧 sourceIds/taskIds 放 legacyData |
| `project.milestones[]` | top-level `Milestone[]` | SAFE | 使用旧 milestone ID，导入导出后稳定 |
| `workPackages[]` | `WorkPackage[]` | SAFE | 保留层级引用 |
| `tasks[]` | `Task[]` | SAFE | 保留 ID、父子、依赖、内容和状态 |
| `Task.deadline` | `TimePoint(type=task_deadline)` | SAFE / REVIEW | 合法日期映射；未知/sentinel → null + vague + review |
| `Task.materials[]` | `Material[]` | REVIEW | 仅迁移已知名称/状态/关联，不猜格式、数量和命名 |
| `materialItems[]` | `Material[]` | SAFE | 独立实体优先于嵌入字符串 |
| `timePoints[]` | `TimePoint[]` | SAFE / REVIEW | 保留 ID；`deadline` 规范为 `task_deadline` |
| `events[]` start/end 字符串 | Event legacyData | REVIEW | Phase A 不猜事件时间点关系 |
| `evidence[]` | `EvidenceRef[]` | SAFE / REVIEW | 只迁移真实 quote/page/offset/bbox；source 指向 version 1 |
| `historyRecords[]` | `HistoryRecord[]` | SAFE / REVIEW | 保留 before/after；旧 draft item 目标需 Phase B 审查 |
| `reminderRecords[]` | `ReminderRecord[]` | SAFE / REVIEW | 状态保留；旧 sent 缺服务回执时 review |
| course/integration/knowledge/feedback | `preferences.legacyData` | REVIEW | 安全保留，不在 E1 猜测新领域位置 |
| 任意未知字段 | `legacyData` | UNMAPPABLE | 原样 JSON-safe 保留并标记 review |

迁移优先级固定为 Preserve > Review > Guess。`prepareV7ToV8Migration` 先复制完整 v7 backup，再在内存构造 v8 并执行全图校验；失败时 `workspace=null` 且列出安全错误，不可 apply。运行时 repository 已接入同一契约，并在替换 `current` 前持久化完整性校验过的备份；`rollbackMigration` 可恢复原 v7 快照。

## Golden fixtures 与 round-trip

复杂比赛 fixture 包含 1 Project、4 Milestone、1 WorkPackage、5 个顶层 Task + 2 个 Subtask、4 Material、5 TimePoint、1 Event 和 10 EvidenceRef。测试覆盖 Export → Import → Export 的语义等价、未知 `legacyData` 保留、坏引用拒绝、迁移备份与回滚、稳定 milestone ID、依赖环、子任务深度和 sentinel date。

同一完整测试套件在 CI 中分别以 `TZ=UTC` 与 `TZ=Asia/Shanghai` 运行，验证宿主时区不改变业务日期语义。

## E1 Phase B progress

### B1 Canonical Repository

Workspace v8 现在具备独立的 schema-aware repository：保存、加载、事务、导入与导出都先执行 v8 全图校验，浏览器写入使用单个 IndexedDB `readwrite` transaction。该路径直接持久化 `materials`、`timePoints`、`evidenceRefs`、`historyRecords` 与 `reminderRecords`，不会调用 v7 的 `materializeWorkspaceEntities`。`ProjectState` 仅由纯函数按 canonical graph 重算，不进入 Workspace v8 持久化结构。

B1 的 repository 已由 B2-B4 接入现有 App。React 页面从 v8 派生兼容视图；保存只按稳定 ID 回写明确可编辑字段，不能调用旧投影覆盖 canonical arrays。

### B2 Runtime Migration

Repository 的 schema-aware 加载现可识别 v7/v8。v7 升级先保存带完整快照与完整性哈希的独立备份，再在内存迁移、执行 Domain Graph Validator 与 v8 export/import round-trip；只有原记录仍与备份哈希一致时才原子替换 `current`。校验、备份或写入失败时 v7 不被覆盖，Repository 返回可解释的 migration 状态，并可按 backup ID 恢复原 v7。

匿名化的真实 v7 序列化副本覆盖 Task、Project/embedded Milestone、rich Material、TimePoint、Event start/end、Evidence、History、Reminder 与未知字段，并执行 migration → reload → rollback 演练。Event 的明确 start/end 会迁为独立 `event_start` / `event_end` TimePoint；无法可靠解释的值仍进入 `legacyData` / `needsReview`，不猜测。

### B3 Recognition Domain Atomic Commit

`DomainCommitPlan` 直接消费 `RecognitionResult 2.0` 与用户选择/编辑结果，统一解析 tempId，并在写入前校验父子层级、依赖、Event 时间和完整合并图。正式 v8 提交保留 Subtask、全部已接受 TimePoint、Material 的格式/命名/数量/提交渠道、独立 Event、字段级 Evidence 与确认 History；未知时间保持 null/relative/vague，不生成 sentinel date。

Repository 使用单个 IndexedDB transaction 应用计划；任何引用或全图校验失败均为零写入。operationId 与 Draft 上的已提交记录提供幂等确认；Partial Confirm 只提交选中实体，拒绝项和缺少必要父级/依赖的孤儿实体不会进入 canonical graph。legacy suggestion adapter 仍保留给旧 UI 显示，但不参与 v8 正式 Domain Commit。

### B4 Source-before-AI

Capture service 在任何 AI/本地识别 executor 被调用前，先在一个 canonical repository transaction 中持久化 Source、SourceVersion、queued RecognitionRun 与 processing ExtractionDraft，并等待事务成功。识别成功后只更新 Run/Draft/Source 状态；超时或无效结构会记录安全错误码并保留 Source，且不会创建任何正式 Project/Task。刷新或页面中断后仍可从 v8 恢复 processing/failed 草稿。

Retry 复用同一 SourceVersion，并创建新的 RecognitionRun 与 Draft；client operation ID 防止技术性重复点击创建重复 Source，但不会按正文相同自动合并真实通知。旧 UI bridge 只用于显示建议，已移除 Subtask 过滤和 `1970-01-01` fallback；正式保存仍只经过 DomainCommitPlan。

## E1 Phase B completion boundary

B1-B4 已在开发分支完成：v8 repository/IndexedDB store、v7 真实副本迁移与回滚演练、Rich RecognitionResult → Domain Commit Plan、单事务幂等确认、Source-before-AI 和运行时兼容视图。旧 adapter 文件仍为渐进 UI 展示保留，但已退出 v8 正式提交及 canonical 保存路径。E1 到此停止；未实施 E2 Prompt/识别质量优化、Project Memory、Follow AI、Risk Engine、D1/R2、账号同步、PWA、支付或 Production 部署。
