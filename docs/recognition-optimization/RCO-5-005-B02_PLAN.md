# RCO-5-005-B0.2 新 Development 数据与拟运行计划

**Problem**: B0 因输出契约和计分缺陷失效；B0.1 已完成零调用修补，但尚未证明真实模型能够稳定遵守新契约并提升任务事实质量。

**Method thesis**: 同一模型先做紧凑事实抽取，再做完整命题图，只有命题图通过本地结构检查后才进行独立语义复核；默认勾选完全由复核结果与确定性安全策略决定。

**Date**: 2026-09-03

## 本轮已经授权的部分

- 新建 12 个匿名合成 Development 案例。
- 在任何 DeepSeek 请求之前锁定原文、参考答案、评分方式、候选提示词/Schema 与数据校验代码。
- 本阶段模型调用、网络 dispatch、Repair、Secret 访问均为 0。

## 本轮尚未授权的部分

- 读取或配置 DeepSeek API key。
- 创建可联网的正式运行器或发送任何模型请求。
- 使用下列拟议的 36 次/10 元预算。
- 修改稳定路径、RCO-6、Preview、RC.4、Production 或部署。

## Claim Map

| 要验证的主张 | 为什么重要 | 最低可信证据 |
|---|---|---|
| C1：新结构能稳定得到可计分结果 | B0 首先死在结构不合格，没资格比较正确率 | 12/12 facts、12/12 graph、所有应调用 verifier 的结果各自 Schema 合格；graph 不合格时 verifier 必须零调用跳过 |
| C2：命题图加复核比紧凑事实更完整且不更危险 | 只有净收益才值得继续多模态融合 | graph Task Recall 严格高于 facts；verified Recall 不低于 facts；其余关键指标不退化；Forbidden=0、Safe Default Recall=100% |
| 反主张：改善只是改题或偷看答案 | 会让高分失去意义 | 新原文/语义家族均不复用 B0；Expected 只在本地计分，永不进入请求；冻结后不改题、不改答案、不 Repair、不重试 |

## 数据设计

- split: `Development`
- classification: `anonymous_synthetic_codex_authored_development`
- label boundary: Codex 单一作者参考答案，不是独立人工 ground truth，也不是 Holdout 或真实材料。
- 12 个语义家族：错误截止时间归属、收件人豁免、已作废引用、活动地点更正、公布时间与任务分离、条件未触发、可选与必做并存、事件存在但无需行动、已完成动作与当前动作、多任务不同截止时间、本地检查加对外报告、机构截止时间与学生无关。
- 4 个 requiresAction=false 案例；其余案例共 9 个当前任务，其中 8 个允许本地默认勾选，1 个对外联系任务不得默认勾选。

## 拟议运行方式（等待另行批准）

- model: `deepseek-v4-flash-vision-exp`
- endpoint: `POST https://api.deepseek.com/responses`
- temperature: `0`
- thinking: `none`
- max output: `2,000 tokens/request`
- max request body: `49,152 UTF-8 bytes/request`
- Repair / retry: `0 / 0`
- 顺序：每个案例先 facts，再 graph；graph 只有本地 Schema 合格才允许 verifier。
- 最大逻辑单元：`12 × 3 = 36`；verifier 被安全跳过时实际模型调用少于 36，但逻辑失败仍保留在分母。
- 若首次请求表明 Responses/JSON Schema 在线不兼容，立即停止，不换接口重试，不消费整批数据追分。
- Expected、forbidden token、默认选择答案不得进入任何模型请求。

## 拟议费用上限（等待另行批准）

2026-09-03 查询官方峰值价格：cache miss input `$0.44/1M tokens`，output `$1.32/1M tokens`。按最保守方式把每次 49,152 UTF-8 bytes 当成 49,152 input tokens，并给满 2,000 output tokens，再按 `10 CNY/USD` 计算：

`36 × (49,152 × 0.44 + 2,000 × 1.32) / 1,000,000 × 10 = 8.7360768 CNY`

因此拟申请硬上限为 `36 次模型调用 / 10 CNY`。这是预算保护，不是账单预测；供应商未返回账单金额时必须记录 `NOT_OBSERVABLE`。

## 必须同时报告的结果

- 请求：计划逻辑单元、实际 dispatch、确认回执、未知回执、跳过复核、HTTP/transport/Schema 失败。
- 结构：facts Schema、graph Schema、verifier-own Schema、pipeline Schema，不能合并冒充。
- 质量：Task Precision/Recall/F1、requiresAction、effect、time、materials、event、location、Evidence、Complete Case、Major Correction、Forbidden、Safe Default Recall、Missed Safe Default。
- 费用：供应商 usage 原值、可审计保守费用、Provider billed cost 或 `NOT_OBSERVABLE`。

## 判定与停止条件

1. 任一臂没有完成全部应完成案例或有 Schema 无效：`INVALID_RUN`，不比较优劣。
2. verified 出现 Forbidden、漏掉安全默认项，或相对 facts 在任一关键指标退化：`REJECT_CANDIDATE`。
3. 只有 graph Recall 严格提高、verified Recall 不低于 facts，且所有安全与非退化条件成立：`PROMISING_FOR_LARGER_DEVELOPMENT_ONLY`。
4. 其他结果：`INCONCLUSIVE`。
5. 无论结果如何，本轮都不自动进入 RCO-6、真实材料、真人修改时间、浏览器验收或部署。

## 执行顺序

| 里程碑 | 内容 | 调用 | 决策 |
|---|---|---:|---|
| M0 | 数据/答案/代码哈希、隐私、旧数据不变、请求不含 Expected | 0 | 全通过才允许申请预算 |
| M1 | 新建可联网运行器并在首次请求前再次冻结 runner/freeze/plan | 0 | 用户明确批准次数和人民币上限后才能进行 |
| M2 | 运行 12 个 facts、12 个 graph、最多 12 个 verifier | ≤36 | 任何结构/完整性失败均保持 INVALID |
| M3 | 自动报告、人工复算和新鲜只读审查 | 0 | 只决定是否值得申请更大 Development，不决定上线 |

