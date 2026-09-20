# 开源识别方法与 candidate10 配对开发评测

日期：2026-09-20。离线候选起点：00330d91f53503a07b6adf3eb21238a3dc3792a9。付费评测冻结 HEAD：9c9460dafef511a922938ce012ae4874070a67e1。

## 结论

在本轮 12 份单作者、匿名、合成开发通知的 24 次同期配对中，candidate10 完整教学包更适合作为修正后进入下一轮独立盲测的路线。原冻结评分器给出 B 12/12、A 10/12；独立逐例审计发现评分器漏掉 B 在 OS04 的一处真实回归，也漏掉 A 在 OS10 的一处错误。按明确参照级错误重判，B 为 11/12、A 为 9/12，配对为 B 3 胜、A 1 胜、8 平。冻结评分器输出的 precision/recall 因关键词匹配和非一对一计数漏洞，不能作为严格任务准确率。

这项结论只证明 candidate10 完整教学包在相近结构的开发集上对两类已知错误有净改善，同时引入一处新的语义过度推断。该包同时改变可见版本标记、追加 3 段防复制/核对元指令并加入 8 个正反例；本轮不能把收益单独归因于示例。开发例与教学例由同一实施者编写，参照不是独立人审，评测也不是未见盲测。真实用户“接受并保存”转化率仍为 `NOT OBSERVABLE`；candidate10 状态为 `REQUIRES_FIX_BEFORE_INDEPENDENT_BLIND_EVALUATION`，没有接入 Preview 或 Production，也没有替换当前 candidate03。

## 问题与开源方法取舍

历史证据把主要问题定位到材料属性、任务动作、条件真假、依赖和否定时间之间的语义边界，而不是文字提取失败。本轮使用 GitHub 官方仓库和官方文档调研，未把论坛意见当作效果证据，也未安装第三方依赖。

| 项目与官方来源 | 许可 | 与本产品的关系 | 本轮决定 |
| --- | --- | --- | --- |
| [DSPy](https://github.com/stanfordnlp/dspy)，[LabeledFewShot](https://github.com/stanfordnlp/dspy/blob/main/dspy/teleprompt/vanilla.py) | MIT | 用固定标注示例明确边界；自动优化仍需独立评估 | 借鉴固定示例方法，用现有 TypeScript 请求构建器实现；未运行 MIPRO/GEPA |
| [LangExtract](https://github.com/google/langextract) | Apache-2.0 | 原文跨度对齐便于核对，但对齐不证明语义正确 | 沿用现有原文索引和引用校验 |
| [Instructor](https://github.com/567-labs/instructor) | MIT | 结构校验、类型约束、重试 | 沿用现有结构契约；不增加重试，不把 JSON 合法当作语义正确 |
| [Docling](https://github.com/docling-project/docling) | MIT 代码，模型许可逐项核对 | 本地 PDF 布局和阅读顺序解析 | 仅在后续证据表明损失集中于文件解析时单独评测 |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | Apache-2.0 | 中文 OCR 候选 | 不能修复已正确提取文字后的语义错误，本轮不引入 |

## 实验设计

- A 臂：`deepseek-flash`、candidate03、reasoning none、temperature 0、8192 输出上限。
- B 臂：同一模型和参数、同一用户正文、scope、Schema、referenceTime 和本机后处理；system prompt 使用 candidate10 完整教学包，包括新版本标记、3 段防复制/核对元指令和 8 个原创固定教学正反例。
- 12 个来源各跑 A/B 一次；6 对 A 先、6 对 B 先。参照保存在独立文件中，不进入模型请求。
- 请求在调用前冻结并绑定 SHA-256；失败不重试。原始 HTTP 响应、适配结果、usage 和统一账本逐次写入。
- 用户明确授权 24 次调用，把累计上限从 290 扩展到 314；累计 20 元硬上限不变。只发送匿名合成文字，没有真实学生材料。

冻结证据见 `prepared/`、`BINDING_FINAL.json`、`SEND_REVIEW_MODEL.json` 和 `BILLING_MODEL.json`。评分器 `scripts/score-contrastive-recognition.mjs` 在调用前提交并绑定到每个单元，检查任务数量与关键词匹配、部分材料归属、依赖、条件、否定时间、修订关系和共享材料；它不是完整语义等价判定器。

## 配对结果

| 指标 | candidate03 A | candidate10 B | 差异 |
| --- | ---: | ---: | ---: |
| 完整通过来源 | 10/12（83.33%） | 12/12（100%） | +16.67 个百分点 |
| 检查项 | 55/61（90.16%） | 61/61（100%） | +9.84 个百分点 |
| 冻结关键词 precision（仅诊断） | 83.33% | 100% | +16.67 个百分点 |
| 冻结关键词 recall（仅诊断） | 93.75% | 100% | +6.25 个百分点 |
| 冻结评分器报告的意外任务 | 1 | 0 | -1；存在低估 |
| 配对胜/平/负 | 0/10/2 | 2/10/0 | 原冻结结果；审计后推翻 |

上表是不可改写的预冻结评分器原始结果，其中“B 无退化”已被后续独立审计推翻。按审计确认的明确参照级错误，A 为 9/12、B 为 11/12，B/A/平为 3/1/8；这是一项响应后的审计重判，不是预注册指标，也不应与上表混合冒充原始评分。

candidate03 的两项失败均由未改动的预冻结评分规则检出：

1. OS07：原文明确条件为假。A 同时生成“领取实验钥匙”和“不领取实验钥匙”两个任务，并把领取任务保持为 active/pending；B 只保留一个不可执行的领取要求。
2. OS08：原文要求保存凭证，明确“无需今天交回，交回日期待通知”。A 多造“交回凭证”任务并把否定语境中的“今天”归一化为截止日期；B 只保留保存任务，把待通知日期保留为未绑定、待确认时间信息。
3. OS10：A 把已经生效的“上传替代邮寄”修订标成 `effective=unknown`；B 正确保留为 `true`。冻结规则只检查 revision 是否存在，漏掉该差异。

candidate10 的明确回归出现在 OS04：任务是“核验数据授权书”，原文没有要求核验结果必须通过；B 的 completionCriteria 写成“数据授权书核验通过”，把完成核验偷换成必须通过。A 写的是“核验完成”。冻结规则只检查后续公开任务的 condition 为 unknown 和核验任务尚未 completed，漏掉了 completionCriteria 的过度推断。

详细逐例分数与原始结果见 `MODEL_COMPARISON.json` 和 24 组 `Kxx-X_RAW.jsonl` / `Kxx-X_RESULT.json`。

## 独立审计发现的评分与重放限制

- 冻结评分器把 action、object、title、description 拼接后做子串匹配，也没有对 expected 与 predicted 做一对一分配。K07-A 已出现 `expected=1 / predicted=2 / matched=0 / unexpected=0` 的内部矛盾，所以顶层 precision、recall 和 falsePositiveTasks 只能保留为原始诊断值。
- 部分逐例规则漏检：OS09 没有严格验证“上午十点”，OS10 只检查存在 revision 而没有验证端点，OS12 只检查两个不同时间 ID 而没有验证 10 月 9 日/11 日；通用检查也没有对所有任务统一要求 active/pending/affirmative。
- 审计者直接对照冻结参照复核 24 份实际结果，确认 B 的 OS04 存在上述回归；OS07–OS12 未发现其他 B 臂参照级错误，OS09 的具体日期时间、OS10 的替代关系端点和 OS12 的两项日期均正确。这个复核发生在响应之后，只能作为审计补充，不能替代独立盲测。
- 官方 `--analyze` 仍依赖发送期 billing 有效时窗并以 `wx` 写结果，过期或结果已存在后不能幂等重放。独立审计通过冻结 scorer 直接复算，确认现有 `MODEL_COMPARISON.json` 算术一致；后续应增加不依赖 billing、只读且幂等的 `--verify-analysis`。
- 本批实际成功路径可达且 24/24 完成；contrastive 专门测试未覆盖 transport failure、raw storage failure、settlement failure 和 timeout。历史网关回归覆盖通用失败保护，但不能冒充本轮 K 路径逐分支实证。
- `exampleVersion` 在 binding 中硬编码，没有从 prepared row 贯通；当前值与 prompt 和依赖哈希一致，未来须从候选输出持久化并校验。
- 冻结 `BINDING_FINAL.json` 中“仅固定教学正反例不同”的标签过强，不能事后改写冻结证据；本报告将因果范围纠正为 candidate10 完整教学包。

## 时延、Token 与费用

| 指标 | candidate03 A | candidate10 B |
| --- | ---: | ---: |
| 中位等待 | 5.207 秒 | 4.937 秒 |
| 输入 tokens | 50,692 | 61,132 |
| 输出 tokens | 10,253 | 9,211 |
| 本批费用上界 | 0.183408 元 | 0.195952 元 |

candidate10 输入增加 10,440 tokens，本批费用上界增加 0.012544 元（约 6.84%）。小样本中 B 的中位等待少 0.270 秒，不能据此声称固定示例提速。24 次合计费用上界 0.379360 元；全账本累计 314 次、费用权威上界 14.042543 元，包含历史未知调用预留。服务商实际扣费为 `NOT OBSERVABLE`。

24/24 均为 HTTP 200、可解析、usage 已结算；账本现 644 行并有 644 份独立收据。没有重试、Repair、verifier 或额外模型调用。

## 运行异常与处置

- 隔离预算集成测试最初误用了真实收据目录，产生一份未写入账本的测试收据。发现后核验其精确路径、序号和测试绑定，删除该单个测试文件；随后账本保持 595 行、收据恢复 595 份、原 SHA-256 不变。测试改为重建完整临时账本与收据链后通过。
- 正式调用前两次调度分别因冻结字段名和网关请求范围错误在网络发送与预留前失败；两次均核验账本 595 行、收据 595 份、raw/result 为 0。修复均单独提交、推送和重新冻结后才开始调用。
- 一次 `node -e` 只读导入检查因没有 `process.argv[1]` 失败；没有网络、账本或结果变更。正式 CLI 与测试入口正常。

这些失败不计为模型样本，也没有被改写为成功。

## 路线判断与下一门槛

就本轮“通知文字已经可读，如何减少任务语义误转”的问题，优先方向仍是 candidate10 的完整、可审计教学包，而不是增加 reasoning effort、切换更昂贵模型，或引入 OCR/PDF 解析服务。它修复 OS07、OS08，并在 OS10 更准确，但在 OS04 引入“核验完成＝核验通过”的新错误。增量费用很小，且不改变 Schema、确认流程或本地确定性后处理；现版本不能直接采用。

下一步应先为“核验动作完成不等于核验结果通过”增加离线回归门槛，并把版本标记、元指令和示例拆开消融；随后冻结一组由另一位标注者制作、与 8 个教学例结构不同的未见 Holdout，保留 candidate03/修正版同期配对。只有独立盲测继续显示净收益、没有过度抑制合法任务，且真实产品埋点能区分“建议生成 → 用户接受/修改 → 正式保存”，才能讨论 Preview 试用。当前评测不授权 Production，也不能把冻结开发集分数写成真实识别转化率。

## 验证

- 新增对照预算、网关、运行器和评分器专门测试：4/4 通过。
- 历史预算与网关回归：124/124 通过。
- 完整 `npm test` 的 Vitest 首轮为 1393 通过、1 个默认 5 秒超时、1 跳过；同一 A02 用例不改断言、提高到 30 秒门槛后 0.952 秒通过。后续 server 8/8、Worker 25/25、时间与评估库 24/24、Functions 5/5 通过。
- `npm run lint`：0 错误、4 个既有警告；`npm run typecheck`、`npm run build`、`npm run security:scan` 通过。
- 构建保留既有大 chunk 警告；历史 `RCO-5-007` 的旧 package-lock 冻结哈希失败仍未修改，因此不声称整个历史测试集全绿或达到发布门槛。
- 既有 `.env` 由运行器按服务端路径加载，内容未人工读取、输出或提交。没有安装依赖，没有 Preview/Production 部署。
- 新鲜同系列模型只读实验审计为 A PASS、B FAIL、C PASS、D FAIL、E FAIL、F PASS，总体严格审计 FAIL；详见 `EXPERIMENT_AUDIT.md`。该审计不是独立人工审计，只能视为 provisional。

本轮基础设施提交为 `8e83b22`、`32159d1`、`9442dbd`、`c104b17`、`9c9460d`，均已推送；最终结果与审计文档以本目录证据和最终交付提交为准。
