# RCO-5-MAINLINE-01：链路建立，验收未通过

状态：`ISOLATED_CHAIN_ESTABLISHED / ACCEPTANCE_FAIL / NO_PROMOTION`。

模型识别准确率：**本轮未测量**。识别模型/外部识别请求/verifier/Repair/retry/API Key访问/费用全部0。没有新盲测、B10、真人研究、RCO-6、稳定接入或部署。

## 推进了哪一环

本轮证实“正确人工响应能否被承接”，把模型能力与产品承接能力分开。新增独立工程入口，复用真实来源捕获、契约校验、草稿投影、DraftReviewPanel、领域确认、CanonicalWorkspaceRepository；浏览器使用新建测试IndexedDB，单元测试使用真实MemoryWorkspaceRecordStore。

没有替换线上识别器、修改冻结研究组件或绕过公共组件修复。App主入口和网络识别未挂载；确认按钮回调是测试编排，不冒充完整App验收。新增文件仅由测试/隔离入口导入。

## 测量结果与分母

| 检查 | 数字 | 解释 |
|---|---|---|
| 人工通知场景 | 8 | 多任务、无日期、模糊时间、纯信息、条件真/假/未知、旧要求作废 |
| 来源保留/可构造人工响应→持久草稿 | 8/8来源保留；7/7响应完整相等 | 另1例unknown无法表达，显式失败，不改成false；是传输保真，不是语义正确率 |
| 明确人工selected状态经投影 | 7/7一致 | unknown无响应、无正式写入；错误额外默认勾选0，不能推广到不可信模型响应 |
| 双任务关键字段：直接领域控制臂 | 42/42，100% | 不带客户端编辑投影，不等于真实产品通过 |
| 同一响应：客户端投影→领域确认 | **40/42，95.24%** | 两个rawText被标准日期覆盖；完整案例0/1，未达100% |
| 定向机制测试 | 17/17 | 含1个明确命名的诊断复现，17通过不表示产品验收通过 |
| 真实组件+隔离IndexedDB | 1场景、7步 | 逐项确认→重复确认→刷新→工程编辑→剩余确认→事务失败读回 |
| 不确认正式写入/重复创建/已确认任务覆盖 | 0/0/0 | 仅限这些人工工程场景；原文和记录丢失0，但字段改写2，不能笼统说丢失全为0 |
| 真人编辑时间/模型正确率/单位成功成本 | 未测量/未测量/不适用 | 测量方案已设计，没有采集真人数据 |

完整字段对照：`FIDELITY_OBSERVATION.json`。浏览器逐步观察：`BROWSER_OBSERVATION.md`。独立审查解除新夹具unknown降格问题，允许提交失败诊断，不允许产品晋级。

工程门：lint、app/node类型、Schema/时间生成物只读检查通过；全量Vitest850 passed/1 live OCR skipped，6组适配器66 passed，合计916 passed/1 skipped/0 failed。Vite独立临时构建通过，源码/现有产物扫描通过，新构建扫描及实验入口排除检查通过，npm audit 0漏洞。保留已有>500 kB chunk警告和隔离browser.tsx无导出的Fast Refresh警告（0 lint错误，不进入生产包）。使用禁用.env/旧缓存的等价命令，未运行带Wrangler凭证链的cloudflare:check；不是发布阶段，也未部署。详细结果及长日志目录见ENGINEERING_CHECKS.json；未把其他时区CI、性能或浏览器矩阵算作本机通过。

保护核验：644/644个非本轮可改原tracked文件SHA-256不变，本日志原内容前缀字节不变。旧Expected/freeze/dataset/checkpoint、冻结组件/契约、历史runner/result均在原文件保护范围；历史缓存未被调用、清理或重写。新工程日志、构建及npm审计缓存使用新临时目录，不占用旧实验缓存。提交/推送状态以Git及最终答复为准。

## 一个主根因：显示值被当成修改指令

`selectionFromDraftItems`把所有suggestion都放进`taskOverrides`；`buildDomainCommitPlan`只要看到可用deadline就设置覆盖，即使用户没有改过。canonical时间的rawText随后也被写成标准值。绕过客户端投影时42/42，经相同产品投影后40/42，浏览器也出现同样两处变化，故不是模型错或评分器猜测。

这是“来源事实、显示投影和用户编辑”没有在确认边界彻底区分。当前只记录，不修改domainCommit、schema或App。未通过新增适配隐藏这个失败。独立审查后仅做1轮夹具表达纠正：unknown不再硬填false，而是明确失败并保留原文，仍纳入8例总分母。

## 其他边界，不扩散修复

- **无日期与模糊日期混淆**：领域层可保存无日期任务（0假时间）；App.tsx单项/批量确认却统一要求有效deadline（约937/976行）。这是静态追踪结论，未冒充App浏览器复现。无日期不应逼用户编造日期；模糊时间应保留待核对。
- **条件/作废关系不可完整结构化表达**：RecognitionResult 2.0只有boolean requiresAction，任务无独立conditionState/revision关系，v8没有对应任务条件边。unknown案例返回UNREPRESENTABLE_CONDITION_STATE，真实捕获服务保留Source并标记失败草稿，不能用false冒充未知。其余人工选中与conflict/description文字可原样保留，但不能说语义状态、作废生效链已受完整契约保护。冻结的新研究候选同样未接产品，本轮不修改、不注入旁路新语义字段。
- **预览数量与实际确认范围不一致**：剩余一任务时仍计入已确认时间。详见浏览器观察。
- 本轮没有测试OCR、图片/PDF直接理解、事件全矩阵、24,000字云端截断、服务失败重试或真人速度；这些不能据本报告宣称通过。
- 使用新人工工程夹具，没有读旧付费checkpoint/result，未运行历史一次性runner。已有历史结果不必重复回放才能定位本轮产品边界。

## 最小后续授权建议（不是自动执行）

先申请`RCO-5-MAINLINE-01-P1`：在独立的新版本确认适配/组件中，显式区分未编辑值与用户修改；来源rawText不可被修改值覆盖，编辑保存到规范化值与修改记录；无日期和模糊日期分别处理；用本轮已见夹具复现并要求客户端路径42/42、错误默认与未确认写入/重复/覆盖0。若必须改现有公共路径或已冻结组件，先列明文件范围、隔离开关及版本策略另行授权，不能用本建议解冻旧文件。

先解决这一个确认边界主因，再申请MAINLINE-02的条件/修订表达方案。暂不申请模型盲测；即使模型100%理解，当前确认边界仍会改写字段。P1无需新数据、模型或部署。本次交付后停止。

## 重现方式（均为零识别模型调用）

```powershell
node node_modules/vitest/vitest.mjs run src/experiments/mainline01 --config scripts/mainline-01.vitest.config.mts --reporter=dot
node scripts/diagnose-mainline-01.mjs
node scripts/serve-mainline-01.mjs
```

第三条只启动回环内存服务器；打开返回的随机URL会使用新的明确前缀测试库。关闭服务器不删除数据库。不得将其用作生产或真实用户材料入口。计时接入仅设计见`MEASUREMENT_DESIGN.md`。
