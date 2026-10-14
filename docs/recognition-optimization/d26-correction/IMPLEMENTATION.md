# D26：实现与出处边界

2026-10-02。代码交付 `de670d59803c2c5dbfdd488559175e444662a6d2`。遵照用户修订，本轮没有把全局排期作为完成条件；不修改 PRD/AGENTS，不重新审计全仓。

| 用户场景/审计问题 | 当前发生层与修改 | 实际代码路径与证明 |
|---|---|---|
| 两页各改不同任务，后保存把先保存的新值回退（AUD-01） | 普通兼容视图保存缺少读时基线。引入三方字段比较；事务中读最新 canonical，无关联字段合并，同字段冲突返回 before/current/proposed，保留输入 | `src/lib/repository.ts`、`src/domain/v2/legacyView.ts`；双标签读回、同字段拒绝、仓储反例 |
| SourceVersion 可被旧视图重写（AUD-02） | 来源原文不可变；源变更创建新版本。正式核对在事务中核真实当前 SourceVersion | `legacyView.ts`、`sourceReviewD26.ts`；真实版本导入后旧页确认受阻，原 V1 字节不变 |
| 页面只说发送当前文本，实际上带无关摘要（AUD-05） | 默认无项目/任务上下文；选定关联范围时只传明确选择的最小字段。前端和 Worker 都校验 ID 集合/字段白名单，不接受未声明的摘要 | `deepseekExtraction.ts`、`IntakePanel.tsx`、`cloudflare/worker.mjs`；匿名假传输前后端正反例。真实上游 0 次 |
| 正式成功、读回失败被误报为未提交 | 在同一正式事务保存提交回执；独立 reader 按实体值哈希验证。已知提交后失败提示“已提交，读回尚未验证”；恢复只读，不再次提交 | `sourceReviewD26.ts`、`App.tsx`；故障注入同 commitId 读回恢复，没有重复事实 |
| S09 首次无任务却漏停机事件和时间 | 承接 C18 source-facts-3 的独立事实账目；缺事件的旧回答仍判遗漏，程序不猜补。普通页可以保存事件/资讯或从原来源人工补遗漏 | C18 原 Prompt 原样；`firstSuggestionD26.ts`、`OrdinarySourceFacts.tsx`、正式 ReviewSession/DomainCommitPlan。0 空项目、模糊时间 null |
| S06 前置要求被当作已完成 | 资格、依赖和个人完成事实保持分开。无肯定事实不写 true；前置未完成的真实后续任务继续存在，false/unknown 有独立局部阻断 | 既有 C18 生成机制；公共语义桥接和普通正式确认；两个待办保存，资格待核对/false 项不被当当前已开始事项 |
| S05 时间和实体双向关系矛盾 | 承接 C18 单向权威关联及可审计反向索引。旧冲突回答仍标错，不任选一边补正确 | C18 envelope→wire→公共 adapter；最小改对象/关系/端点反例。材料与取消/替代回归不改旧原答 |
| 正确事件加合法描述被评分为不存在 | 新 v10 分开事件存在、事实值、依据、描述支持和矛盾；有原文支持的同对象描述可通过。未被定义的自由改写保留 UNKNOWN | `scripts/d26-scoring.mjs`，旧 v7/v8/v9 不改；删除事件、错对象/时间/矛盾描述仍失败 |
| 时间 Expected 由被测 adapter 回灌 | 新源语义断言独立规定日期、时段、暂定性和精度；只机械映射 ID/scope。两个“暂定下周…上午/下午”保留已知日期和未知时刻，不变确定全天 | `d26-reference-data.mjs`、`timeSemanticsD26.ts`；8 正例/8 最小负例/8 顺序不变例，见 ROUNDTRIP_RESULTS |
| 结构正确但显示标题/说明相反 | 主摘要从结构装配，原模型文案、程序文案、用户修改分开保存。结构通过与完整首次展示判定分列；无法判断的文案不填满分 | `firstSuggestionD26.ts`、普通 App 首次展示与 v10；并非宣称原模型回答被改善 |
| Linux 字体/载体/旧私有材料阻断当前测试（AUD-10—12） | 使用既有 OFL Noto 测试字体，验证 SHA/cmap/实际中文渲染；当前产品、安全、历史分层；载体失败不吞掉独立组，TZ 到子进程；旧断言原样 | `scripts/engineering-font.mjs`、`current-checks-support.mjs`、`candidate11-checks.mjs`、CI；WSL bwrap 无网络验证。`.data` 为私有构建产物，lint 不扫描生成 bundles，源码仍全部扫描 |

## 普通路径与原件

普通 `App` → Capture（Source/Version/Run/Draft 先存）→ 待确认摘要 → 现有 ReviewSession/正式编辑器 → `DomainCommitPlanV2` 单事务 → 独立 repository reader → 回执验证。工程入口只替换传输为匿名假响应，复用以上保存路径；不是实验专用保存旁路。普通默认候选未替换。

没有截止可保存；耗时未知 canonical 为 null，不用兼容的一小时当源事实。个人计划日期单独存 planned_start，原文截止不被覆盖。正确来源一次接受，材料个人准备保持 unverified；不强迫逐材料和逐片段操作。错误关系仅阻断关联项，无关正确项可部分保存。事件关闭/刷新恢复后可直接继续保存，无需改字解锁。

## 尚未被证明/不扩大承诺

- RecognitionResult 2.0 原生字段不足以表达全部条件、当前生命周期、修订关系和事件关联。无损 sidecar 保留原语义、首次语义、原答和转换；正式任务保存有局部阻断证据。它不是原生 Schema 全语义等价，不能声称所有关联已经成为原生可编辑正式事实。
- C17/C18 Prompt 本轮逐字保留；新增的是公共时间/显示装配、v10 参照/评分、普通接线。没有 Candidate19，没有新模型输出。8 构造正例能通过，只证明工程契约，不证明识别率提高。
- D25 的 48 份旧回答诊断及 D19 read-only verify 保持。D26 不把其旧分数重新包装为新成绩；D17 原 1/12、2/12、MIXED_PROGRESS 不改。
- 工程假响应不验证普通默认在线候选质量、延迟或泛化。四项真人指标没有真人资料，均 NOT_OBSERVABLE。
- 全局计划器未实现。本轮已保留截止、固定事件、依赖、个人状态、时长来源接口；下一阶段可直接做最小安排，不以新招募/平台配置为开发总门。
- D26 执行器离线核心具备锁、身份/费用验证、一次发送和不确定停发；真实 D25 宿主桥接尚须绑定新批并验证。无授权时 CLI 机械拒绝，没有默认真实 transport、Secret loader 或账本写路径。
