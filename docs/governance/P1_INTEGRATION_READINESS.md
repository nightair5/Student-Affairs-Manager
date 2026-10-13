# P1 集成准备：有限代码核验

核验基线：`codex/e2-candidate11-blind-eval` / `4f6542319479af611a86dd16a8ec9110fd62de00`。本文件只记录代码与 Git 差异，未操作旧用户库、合并、部署或迁移目录。当前首次建议修复优先，集成仍待负责人决策。

## 分支差异与回带范围

本地集成线 `feature/student-affairs-mvp` 为 `7a0af21`，开发线相对它领先 396、落后 0；本地发布线 `release/v2-beta` 为 `6eb7864`，开发线相对它领先 359、落后 10。这些是本次核验快照，后续集成前重新核实际 refs。

发布线独有 10 个提交全部是 `docs(release)`，只触达 `docs/release/v2-beta/` 下的 `FINAL_RELEASE_REPORT.md`、`MIGRATION_ROLLBACK.md`、`QA_ACCEPTANCE.md`、`RELEASE_NOTES.md`、`RELEASE_SCOPE.md`。未来回带时按文档事实与日期逐文件审查冲突，保留生产观察历史；不能把这 10 个提交当作遗漏产品功能或由文档推出当前线上代码状态。

## 普通产品的实验目录依赖

`src/App.tsx` 直接依赖 `experiments/mainline02/runtime` 的类型及 `assertMainlineRuntime`，普通默认路径不传入该实验 runtime；它还直接使用 `experiments/candidate16/d20ReviewSession`，普通核对的默认实例实际依赖此类。

后者依赖 `mainline04/semanticContract` 的 `stableJson`；前者连接 `taskDateView`、`reviewAdapter`、`mainline03/seenReplay` 和 `recognitionHandoff` 等模块。正式目录收敛前应按普通核对必需能力与隔离回放能力划界，保留字段 CAS、来源身份检查、原子提交和已有测试。本轮没有移动文件或建立平行保存链。

## 数据兼容：VERIFY_BEFORE_MERGE

两线代码使用同名数据库 `student-affairs-steward`、store `workspace`、record key `current` 和 IndexedDB 版本 1；这只是存储定位一致，不能证明 Workspace v8 的语义和枚举双向兼容。

开发线 `MaterialStatus` 新增 `unverified`，仅通过版本化材料核对审计守卫接受；发布线材料状态校验不接受该枚举。开发线普通兼容视图保存还增加读基线、保存串行队列及重基处理。上述差异均需匿名夹具验证，不能直接用线上旧库试验。

最小待验证项：

- 从发布线代码契约建立匿名 v8 夹具，经当前 Repository 加载、保存、导出、重新加载，逐项核对事实、关系、来源与未确认状态。
- 若承诺可回退，验证开发线新增状态及审计元数据在发布线下的拒绝/保留行为，并明确需要恢复哪个备份或兼容导出。不能声称相同 v8 可直接回退。
- 合并前验证实际当前构建的普通输入、部分确认、逐事件处置、事务失败恢复、刷新与独立读回，保留用户数据冲突检查。

这些兼容夹具本轮尚未执行，状态为 `VERIFY_BEFORE_MERGE`。

## 未来集成决策与回退点

建议在负责人授权后从实际 `feature/student-affairs-mvp` 建立集成分支，先固定基线与可恢复备份，再引入已经验收的产品/转换改动、必要安全检查及证据索引，最后审查发布线文档回带。预期冲突集中在 App、识别契约、普通核对与 Repository；不采用未经审查的大批 cherry-pick 或目录搬迁。

集成前必须通过当前产品与安全检查、构建、适用安全扫描、匿名 v8 兼容验证及实际浏览器闭环。历史测试保持独立可跑并报告真实失败；默认测试绿色不等于历史、完整 CI 或发布资格全部通过。未授权删除任何 worktree，本文件也不授权合并或部署。
