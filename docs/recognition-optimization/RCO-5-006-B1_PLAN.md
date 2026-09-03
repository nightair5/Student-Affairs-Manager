# RCO-5-006-B1 Scope 引用与语义标签 Development 计划

**Problem**：RCO-5-006 已证明本机可以从 scope 引用确定性重建位置、证据、关系和 selected，但尚未证明真实模型能选对 scope ID 和受控语义标签。

**Method thesis**：模型只负责引用本机 scope catalog 并输出受控语义；本机严格校验、独立复核和 composer 负责其余机械工作。若该收缩后的任务仍不能稳定完成，就不应进入 RCO-6。

**Date**：2026-09-03

## 当前授权拆分

本次用户要求先冻结新匿名数据，再付费验证。为了满足费用和运行可审计要求，本阶段先完成数据、Expected、验证器、计划和跟踪表冻结，模型调用保持 0。付费运行必须再明确给出模型、最大调用次数和人民币硬上限；旧 B02 的 36 次/10 元额度不自动续用。

## Claim Map

| 主张 | 为什么重要 | 最低可信证据 |
|---|---|---|
| C1：模型能稳定选择正确 scope | 新契约只有在模型引用正确原文范围时才有意义 | 候选 12/12 通过严格 Schema；scope 引用 micro-F1 ≥90%；字段引用全部落在对应完整命题范围内 |
| C2：模型能正确标注决定任务安全的语义 | 主体、否定、时态、状态、有效性和动作效果决定是否出现错误任务 | requiresAction ≥95%；关键语义轴 micro accuracy ≥90%；完整语义 bundle ≥85%；Forbidden Default=0 |
| 反主张：高分来自改题、复制 Expected 或宽松计分 | 这会让结果无法外推 | 新原文、family 与 B02 均不重复；Expected 永不进入请求；冻结后不改题、不 Repair、不 retry；无效结果不计质量分 |

## 数据

- split：`Development`
- classification：`anonymous_synthetic_codex_authored_development`
- 数量：12 案例、12 个新 semantic family。
- 标签：22 个指令命题、12 个事件/信息观察、4 个 `requiresAction=false` 案例、10 个安全默认项、12 个必须保持不默认的指令。
- 范围：quoted UI 示例、数字时间冒号、修订、未触发条件、纯事件、optional、凭证诱导、共享材料、多行标题、第三方完成态、已触发修改、非正式征询。
- Ground truth 边界：单一 Codex 作者匿名合成参考答案，不是独立人工 GT、Holdout 或真实学生材料。

## Scope index 1.1

数据预冻结自检发现旧 scope index 会把 `19:30` 中的冒号切成命题边界。没有通过失败结果继续冻结，也没有修改 RCO-5-006 已封存组件；新增隔离 `scope-index-1.1`，只规定数字—冒号—数字不切分，标题冒号仍切分，并把 index version 纳入 scope 内容哈希。该修正必须随本数据冻结。

## 拟议付费运行（尚未授权）

- model candidate：`deepseek-v4-flash-vision-exp`
- temperature：0
- Repair / retry：0 / 0
- candidate：12 次，每案 1 次；只发送 source、reference time/timezone 和本机 scope catalog，不发送 Expected。
- semantic verifier：最多 12 次；只有 candidate 本地 Schema 合格才调用。独立 run ID 与 candidate fingerprint 强绑定。
- 最大模型调用：24；若 candidate 不合格，对应 verifier 记 `skipped_upstream_invalid` 且 0 dispatch。
- 逻辑分母固定为 24；跳过不是成功，也不从分母删除。
- provider 实际费用不可观测时记录 `NOT_OBSERVABLE`，不得用估算冒充账单。

## 指标

### 结构和调用完整性

- planned / dispatched / acknowledged / unknown receipt / skipped verifier。
- candidate Schema、verifier-own Schema、完整 pipeline Schema 分开报告。
- source、candidate fingerprint、run ID 和 scope-index version 绑定率。

### Scope 引用

- proposition scope ID micro Precision / Recall / F1。
- action、object、time、material、event、location 的 scope ID 与 surface exact match。
- ignored scope accuracy、source complete coverage、跨命题串借和乱序数量。
- revision target/type/scope exact match。

### 语义与产品安全

- requiresAction accuracy。
- actor、speechAct、polarity、tense、status、validity、modality、inferenceLevel、actionType、effect 分轴 accuracy。
- 完整 semantic bundle exact match。
- directive/observation Recall、Complete Case、Major Correction。
- Forbidden Default、Safe Default Recall、Missed Safe Default。

## 预注册判定

1. 任何 candidate 不是 12/12 Schema 合格，或所有应调用 verifier 不是 100% 有终态：`INVALID_RUN`。
2. 任一跨来源/版本引用、自由 evidence/offset/selected/relations 泄漏、Forbidden Default >0：`REJECT_CANDIDATE`。
3. Scope F1 <90%、关键语义轴 <90%、semantic bundle <85%、requiresAction <95%、Complete Case <75% 或 Safe Default Recall <90%：`NO_PROMOTION`。
4. 所有门槛同时满足，只能判定 `PROMISING_FOR_NEW_DEVELOPMENT_REPLICATION`，仍不等于 RCO-G5、RCO-6、真实材料或上线通过。

## 运行顺序

| 里程碑 | 内容 | 模型调用 | 停止条件 |
|---|---|---:|---|
| M0 | 数据、Expected、scope index、验证器和冻结哈希 | 0 | 任何自检、隐私或旧资产保护失败 |
| M1 | 用户明确批准模型、≤24 次和人民币硬上限；新增并冻结 runner/checkpoint | 0 | 参数不完整或费用预检超限 |
| M2 | 12 candidate + 最多 12 verifier | ≤24 | 未知回执、上游身份漂移、预算触线 |
| M3 | 本机评分、checkpoint 复算和新鲜只读审查 | 0 | 任何完整性缺口则结果失效 |

## 不属于本轮的事项

不接稳定路径，不启动 RCO-6，不使用图片/文件，不处理真实材料，不测真人修改时间，不做浏览器验收，不部署 Preview/Production。
