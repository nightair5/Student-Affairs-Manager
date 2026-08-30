# Product v2 Beta Migration and Rollback

> 适用分支：`release/v2-beta`
> Production 基线：`7a0af21e881dd97ee5c2247e0666a033ff53ae7e`
> 目标事实源：Workspace schema v8
> 原则：先备份、内存迁移、全图校验、round-trip，再原子替换；失败保持原记录

## 1. 迁移契约

v7 只作为受保护的迁移输入。v8 顶层 `sources`、`sourceVersions`、`recognitionRuns`、`extractionDrafts`、`projects`、`milestones`、`workPackages`、`tasks`、`events`、`timePoints`、`materials`、`evidenceRefs`、`historyRecords`、`reminderRecords` 与 `changeProposals` 是 canonical facts；兼容视图不得反向覆盖这些数组。

运行时顺序固定为：

```text
读取 v7
→ 严格解析 v7 envelope
→ 持久化不可变备份及完整性哈希
→ 在内存中准备 v8
→ 校验 shape、引用图和迁移 lineage
→ export/import semantic round-trip
→ 单事务写入 v8、备份与 lineage
→ 重新读取并校验
```

任一步失败均不得覆盖当前记录。错误状态必须进入只读恢复面板，不得静默回退到演示数据或继续自动保存。

## 2. 备份与 lineage

- 备份 ID 由迁移 ID 唯一确定，格式为 `backup:<migrationId>`。
- 备份保存原始 v7 snapshot、`schemaVersion: 7`、创建时间、迁移 ID 与 `integrityHash`。
- v8 的 `migrationMetadata`、备份记录和独立 lineage 记录必须互相指向同一 migration/backup。
- 备份经过 apply、rollback 和同 lineage 重试后仍须逐值不变。
- 备份结构、哈希、lineage 或目标工作区任一被篡改，恢复必须 fail closed。
- 已迁移后发生用户编辑时，旧备份不得覆盖这些新编辑；需先导出当前工作区，再由人工决定后续恢复方案。

## 3. 用户可见恢复流程

应用发现 `recovery_required` 时：

1. 停止自动保存并显示迁移恢复面板。
2. 明确展示指定 `backupId`，要求用户先下载该备份。
3. 首次点击只进入恢复确认状态，不调用浏览器 `confirm`。
4. 第二次点击才执行恢复。
5. 从 v7 备份恢复后，用原 migration ID 重新执行迁移与全图校验。
6. 成功后恢复自动保存；失败则继续只读保护，保留备份和当前现场。

普通 JSON 导入也必须先完成大小、schema、枚举、JSON-safe 与引用图校验，随后才原子替换当前工作区。导入失败不得改变当前数据。

## 4. 回滚演练步骤

### 4.1 代码级确定性演练

```powershell
$env:TZ='UTC'
npx vitest run src/domain/v2/migration.test.ts src/domain/v2/runtimeMigration.test.ts src/domain/v2/serialization.test.ts src/domain/v2/repository.test.ts src/lib/repository.test.ts src/lib/workspaceRecoveryUi.test.ts
$env:TZ='Asia/Shanghai'
npx vitest run src/domain/v2/migration.test.ts src/domain/v2/runtimeMigration.test.ts src/domain/v2/serialization.test.ts src/domain/v2/repository.test.ts src/lib/repository.test.ts src/lib/workspaceRecoveryUi.test.ts
```

验收点：

- v7 备份先于 migration preparer 执行并独立提交；
- graph validation 失败时 v7 current record 和备份仍在；
- v7 → v8 → export → import 语义无损；
- rollback 恢复与备份 snapshot 完全相同；
- later edits、损坏备份、缺失 lineage 和非法 v7 envelope 均被拒绝；
- already-v8 不被重复迁移或重写；
- recovery UI 强制“先导出、再二次确认”。

### 4.2 Preview 浏览器演练

使用匿名合成数据，不使用真实学生材料：

1. 在 Production 基线对应的独立浏览器 profile 建立 v7 工作区，包含来源、草稿、任务、材料、提醒、课程和修改历史。
2. 导出 v7 JSON 并记录实体计数与内容哈希。
3. 在 Preview 打开同一 origin 的迁移夹具或导入受支持的 v7 JSON。
4. 刷新，确认自动迁移为 v8，核对全部实体、引用、材料状态、提醒状态与历史。
5. 导出 v8，清空，重新导入并刷新，比较 canonical JSON。
6. 注入一次迁移验证失败，确认当前 v7 未覆盖、自动保存停止、恢复面板可见。
7. 先下载指定迁移备份，再执行二次确认恢复。
8. 恢复后再次刷新，确认 v8 可读且无重复实体。

当前状态：`NOT RUN`。现已能唯一确认权威 Preview 与持久化 Edge 工作区，但完整步骤包含清空并重写匿名 QA 工作区，仍需动作时明确确认；此外还需准备受支持的匿名 v7 导入夹具。不得用单元测试、现有 v8 导出或 IAB 的无 IndexedDB 页面替代该浏览器演练。

## 5. 部署级回滚

Preview 与 Production 使用不同 Worker：

| 环境 | Worker | 路由 |
| --- | --- | --- |
| Preview | `student-affairs-manager-preview` | `workers.dev`，无 custom domain |
| Production | `student-affairs-manager` | `student-affairs.site` |

Preview 出现 P0/P1 时：

1. 停止新功能与 Production 准备。
2. 记录失败 Version ID、commit、时间、复现步骤与数据影响。
3. 在 Cloudflare 控制面把 Preview 流量回退到最近通过门禁的 Version；不得修改 Production 路由。
4. 对受影响浏览器先导出当前 JSON 和迁移备份，再验证回退版本能否读取。
5. 修复必须独立提交、完整重跑工程门禁和受影响浏览器场景，再生成新的 RC。

Production 默认不在本任务部署。若未来获得独立明确批准，回滚锚点仍为带注释标签 `v1-production-baseline` 和精确提交 `7a0af21e881dd97ee5c2247e0666a033ff53ae7e`；不得移动该标签。

## 6. 当前证据状态

| 证据 | 状态 |
| --- | --- |
| migration 单元测试 | PASS |
| runtime migration / immutable backup / lineage 测试 | PASS |
| Workspace v8 semantic round-trip | PASS |
| repository import/export 与 recovery facade | PASS |
| UTC 与 Asia/Shanghai 完整测试 | PASS |
| Preview 浏览器迁移演练 | NOT RUN |
| Cloudflare Preview Version 回退演练 | NOT RUN |
| Production 回滚 | NOT AUTHORIZED / NOT RUN |

只有 Preview 浏览器迁移演练与 Version 回退演练也通过后，最终报告才可以写 `Rollback rehearsal PASS`。
