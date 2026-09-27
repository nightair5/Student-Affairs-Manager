# D8 W1—W3 工程结果与停止点

日期：2026-09-27。性质：已见匿名合成 Development 的**零业务模型调用工程修复**。Candidate15 是独立实验候选，默认 Candidate03、D7 冻结组件及历史 D6 结果均未替换。状态：`W1_W2_ENGINEERING_DELIVERED_W3_WAITING_FOR_COMPLETE_REFERENCES`；不具备新派发资格，也未证明识别正确率提高。

## W1：语义、参照与评分

- Prompt 版本 `recognition-prompt-candidate15-1.0.0`：无当前任务的来源，其事件、时间、地点和背景 scope 统一进入 `informationScopeIds`；取消/禁止/旧要求不产生当前任务；包装格式与完成标准分开；待公布日期不能假装确定截止。模型、Schema、公共 adapter、timePolicy 和默认候选均不变。
- 参照版本 `candidate15-reference-contract-6.0.0`、评分版本 `candidate15-scoring-6.0.0`。无任务事件时间按 `type / normalizedValue / timezone / precision / isAllDay / needsConfirmation` 逐项与参照比较，并核对事件 start/end 关联、来源 scope。`partial` 参照明确不可产生整份正确分数。旧 v5.5、R4/R5 文件和历史判定保留。
- 新匿名工程例实际走 `Schema → 公共 adapter → v6 参照 → scorer`：合法无任务事件可完整通过；上述六个时间字段逐一改错、起止关联改错和信息 scope 漏掉均不能再满分；false 条件任务保持非 actionable。此证据只证明这些反例，不代表 12 类来源都有完整真值。
- 仍未完整表达/裁决：例如“确切日期稍后公布”在当前 wire 的任务截止语义、格式与办结标准之间的逐来源边界。完整语义对应表见 [SEMANTIC_TRACE](SEMANTIC_TRACE.md)。必须在新正式 Development 前逐来源解决或明示部分参照。

## W2：真实组件确认与测量工程

- 使用现有 App、ReviewPanel、SemanticRepository 和 canonical v8 确认链路，在独立 `127.0.0.1:6635/?automation=1` 与独立 IndexedDB `rco-mainline-01-02-i1-real-input-candidate15-d8-engineering-1` 回放 D6 已结算的 24 条录制回答。入口拒绝新模型调用、非白名单网络和旧库名。页面明确标为“工程回放 / 录制结果 / 非真人试用”。
- 浏览器实际操作：S01 打开原文和依据，标题修改遇注入写入失败后显式重试成功、刷新可恢复；S02 两事项逐项核对材料，确认其中 1 项后另一项仍待核对；S12 原文无截止，核对后可建立无日期任务。S09 原答误出 3 项，逐项“记录不需要”后没有新增正式任务，但这不证明**正确无任务归档**已走通。最后一次独立读回显示 **2 个正式任务、4 个草稿、20 条工程事件、58 条计时事件**；刷新后首页仍能看到已确认任务和待确认队列。浏览器控制台 error/warn 为 0。上述数字是该隔离浏览器的测试状态，不是样本成绩；浏览器提供匿名 JSON 导出控件，但自动下载没有成功取得磁盘证据。
- 测量 v3 把阅读、编辑、等待、隐藏、空闲和墙钟分桶；输入产生字段编辑事件，`editId` 显式映射到保存 `commitId`，多字段共一次保存仍保留各自操作。缺映射、刷新时钟断档或未闭合区间报缺失，不填 0；已发生的编辑在失败/超时后保留。`HUMAN_TRIAL` 在此入口不可注册，工程记录从真人聚合排除。旧 2.4 只读诊断仍复现“读 10 秒计为改 10 秒”及批量漏记，冻结旧文件不改。口径详见 [MEASUREMENT_CONTRACT_V3](MEASUREMENT_CONTRACT_V3.md)。
- 尚未验收：真正**纯信息/独立事件**无任务处置在本 D8 入口的页面闭环；所有事实字段的 UI 类型捕获、页面隐藏/系统等待事件和刷新后的跨段精确耗时。当前四项真人主指标全部 `NOT_OBSERVABLE`，不能从 58 条自动化事件推断用户省时。

## W3：新 Development 零调用包

- [SOURCES](SOURCES.json) 为 D5 的 12 份**完全已见**匿名合成来源，不是新 Holdout；参照作者背景如实为单作者/模型辅助，不冒充独立人工。新 [MANIFEST](MANIFEST.json) 记录 12×2 计划、6 组 AB/6 组 BA、固定非候选参数、组件哈希、失败留在分母和事先晋级门槛。两臂是 Candidate03 与 Candidate15 的**整包比较**，不作单变量因果归因。
- [REFERENCES](REFERENCES.json) 当前 0/12 份 v6 完整参照；逐来源合法 wire 与关键变异尚未完成。故**实际请求身份 0/24**，`dispatchAuthorized=false`，`NOT_RUN`，没有 grant、reserve、settle、账本写入或业务模型调用。不能复用 D7 R4/R5 已失效身份，也不能为了凑 24 个身份跳过参照。
- 已预注册门槛：24 单元都有确定结局、两臂各 12/12 Schema/引用有效、新候选 Severe/Forbidden/教学例泄漏为 0、任务 FN 与关键字段 Major 不增加、整份正确至少净增 2。任一不满足则拒绝开发晋级；这还不是独立质量或真人效用结论。
- [预算卡](FUTURE_BUDGET_CARD_DRAFT.md) 仅草案。正式派发需先补 12 份 v6 可评分参照及正反例、冻结 24 身份与请求哈希、重核官方价和权威账本、制定可信最坏费用并取得**新的**模型调用授权。旧 D6 许可已用完。

## 验证与保护

定向：`node --test scripts/candidate15-contract.node-test.mjs` **5/5 通过**；`npx vitest run src/experiments/candidate15/measurement.test.ts src/experiments/candidate15/uiMeasurement.test.ts` **7/7 通过**。`npm run typecheck`、`npm run build`、`npm run security:scan`、`node scripts/verify-governance-protection.mjs`、`node scripts/prepare-candidate15-d8.mjs --verify` 通过。`npm run lint` 零错误、8 条 warning（含本轮 D8 Runtime 的 Fast Refresh 提示）。

完整 `npm run test` 为 **1476 通过、2 失败、1 跳过**，因此整条命令不记通过：旧 U01-09 浏览器外回放用例在全量负载下越过默认 5 秒，单独复跑 1.3 秒通过；既有 candidate02 launcher 测试因 `REAL_INPUT_CARRIERS_MANIFEST` 未定义失败。因 Vitest 停止后续串行步骤，服务端 8/8、Worker 25/25、时间 AST 1/1、multimodal 库 23/23、Functions 5/5 已单独运行通过；历史 `RCO-5-007` 仍为 3/4，失败 `FREEZE_HASH_MISMATCH:package-lock.json`。旧断言与旧锁未改。最终提交 SHA 以本次交付答复为准。

治理保护检查只读通过：82 份旧文件原位不变、2 份旧根文档在存档、2 份现行根文档一致、14 个 D7 冻结组件不变；旧 84 原位检查预期在根 PRD/AGENTS 两文档失败。权威账本本次只读为 791 行、694807 字节、SHA-256 `efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`。
