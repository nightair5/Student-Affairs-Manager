# RCO-5-005-B02-M2 事后独立审查

## 最终判断

`INVALID_RUN / DO NOT PROMOTE / DO NOT CONNECT TO STABLE PATH / DO NOT DEPLOY`

本轮证明了接口能够调用、严格 JSON 能返回，但没有证明“完整命题图 + 独立复核”能够稳定工作。当前候选不具备进入 RCO-6 或替换稳定识别路径的资格。

## 运行完整性

- 冻结 Run ID：`rco-5-005-b02-m2-20260903a`。
- 模型：`deepseek-v4-flash-vision-exp`；temperature 0；thinking none。
- 36 个逻辑单元全部有终态：25 个实际请求、11 个上游图不合格后的零调用跳过。
- 25/25 实际请求都有 HTTP 回执；未知回执 0。
- completed 25，transport/request failure 0，Repair 0，retry 0。
- 12 个 facts 和 12 个 graph 均返回 completed；只有 1 个 graph 通过本地契约，因此 verifier 实际调用 1 次。
- checkpoint 独立重验通过；result 中的 checkpoint 和 raw-results 哈希绑定通过。
- Provider 返回的 usage 完整：59,061 input、13,017 output、72,078 total tokens。
- Provider billed cost 未返回，记为 `NOT_OBSERVABLE`；按冻结峰值单价保守折算为 0.4316928 CNY，不是供应商账单。

## 冻结主指标

facts-first 的 12/12 输出均通过自身 Schema，但严格产品字段得分为：

- Task Precision / Recall / F1：40.0% / 40.0% / 40.0%（TP 4、FP 6、FN 6）。
- requiresAction：100.0%。
- effect / time / materials / event / location：18.8% / 27.3% / 14.3% / 33.3% / 14.3%。
- Evidence 原文连续片段有效率：100.0%。
- Complete Case：33.3%，实际通过的是 4 个无需行动案例；8 个有任务案例均未达到完整正确。
- Major Correction proxy：66.7%。
- Safe Default Recall：44.4%，漏掉 5 个可安全默认项。
- Forbidden Default：5。这里不是 5 次对外危险操作被默认执行，而是 5 个正向任务因 action/object 等字段未按冻结答案正确分工，不能被评测器证明为安全匹配；外部联系任务仍被确定性策略挡住，没有默认勾选。

graph 与 verifier 不具备合法质量分：

- graph：12 个 completed，但仅 1/12 Schema 合格，整臂为 `INVALID_RUN`。
- verifier：只调用 1 次且自身 Schema 不合格；其余 11 次按门槛零调用跳过，整臂为 `INVALID_RUN`。
- 因此不得比较 graph/verified 的 Precision、Recall 或声称它们优于 facts。

## 第一性原理原因

产品需要的不是“模型大概看懂”，而是：每个动作、对象、时间、材料、地点、状态和证据都能稳定放进正确字段，随后才能安全生成待确认建议。本轮失败主要发生在“把理解可靠地变成结构”这一步。

1. **粗粒度语义并非主要瓶颈。** 模型正确判断了 12/12 是否需要行动。事后把 action、object 和 evidence 合并搜索时，10 个预期动作都能找到，且没有多出的当前正向动作。这个 10/10 只用于定位原因，是冻结后新增的宽松诊断，不能替代或改写 40% 的预注册主指标。
2. **字段分工不稳定。** 模型常把整句动作写进 action，却把地点、材料或泛称写进 object。例如把“完成安全签到”留在 action、把 object 写成“护目镜”。人能读懂，但任务系统无法据此可靠归档、匹配或修改。
3. **让模型抄字符位置是错误的职责分配。** 11 个 graph 共 56 个契约错误：43 个是原文 scope/text/start/end 不精确，8 个是关系两端类型错误，5 个是关系证据没有覆盖两端。精确字符位置应由确定性程序生成，不应依赖语言模型手工计数。
4. **复核器仍会改写证据。** 唯一被调用的 verifier 对 5 个节点全部用了“原文明确……”式解释，而不是原文连续片段，所以 5 个 evidence 校验全部失败。复核器不能靠自由文本证明自己，应引用不可改写的原文 scope ID。
5. **严格门槛发挥了作用。** 如果只看 HTTP 200、JSON 或 requiresAction，本轮会被误判为成功；字段、证据和关系门槛阻止了不可靠结构进入默认勾选和稳定路径。

## 根治方向（本轮未实施）

下一轮不应先加调用量，也不应放宽评分追分。应先做 0 次模型调用的中间层重构：

1. 本机先把原文确定性切成不可变的句子/分句 scope，并生成 scope ID、原文、start/end。
2. 模型只选择 scope ID 和输出语义标签；禁止模型重复原文、填写 start/end 或自由改写 evidence。
3. composer 根据 scope ID 回填原文和精确位置，无法唯一绑定就拒绝该节点。
4. action 与 object 改为“受控动作 + 对象证据 scope/短语”的双重契约；本机校验两者都能从证据推出，避免整句塞进 action、地点塞进 object。
5. 关系由受控类型表和端点类型自动校验；能从节点类型唯一确定的关系由本机生成，不让模型自由创造方向。
6. verifier 只返回 nodeId、判定和 evidenceScopeIds；本机重建证据，杜绝“原文明确……”式伪引用。
7. 先用属性变形和新鲜对抗夹具证明这些结构在 0 调用下闭环，再新建并冻结未见 Development 数据申请下一轮付费测试。

## 证据边界

本轮只有 12 个匿名合成 Development 案例，参考答案由 Codex 单一作者制定，不是独立人工 ground truth。它不能回答真实截图、照片、扫描 PDF 的识别率，也没有测真人修改时间、Chrome/Edge/手机验收、隐私合规或商业上线效果。
