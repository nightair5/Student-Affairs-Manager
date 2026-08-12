# E2.9-R2 Harness Integrity Repair — Protocol 3.0.0

## 决策边界

R1 的全部 observation 仅作为协议失败证据，禁止评分、复用、选择性补跑或用于比较 Pro/Flash。R2 只验证修复后的全新配对运行。

## 冻结路径

1. `READINESS_OPEN`：两个模型各一次最小真实请求；全部成功才能进入 Smoke。
2. `SMOKE_OPEN`：5 个冻结样例 × 2 模型，按 case 配对并交错顺序；10 个 observation 必须全部完成且无 integrity failure。
3. `SCREENING_OPEN`：8 个冻结复杂样例 × 2 模型；16 个 observation 必须全部完成且无 integrity failure。
4. `SCORING_OPEN`：只有完整 Screening checkpoint 才能读取 Expected；Scorer 必须复算 Manifest、Prompt/Pipeline、Schema、Scorer semantics、Protocol/Deployment 和 Checkpoint 绑定。
5. `SELECTION_OPEN`：仅 Screening Gate PASS 后可到达；本轮 STOP，因此 `NOT RUN`。
6. `BLIND_OPEN`：仅 Selection 冻结后可到达；本轮 `NOT CREATED`。

## Harness 不变量

- `pure_information` / `information_only` 从 source-only manifest、phase manifest、observation plan、请求、benchmark normalizer、checkpoint 和 Gate 全链路保留。
- 纯信息结果须 `requiresAction=false` 且业务实体为 0；此结构是合法结果，不触发 `BASIC_CONTENT_EMPTY`。
- `requestedModel = returnedModel = executionModel = result.modelName`；任何不一致作为 integrity failure，不能评分。
- observationId 在服务端 Durable Object 中先占位、后终结；失败记录不可覆盖，重复请求在调用模型前拒绝。
- 当前 Prompt、Schema、评分器语义和 Expected 均冻结不改；Router/Repair 均旁路。
- Feature Flag 仅 Preview 可启用；Production 无服务绑定且默认不可达。完成后关闭 flag 并删除短期实验 bearer Secret。

## 停止规则

Smoke 任一失败即停止。Screening 任一协议完整性失败则报告 `EXPERIMENT BLOCKED`；不得进入评分、Selection 或 Blind。Screening 完成后生成报告并 STOP，不进入 E3/E4，不部署 Production。
