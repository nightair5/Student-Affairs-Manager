# RCO-5-007-B3 全新挑战集与零调用理想锚点门计划

## 授权与边界

- status: `AUTHORIZED / DATA_FREEZE_THEN_ZERO_CALL_ORACLE / IN_PROGRESS`
- 只新增一批匿名合成 Development 挑战数据、Expected、本机校验、冻结清单、零调用理想锚点结果、审计和日志。
- 冻结 P1 作为唯一受测策略；不修改 P1、B2 或任何既有 Expected、freeze、dataset、checkpoint、cache。
- 不读取 Secret，不调用模型，不联网，不接稳定路径，不启动 RCO-6，不做浏览器验收，不部署。
- B3 第一次运行后立即视为已见；若失败，只审计并停止，不得依据 B3 调整 P1 后重测。

实验计划技能引用的三个共享输出模板在本机缺失，本轮沿用项目已有的计划、跟踪表、冻结清单、追加日志和短上下文体系。

## 第一性原理主张

用户价值不是“模型返回了 JSON”，而是原文中的真实义务能变成完整、可核对且不越权的任务。理想锚点门故意假设上游已把 scope、动作和对象找对，只问一件事：冻结的本机层能否可靠决定任务边界、当前义务、对象保真、效果风险和默认勾选。

| Claim | 最低可信证据 | 反声明 |
|---|---|---|
| C1：P1 四层机制可泛化到未参与设计的新表达 | 首次 B3 运行达到固定门槛，且所有不完整案例逐例披露 | 用已见 B2 的 100% 冒充泛化，或失败后改 P1 再复跑 B3 |
| C2：正确率改善不靠放宽危险默认操作 | Forbidden=0，外发、缴费、报名、联系、签字和参加仍不默认 | 把 `requiresAction=true` 偷换成 `selected=true` |

## 数据设计

- 16 个全新匿名合成 Development challenge cases；source text 和 semantic family 不复用 B0、B02、B1、B2。
- 覆盖修订替代、许可与义务、禁止与另行必做、群体例外、已完成前序与当前后续、引用诱饵、条件满足/不满足、同对象链、不同对象链、动作名词化、事件与截止时间、共享说明归属等主线结构。
- Expected 仅为 Codex 单作者参考标签，不是独立人工 GT、真实材料或 Holdout。
- Expected、默认标签、禁选标签和 semantic family 不进入任何未来模型请求投影。

## 固定门槛

- 合同可评分：16/16；Forbidden Default：0。
- Task F1 ≥ 90%；`requiresAction` ≥ 95%；Complete Task Case ≥ 80%。
- 同时完整报告 Task Precision/Recall、动作+对象、语义字段、任务边界、Major Correction、Safe Default Recall 和逐例错误。
- 任一冻结哈希变化、Expected 泄漏、模型/网络/Secret 使用或稳定路径引用均为 `STOP`。

## 执行顺序与停止条件

1. B3-D0：登记计划和边界。
2. B3-D1：生成数据并验证匿名性、唯一性、scope 可构造性和请求隔离。
3. B3-D2：在首次 P1 运行前冻结数据、Expected、P1 和传递依赖并单独提交。
4. B3-G：只运行一次冻结 P1 理想锚点门，生成结果与审计。
5. B3-D3：跑全量工程门、冻结结果、追加日志并关闭阶段。

若首次 B3 未过门，结论固定为 `PAID MODEL BLOCKED`，本轮不修 P1、不改数据、不二次追分。若通过，也只获得“可另行申请付费模型验证”的资格，不代表模型、图片/文件、真人效率或上线通过。
