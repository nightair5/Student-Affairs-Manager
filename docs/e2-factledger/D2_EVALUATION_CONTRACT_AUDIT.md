# E2.5 D2：评测契约与 Major Correction 审计

## 审计结论

当前 E2 scorer 适合作为严格结构回归分，但不适合单独代表“用户是否需要重大修改”。在 D1 的 30 条样例中，现有 scorer 标记 Major 28 条，人工判断实际需要重大修改 15 条：Major precision 为 53.6%，recall 为 100%，假阳性率为 13/28（46.4%）。

因此后续 A/B 必须同时报告：

1. 原始 strict structural metrics，保持历史可比性；
2. 新增 semantic-equivalent metrics，衡量事实、动作、角色、条件和关系是否完整；
3. human-impact Major Correction，按用户是否必须修改行动/时间/适用条件判断。

三套结果并列，禁止用新分数覆盖历史基线，也禁止修改冻结 expected。

## 代码证据

### 1. Major Correction 的触发范围过宽

`src/recognition/e2/scoring.ts:211` 将以下任一情况直接判为 Major：Project 决策不匹配、Task recall < 0.5、Time accuracy < 0.5、或存在任意 `major` failure。

同时：

- 任一 task/material/time/event/evidence/ambiguity missing 都被赋为 `major`（约第 107、119、152、159、168、180 行）。
- 纯信息样例即使没有 Task，只要保留一个参考 Event/TimePoint，Time accuracy 可能降为 0 并触发 Major（约第 207–211 行）。
- Project 容器选择错误即使不损失行动事实，也直接触发 Major（第 82–89、211 行）。

这些规则保证高召回，但把结构偏好、辅助信息和用户重大修改混为一类。

### 2. 合理等价 Task 被一对一别名匹配误伤

Task 使用 action alias + object alias 的一对一匹配（约第 38–49、100–115 行）。一个实际 Task 即使明确覆盖两个同截止交付物，也只能匹配一个 expected Task，另一项被记 `task_missing major`。

D1 中的直接证据包括：

- `e2-complex_notice-01`：一个 Task 提交“调研报告PDF和原始访谈记录”。
- `e2-complex_notice-06`：一个 Task 提交“源代码与说明书”。
- `e2-holdout-05`：一个 Task 提交“源代码和技术报告”。
- `e2-holdout-22`：实际对象逐项列出中期报告、经费明细和阶段成果，却未匹配标准上位词“中期材料”。

这些结果没有删除标准事实，不应通过修改 expected 解决。

### 3. Milestone 名称/粒度被当成事实缺失

Milestone 只比较标题 alias（约第 92–98 行）。`提交作品`、`材料提交阶段`、`投稿阶段` 等能够覆盖相同 Task/TimePoint 的结构，会因未命中“正式提交”“摘要”“全文”等标题而计缺失。

Milestone 需要两套分数：标题结构严格分，以及基于所覆盖 Task/TimePoint/Event 与顺序的语义充分性分。

### 4. TimePoint 把发现、角色、值和原文表述耦合

完整 TimePoint match 同时要求 type、raw alias、normalized value 与 confirmation 语义（约第 124–155 行）。这使以下问题难以区分：

- 事实和值已发现，但 `registration_deadline` 被规划为 `task_deadline`；
- 同一时间原文由“8月21日至22日”拆成 start/end，rawText 不再包含完整范围；
- `暂定9月1日开放` 被缩为 `9月1日`，值正确但 modality 丢失；
- 依赖事件结束的相对时间被不安全地精确化。

后续必须分别报告 TimePoint detection、type、value、uncertainty/modality 和 relation。

### 5. Ambiguity 用自由文案匹配身份

Ambiguity 只要 field 或 message 命中任一 alias 即匹配（约第 175–183 行）。Repair 生成“结果发布时间未知，无法计算截止”和 expected 的“发布日期未知/发布后48小时”可能语义相同，却同时产生 missing + spurious。

后续以稳定 issue code + target fact + evidence span 匹配；自由文案只用于解释，不作为身份。

### 6. Repair Harm 当前仍不可充分观测

聚合器只有在 `beforeScores` 存在时才计算 Repair Harm（约第 343–366 行）。本次已提交 failure JSON 中多条 Repair 有 `beforeResult`，但现有缓存记录未提供可直接汇总的 `beforeScores`；因此 D1 不能声称 Repair Harm 为 0，只能说选中 30 条中没有观察到事实被删除的证据。

## 语义等价评分规则

机器可读规则见 `d2-semantic-equivalence-contract.json`。核心规则如下：

### Task

- 动作谓词必须属于同一 action family；“回复”与“参加”不等价。
- 一个实际 Task 可以覆盖多个 expected object，但仅限同 actor、modality、condition、deadline、channel，且不要求独立完成状态。
- 不同截止、不同角色、不同条件、有顺序依赖的步骤不得合并等价。
- Material 被发现不自动等于行动被发现；例如“携带问题清单”不能只用“准备问题清单”代替。

### Milestone

- 允许改名、合并或拆分，但必须保持 Task、TimePoint、Event 覆盖和顺序。
- 名称/粒度差异单独报告，不自动触发 human-impact Major。

### TimePoint

- Detection、type、value、uncertainty/modality、relation 分开评分。
- relative/vague 若不能由原文唯一确定，必须 `null + needsConfirmation`。
- 时间区间保留 start/end 语义；变更通知保留 `superseded → active` 关系。

### Event / Ambiguity / Evidence

- Event 与 Task 不可互相代替；签到、提交、回复等可完成义务仍需 Task。
- Ambiguity 按 issue code、目标事实与证据定位匹配，不按说明句逐字匹配。
- Evidence 必须是原文逐字子串；一段证据可以支持多个被覆盖事实，不能为了等价放宽为模型改写。

## Human-impact Major Correction 契约

判 Major：缺少必须行动、动作谓词/主体/modality/适用条件错误、会改变提醒或执行顺序的时间值/角色错误、假精度、缺少必须参加的 Event、证据不受原文支持、严重或安全错误。

不判 Major：满足约束的同截止 Task 合并/拆分、Milestone 改名或粒度变化、不损失行动的 Project 容器差异、完整逐字证据的切片差异、没有创造行动的纯信息 Event。

## 冻结校验的跨平台修复

原冻结 manifest 的 SHA-256 对应 Git 中 LF 内容。Windows `core.autocrlf=true` 将工作树变为 CRLF，旧测试直接哈希工作树字节，导致三个数据集在没有 Git diff 时误报冻结破坏。

D2 仅把冻结校验改为先规范化 CRLF/LF 再计算 manifest 哈希：

- 不修改 Golden、Holdout、Development 数据；
- 不修改 expected、corrections log 或 manifest hash；
- 非换行内容的任何变化仍会失败。

## D2 决策

评分器问题真实存在，且足以扭曲 Major Correction。后续 D4/D5 的隔离 Harness 应新增 semantic-equivalent/human-impact 层，但必须保留现有 strict scorer 结果并让 A/B 两路径使用完全相同的两套评分逻辑。

D2 不修改生产 Prompt、Router、Validator、Repair、Workspace v8、DomainCommitPlan 或正式 Capture/Commit 链路。
