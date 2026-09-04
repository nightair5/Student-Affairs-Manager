# RCO-5-007-B2 未见挑战集计划

## 边界

- status: `AUTHORIZED_DATA_AND_ZERO_CALL_FREEZE_ONLY`
- 只新增匿名合成挑战数据、Expected、零调用校验、评分契约、冻结清单和日志。
- 不读取 Secret，不调用模型，不创建联网 runner，不修改任何既有 Expected/freeze/dataset/checkpoint/cache。
- 不接稳定路径、不启动 RCO-6、不部署。

实验计划技能引用的三个共享输出模板在本机缺失，本轮沿用项目已有的计划、跟踪表、冻结清单、追加日志和短上下文。

## Claim Map

| Claim | 最低可信证据 | 反声明 |
|---|---|---|
| C1：RCO-5-007 的本机职责拆分能泛化到未参与定规则的新语义结构 | 同一候选模型输出分别进入旧编排和新本机层；新层 Task F1、requiresAction、Complete Case 和 Major Correction 有净改善 | 改善只来自看过 B1、评分口径变化或 Expected 泄漏 |
| C2：净改善不以安全退化为代价 | 新层 Forbidden=0，Safe Default 不下降，外发/签名/付款等均不默认 | 通过放宽 selected 或合并敏感动作换取 Recall |

本轮只建立未来检验条件，不产生 C1/C2 结果。

## 数据设计

- 16 个全新匿名合成 Development challenge cases；原文、semantic family 不复用 B0/B02/B1。
- 数据在 `task-formation-policy-2.0.0` 和 RCO-5-007 实现提交之后创建，因此不得反向用于修改该冻结候选后再在本集追分。
- 主线覆盖：同 scope 不同对象、同 scope 本地+外发、已触发/未触发条件、引用诱饵、纯外部必做、第三方完成态、可选+必做、部分共享材料、例外人群、完成态+剩余动作、事件时间/截止时间、问答修订、未登记动作同义词、可选直播、跨段回指。
- Expected 是 Codex 单作者标签，不是独立人工 GT；任何通过都只能申请下一阶段，不能证明商业正确率。

## 未来固定比较

- 单一 candidate 请求：相同模型、prompt、temperature 和原文只调用一次。
- Arm O：按 B1 旧编排和旧 verifier 规则处理。
- Arm L：同一 candidate 进入冻结的 RCO-5-007 本机任务形成与安全层。
- 禁止 Repair/retry；无效 candidate 计入两臂共同失败分母，不允许对某一臂偷偷补调用。
- Expected、forbidden/default 标签永不进入模型请求。

## 指标与门槛

决策指标必须同时报告 Task Precision/Recall/F1、动作+对象、requiresAction、语义字段、任务边界整例、Complete Task Case、Major Correction、Safe Default Recall、Forbidden，以及逐例错误方向。

最低晋级条件：

- candidate 请求全部有确定终态，任何传输失败独立报告；
- Arm L Schema 16/16；Forbidden=0；
- Arm L Task F1 不低于 90%，requiresAction 不低于 95%，Complete Task Case 不低于 80%；
- Arm L 相对 Arm O Task F1 至少 +3pp，Major Correction 至少 -5pp；
- Safe Default Recall 不退化；
- 任一安全错误、评分依赖漂移、Expected 泄漏或 protected hash 变化均为 `STOP`。

## 执行顺序

1. B2-D0：创建数据、Expected 与标签摘要，先不冻结。
2. B2-D1：验证 scope 可构造、来源证据、匿名性、与三批旧数据不重复、Expected 不进请求。
3. B2-D2：冻结数据、政策版本、评分器和全部传递依赖。
4. 停止并向用户申请具体模型、最大调用数和人民币硬上限。
5. 获得新授权后才创建/冻结 runner，并运行 paired comparison。

## 费用提案（未授权）

- 建议模型：`deepseek-v4-flash-vision-exp`
- temperature: `0`
- candidate: 16 次；旧 verifier 最多 16 次；总调用最多 32 次
- Repair/retry: `0/0`
- 人民币硬上限：`REQUIRES_USER_VALUE`

该提案不是付费授权。

