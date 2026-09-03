# RCO-5-006 不可变 Scope ID 引用式语义契约

## 结论

本轮建立了一个与稳定路径完全隔离的候选中间层。它把模型职责缩小为“引用本机已经切好的原文范围，并给出受控语义标签”，把字符位置、逐字证据、关系记录和默认勾选全部留给本机代码生成。

当前结论仅为 `ZERO_CALL_CONTRACT_TECHNICAL_PASS / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`。它证明新的责任边界在已登记匿名夹具上可执行且失败关闭，不证明模型能正确选择 scope，也不证明产品正确率提高。

## 第一性原理

识别结果可信至少需要同时回答四件事：原文是哪一版、某条信息来自原文哪里、信息之间如何归属、哪些建议可以默认勾选。B02 证明让模型同时复制原文、计算字符位置、构造关系和做选择，会把粗略看懂与精确落位混为一件事。

本契约因此拆成两类责任：

1. 模型只做开放语义判断：引用已有 scope ID，填写受控的主体、言语行为、极性、时态、状态、有效性、模态、推断等级、动作类型和动作效果。
2. 本机只做可重复计算：根据冻结原文和 scope ID 重建字符位置、逐字证据、任务—时间/材料/事件/地点、事件—时间/地点和修订关系，并计算 `selected`。

这不是把语义问题伪装成规则问题。模型是否选对 scope、语义标签是否正确，仍必须通过独立验证和后续新数据模型实验来证明；本轮只消除不应由模型承担的机械错误面。

## 契约边界

### 本机预处理

- 输入必须有非空 `sourceId`、`sourceVersionId` 和原文字节。
- 本机按保留标点的确定性边界生成 scope；每个 scope 保存原文 `start/end/text`，这些字段不进入模型输出 Schema。
- `sourceFingerprint` 使用 SHA-256 绑定 source ID、version ID 和完整原文字节。
- scope ID 使用顺序号和完整 SHA-256，且摘要绑定 source fingerprint、顺序、位置和逐字内容。同一输入可重复生成相同 ID；source、version 或任一字节变化都会让旧候选失去绑定。

### 模型候选

- 候选只能包含来源绑定、`requiresAction`、指令命题、事件/信息观察命题和忽略的 scope ID。
- 动作、对象、时间、材料、事件和地点只能用 `{scopeId, surface}` 引用；`surface` 必须是该 scope 中唯一出现的连续原文子串。
- 候选不能输出 `start`、`end`、`text`、`quote`、自由 `evidence`、`selected`、`relations`、`fromId` 或 `toId`。
- 所有对象使用完整内联枚举和 `additionalProperties: false`；未知字段直接拒绝。
- 所有原文 scope 必须被某个命题引用或明确列入 ignored；遗漏新增句子、跨 source/version 重放、乱序和跨命题借字段均失败。

### 独立复核

- 复核结果绑定同一 source/version/fingerprint 和候选完整 SHA-256。
- 复核只能返回 scope ID 证据范围，不能返回自由证据、位置或 `selected`。
- 每个指令和观察命题都必须恰有一条复核；`entailed` 必须覆盖完整命题 scope，不能只挑有利短句。
- producer run ID 与 verifier run ID 必须不同。
- 输出自称 `independent_semantic_verifier` 不产生信任。只有本机调用方预先提供的可信 verifier run ID 才具备默认选择资格；测试 oracle 也必须显式开启。

### 本机 Composer

- 先完整验证候选与复核，任何错误都返回 `ok=false`，不产生部分勾选结果。
- action/object/time/material/event/location 的字符位置均由本机在已绑定 scope 内唯一查找。
- 逐字 evidence 直接复制整个命题 scope，不接收模型改写。
- 任务—时间、任务—材料、任务—事件、任务—地点、事件—时间、事件—地点和修订关系由本机按结构生成 ID、端点和 evidence scope。
- `selected` 只由本机生成。需同时满足：可信独立复核、整图和修订覆盖完整、无缺失命题、当前有效的肯定明示必做指令、语义复核完全一致、受控本地/实体动作与安全效果。
- 外传、外部交互、未知效果、复核不一致或不完整一律不默认勾选。
- 纯事件可以作为待确认观察保留，但 `selected=false`，且不把 `requiresAction` 改成 true。

## 隔离性

候选实现位于 `src/recognition/scopeReferenceContract.ts`。稳定 Worker、浏览器录入、服务端、Workspace 提交和部署入口均未 import 它；未修改既有 Expected、freeze、dataset、checkpoint、result、validator 或 cache。

## 已知边界

- 36 项测试属于匿名、代码作者构造的 contract/metamorphic/adversarial fixtures，不是独立人工真值，也不是现实材料。
- 现在没有接入可信 verifier 身份注册表；因此真实路径不具备默认勾选资格。
- `surface` 唯一存在只证明词面定位，不证明语义归属正确；语义质量仍需下一次独立冻结数据和真实模型调用验证。
- scope 切分是确定性候选，不保证所有复杂表格、OCR 错行或跨页句子天然形成最佳命题范围。
- 本轮没有测 Recall、Precision、Complete Case、真人修改时间、图片/PDF 识别、浏览器兼容、隐私审计或商业上线条件。

## 后续门槛

RCO-5-006 完成后应停止。若用户另行授权下一轮，应先冻结新的、与 B02 不重复的匿名 Development 输入及 Expected，再让同一模型只输出本契约允许的 scope 引用和语义标签。只有模型能稳定选对 scope、关键事实更完整且 Forbidden 不退化，才有资格讨论 RCO-6；本轮授权不包含这些动作。
