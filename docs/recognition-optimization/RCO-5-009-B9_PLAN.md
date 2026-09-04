# RCO-5-009-B9 全新候选分类零调用验证计划

## 目的

在不调用模型的前提下，冻结 12 个新的匿名 Development 案例和逐候选响应夹具，检验 RCO-5-009A 是否能把模型职责真正缩成：对本机已编号动作判断 `proposition / mention_only / uncertain`，并且单条坏响应只影响该候选。

## 第一性原理边界

- 识别成功的最小单位是原文中的 action occurrence，不是模型自由写出的一整张任务清单。
- action、candidate ID、原文位置、对象候选、语义、修订、requiresAction 和 selected 均由本机控制；响应夹具只模拟未来模型允许返回的闭集字段。
- 数据与 Expected 在任何候选流水线运行前冻结并提交；随后另建并冻结 runner/evaluator、再次提交；只有两次提交都推送成功才允许首次运行。首次运行后 B9 立即变为已见。
- B9 是 Codex 单作者匿名合成 Development，不是独立人工真值、真实材料、图片/OCR、真人修改时间或商业上线证据。
- 模型、网络、Secret、verifier、Repair 和 retry 全为 0；不接稳定路径、不启动 RCO-6、不部署。

## 诚实限制

`local-action-candidate-policy-1.2.0` 每个动作目前只能生成 0 或 1 个对象候选。因此本轮不能证明“模型能从多个对象中选对一个”，该项固定记为 `NOT_EXPRESSIBLE_BY_POLICY_1.2.0`。对象闭集为空时必须 quarantine，禁止模型自由补写。是否扩展多对象只由后续真实错误收益决定，不在本轮复制整套架构。

## 固定覆盖与计数

- 12 cases、19 action candidates。
- `local_proposition=12`、`needs_model=6`、`local_non_task=1`。
- 预期 ledger：`accepted_local=11`、`accepted_model=2`、`ignored_model=2`、`ignored_local=1`、`quarantined=3`。
- 预期最终任务 13 条；7 条安全默认；1 条确定的 `amends` 修订关系。
- 覆盖真实 needs_model 的 proposition/mention/uncertain、空对象闭集、同字 occurrence、跨候选坏对象、quarantine 参与修订、已解析修订后置独立任务、OOV、标题提及与真任务隔离、对象关系从句和远距离条件阻断。

## 新颖性边界

- 不把“换了几个名词”叫成全新语义。冻结前的对抗审计已替换与 B6–B8 高度同构的三类骨架。
- 静态门只证明原文字符串、语义族 ID 和字符 bigram 没有重复；它不能证明真实世界分布独立，也不能替代独立人工真值。
- B9 只可称为“DeepSeek 未见、Codex 本地设计并预检的数据”，不得称为正式盲测或商业准确率样本。

## 冻结后首次零调用门

1. 逐候选动作、对象、disposition、occurrence ID 和 source span 100% 对齐。这里的 ID 门是“冻结的第 N 个动作原文切片 → 确定性 candidate ID → ledger/task origin ID”全链保持，不是手写一个可随实现改动的 ID 答案；对象门固定称 `singletonOrEmptyObjectSpanExact`，不冒充多对象选择能力。
2. 13/13 accepted candidate 与 task 双射；重复同字动作不得合并、互换对象或共用 ID。
3. 完整语义、requiresAction、selected 逐项 100%；unsafe default 与额外勾选均为 0。
4. 坏对象只 quarantine 自己，合法 sibling 存活率 100%。
5. quarantine 不得提高修订确定性；未决历史修订不得阻断后置独立当前任务。
6. OOV 与条件 unknown 必须返回 `requiresAction=null`，不能伪装成 false。
7. 只有预登记案例允许 partial；预期 issue code 仅 B9-06 的 `OBJECT_CANDIDATE_INVALID`，任何实际计数、状态或 issue code 偏移均 FAIL，不修数据追分。

## 停止条件与后续

- 顺序固定为“data freeze 提交并推送 → runner/evaluator freeze 提交并推送 → 恰好一次零调用运行”；禁止未冻结 runner 偷看结果后再改评分器。
- 若首次零调用失败：B9 立即标记已见，保留结果，后续修复必须使用 B10 验证泛化。
- 若通过：只说明本机合同与隔离层可表达，不能宣称模型准确率提升。
- 未来付费分类测试必须另行冻结联网 runner、调用次数、人民币上限和失败停止条件，并获得用户明确授权；本计划不构成付费授权。
