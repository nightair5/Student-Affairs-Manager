# D15 一体化交付：真实冻结比较与确认闭环

日期：2026-09-28。工作区为 `codex/e2-candidate11-blind-eval` 独立支线。机器可复算的逐单元结果见 [SCORING_RESULTS.json](SCORING_RESULTS.json)，浏览器与隔离库见 [BROWSER_EVIDENCE.md](BROWSER_EVIDENCE.md)，验证见 [VALIDATION.md](VALIDATION.md)。本包没有改 D13 的来源、Expected、请求身份、v7 评分器或旧 D11 决定。

## 产品决策先说清楚

**Candidate16 在已见合成 Development 的整份正确数从 Candidate03 的 2/12 提到 3/12，但本批结论是 `NEEDS_TARGETED_FIXES`。** 它在纯信息 S04 和 S07 各多做对一份，同时 S02 从 Candidate03 的整份正确退步为严重错误；S10 还产生指向不存在旧任务的修订引用，引用校验失败。因此不能称候选已通过开发筛选，更不能替换默认候选。这里执行的是 D13 预注册规则，不是 D11 的旧“净增 2”门槛。D11 对 Candidate15 的拒绝保持原样。

24 个冻结身份按 ordinal 各发送一次，24/24 已结算，0 重试、0 repair、0 verifier、0 不确定。两臂各 12 次 HTTP 200、解析和 Schema 有效；Candidate03 引用 12/12 有效，Candidate16 11/12。整份正确的分母固定为每臂 12；S10 记为未整份正确，但其语义字段**未评分**，不能把缺测填成零错误。

| 已见 Development 口径 | Candidate03 | Candidate16 | 可作出的判断 |
|---|---:|---:|---|
| 首次整份正确 | 2/12（16.7%） | 3/12（25.0%） | 净增 1 份，且有回退和无效引用 |
| 引用有效 / 可语义评分 | 12/12 | 11/12 | C16 的 S10 未进入语义计数 |
| 任务 TP / FP / FN | 16 / 6 / 2 | 15 / 0 / 0 | C16 仅覆盖 11 个可评分来源，不能据此宣称同分母召回全面胜出 |
| Severe / Major / Forbidden | 9 / 29 / 0 | 7 / 24 / 0 | C16 仍有 7 个 Severe；自动 Forbidden=0 不代表人工审核通过 |
| 关键字段 Major | 23 | 20 | C16 S10 未评分，且 S02、S11 存在具体退步 |

逐来源整份比较：Candidate16 胜 S04、S07；Candidate03 胜 S02；S01、S03、S05、S06、S08、S09、S11、S12 为平（两者均错或均对）；S10 因 Candidate16 引用无效而**不可比**。S04 将纯信息正确处理为零任务；S09 把 Candidate03 的 3 个多余任务降至 0，但仍有关键字段错误。S02 的材料细节与时间使 Candidate16 出现 1 个 Severe、3 个关键 Major。S11 两个旧端点被标作 cancelled 而参照为 superseded，新端点材料仍不对；Candidate16 的关键 Major 为 6，Candidate03 为 5。S10 引用了不存在的 `task-old-return-key` 与 `task-old-sign-roster`；本地保存保护会阻断错误关系，不能把它算作正确建议。标题、自由描述完整语义及教学例泄漏未由独立真人裁决，均记 `NOT_ADJUDICATED`。

这些参照是**已见合成、单作者/模型辅助、provisional**。本批只支持开发诊断，不代表未见 Holdout、真实用户效用或发布资格。下一版应优先针对 S10 的旧新端点闭合、S02 的材料/时间回退、S11 的 currentness 与材料错误做小范围修复；另起候选版本与新冻结包，不回写 Candidate16 或 D13 的答案。

## 确认、保存与四项主指标

D15 新隔离入口支持空白手动与固定辅助两条件共用正式核对链。实际浏览器在 p4 新库完成“1 个任务 + 2 个独立事件”，精确事件有开始/结束时刻，模糊事件保留 `rawText`、`normalizedValue=null` 和 `needsConfirmation`；确认后独立 repository 与刷新读回 Task 1、Project 0、Event 2、TimePoint 4。p3 新库的注入保存失败保留未保存编辑，手动重试成功后读回 Task 0、Project 0、Event 2、TimePoint 4。p3/p4 来源与数据库身份隔离；未操作旧用户库。旧的无任务归档、部分确认、错误修订阻断与多余任务拒绝链路继续适用，D15 混合场景已追加验收。

工程 low-edit-v2 以页面 editId→commitId→readback 追踪；结构增删单列。p4 刷新造成计时区间不闭合，主动修改时间为 `NOT_OBSERVABLE`，没有填 0；工程记录角色固定为 `ENGINEERING_REPLAY`。四项**真人**指标（首次整份建议正确率、最终正确处置率、低修改正确处置率、主动修改时间）仍全部 `NOT_OBSERVABLE`：真实参与者、负责人裁决和已授权真人试次均为 0。上表的 2/12 与 3/12 只是模型在已见合成 Development 的首次整份成绩。

真人探索沿用 [空白试次协议](../d14-integrated/TRIAL_PROTOCOL.md)：3—5 人、每人 4 条匿名通知、手动/辅助平衡；需先冻结来源与辅助刺激 SHA 和 low-edit-v2 阈值，再取得真实负责人、参与者同意及范围授权。本轮没有冒充参与者、填写签名或开始真人试用。

## 费用与保护

用户仅授权本批 `deepseek-flash` 冻结 24 身份、US$7.80 硬上限。首次发送前复核 [DeepSeek 官方计价](https://api-docs.deepseek.com/quick_start/pricing/)、路由、身份、已推送 HEAD 与权威账本。采用峰时缓存未命中价、每请求 1,048,576 输入加 8,192 输出 token 的保守上界，本批最坏 US$7.785696。实际 usage 合计输入 106,266、输出 25,919 token，其中缓存输入 92,928；按峰时**全部输入当未命中**的保守结算 US$0.062990。供应商账单实扣不可直接观察，记 `NOT_OBSERVABLE`，绝不把保守结算说成实扣。

本批唯一 grant `D15-2026-09-28-e5de932a-9a3b-41a4-ae1d-fca50c287d06`；权威账本合法追加 49 行（1 grant、24 reserve、24 settle），现 889 行、SHA-256 `01d6670af09175475fcdfa5aec3594d2751cfd3b03050743fb79a04a578ad4c9`，完整链通过。84 历史保护、119 冻结文件保持原样。raw、授权、状态和账本都不纳入 Git；提交的评分摘要只含匿名开发来源和哈希。没有读取或记录 Secret 明文。

交付状态：**D15 本地产品与比较证据已交付；Candidate16 需要定向修复；独立人工 Holdout、真人试用、默认替换、合并、部署均未执行。**
