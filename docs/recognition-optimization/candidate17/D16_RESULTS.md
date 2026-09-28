# D16 一体化结果：定向修复、确认恢复与零调用新比较

日期：2026-09-28。分支 `codex/e2-candidate11-blind-eval`。本包没有新增业务模型请求、grant、reserve、settle 或真人试次；D15 已耗尽的授权不复用。Candidate17 的效果**尚未测出**，D15 的 Candidate16 `NEEDS_TARGETED_FIXES` 结论不变。

## 用户能得到的变化

Candidate17 是独立 Prompt 版本 `recognition-prompt-candidate17-1.0.0`。[三项逐层根因追踪](ROOT_CAUSE_TRACE.md)列出原文义务、原始回答、adapter、v7 判错与保存影响。针对 D15 的 S10，明确要求取消/替代关系的旧、新端点都是真实存在的任务 ID；不能以 `tasks=[]` 同时引用虚构的旧任务。针对 S02，材料和格式按直接支持的原文 scope 归属，上传截止不再写成笼统任务截止，也不能无依据连到材料。针对 S11，纯取消的旧任务与被替代的旧任务分清 `cancelled` 和 `superseded`，新事项材料不得漏。否定、false 条件不变当前任务，unknown 条件保留待核对，模糊时间不猜具体时刻。以上是**Prompt 规则与离线契约**；没有新模型回答，因此不能报告识别率提升。原始模型输出仍由旧安全链校验，坏引用会阻断相关保存，不凭空补答案。

D15 页面里“先确认事件再确认任务”会令任务编辑持有旧版本。D16 增加版本提示和“载入最新来源（保留未保存输入）”。如果只是无关事件变化，用户重新核对后可继续；如果本任务或关联材料/时间/修订已经变了，则停止覆盖并要求对照原文重新编辑。该机制不自动合并、不静默覆盖。实际浏览器 p5 复现无编辑缓冲的旧版本错误并成功重载确认；p6 复现**有未保存动作字段**的旧版本错误，编辑文本保留、手动明确继续后才保存，注入一次保存失败也可手动重试。仍需用户多点“载入最新来源”和“已对照原文”，不会自动吞掉冲突。

## 实际工程证据和限制

[浏览器证据](BROWSER_EVIDENCE.md)记录了 p5 的正式补任务、两个独立事件、精确和模糊起止时间、确认、独立读回与刷新；Task 1 / Project 0 / Event 2 / TimePoint 4。p6 新身份/端口开始为空库 0/0/0/0，之后在独立试次中完成未保存编辑的版本恢复和失败重试，读回 1/0/1/0，证明正式事实未串库。原模型回答、人工补录、用户核对记录分开。D16 本轮没有重新浏览器演练错误修订、局部确认和拒绝多余任务，它们继续引用 D15 历史证据，不能说在新构建上再次通过。浏览器入口仍沿用 D15 工程 UI 文案，所用端口和数据库身份为新建；没有触碰旧入口或用户库。

测量继续用 measurement 3.2 的“零实质修改”与探索 low-edit-v2（≤2 字段、≤30 秒主动编辑、无结构改动）并列，字段/editId/commitId/readback 链和缺失处理不改。定向测试验证了仅阅读、未闭合区间和缺读回不会被填成成功或 0；工程回放只标 `ENGINEERING_REPLAY`。四项**真人**指标——首次整份建议正确率、正确处置率、低修改正确处置率、主动修改时间——全部 `NOT_OBSERVABLE`，真实参与者/同意/负责人裁决均为 0。D15 的已见合成首次整份 2/12 与 3/12 只是旧候选开发数据，不能转记为 Candidate17 或真人改善。

## 新比较的可审查边界

[D16 Manifest](d16-development/MANIFEST.json)、[12 份新写来源](d16-development/SOURCES.json)、[结构化参照](d16-development/REFERENCES.json)、[往返结果](d16-development/ROUNDTRIP_RESULTS.json)、[相似度记录](d16-development/SIMILARITY_CHECK.json)、[预注册](d16-development/PRE_REGISTRATION.json)和[24 身份](d16-development/PREPARED_REQUEST_IDENTITIES.json)已经生成。来源是**新写文本、D13 结构模板衍生**，全部标 `single-author/model-assisted/provisional`，不是独立人工真值或未见 Holdout；12/12 通过真实 Schema→公共 adapter→冻结 v7 评分器正负往返。历史语料和教学 Prompt/夹具的四字片段重合上限由冻结文件逐份报告。12×2 配对为 6 组 AB、6 组 BA，所有身份 `dispatchAuthorized=false`、`NOT_RUN`，请求不含 Expected。冻结守卫机械拒绝未授权派发及字节/身份漂移。

未来同口径比较报告整份正确、逐源胜平负、FN/无据新增、错误时间/材料/修订、Schema/引用/Severe/Forbidden 和未裁决项；风险退步不能被总分抵消。若用户另行授权，必须在第一次调用前重核已提交 HEAD、上述 Manifest/身份 SHA、官方价格、权威账本完整链和最坏费用，再以新 grant 执行一次发送/零重试。独立 Holdout、真人试用、默认候选替换、合并和部署仍未授权。

[预算草案](FUTURE_BUDGET_CARD.md)与[验证记录](VALIDATION.md)分列本轮新增通过和历史/依赖问题。
