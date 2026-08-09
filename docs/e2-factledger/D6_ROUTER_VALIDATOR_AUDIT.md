# E2.5 D6：Router / Validator 独立标签审计

## 范围与方法

- Router Set：60 条，`simple=10`、`medium=22`、`complex=28`；
- Validator Issue Set：同一批 60 条已暴露样例，但独立逐条查看原文和 `recognition-2.4.1` 最终输出后进行多标签标注；
- 所有样例均为 `EXPOSED_DIAGNOSTIC_ONLY`，不能作为 Blind；
- 合并同截止、同渠道交付物若仍完整可执行，不标 `MISSING_TASK`；
- Validator 只审计用户要求的五类问题，`NO_ISSUE` 表示这五类均不存在，不代表输出所有字段都正确；
- 评测直接重新运行 `recognition-router-1.1.0` 和 `recognition-quality-2.1.0`，不以是否触发 Repair 代替正确性。

机器可读标签与逐例预测见：

- `d6-router-labels.json`
- `d6-validator-labels.json`
- `d6-metrics.json`

## Router 结果

| 指标 | 结果 |
| --- | ---: |
| 样例数 | 60 |
| Accuracy | 45.00% (27/60) |
| 全部 Under-routing | 48.33% (29/60) |
| 全部 Over-routing | 6.67% (4/60) |
| Complex → Simple | 3.57% (1/28) |
| Simple → Complex | 0.00% (0/10) |

混淆矩阵：

| 人工标签 → Router | simple | medium | complex |
| --- | ---: | ---: | ---: |
| simple | 6 | 4 | 0 |
| medium | 13 | 9 | 0 |
| complex | 1 | 15 | 12 |

极端的 `complex → simple` 只有 `e2-gen-20-2` 一条，但这不能掩盖大量相邻级别低路由：28 条 complex 中有 15 条被判为 medium，22 条 medium 中有 13 条被判为 simple。当前 Router 主要依赖表面计数，对“事件结束后次日”“名单公布后 48 小时”“旧截止被新截止替代”等关系复杂度不敏感。

## Validator 结果

Validator 人工集中有 36 条 `NO_ISSUE`，其余 24 条共 37 个真实 issue；当前 Validator 仅预测 12 个 issue。

| 指标 | 结果 |
| --- | ---: |
| Micro Precision | 50.00% (6 / 12) |
| Micro Recall | 16.22% (6 / 37) |
| NO_ISSUE specificity | 83.33% (30 / 36) |

| Issue | TP | FP | FN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| MISSING_TASK | 4 | 0 | 5 | 100.00% | 44.44% |
| MISSING_TIMEPOINT | 1 | 5 | 2 | 16.67% | 33.33% |
| WRONG_TIME_ROLE | 0 | 0 | 11 | 0.00% | 0.00% |
| MISSING_AMBIGUITY | 0 | 1 | 10 | 0.00% | 0.00% |
| EVENT_TASK_CONFUSION | 1 | 0 | 3 | 100.00% | 25.00% |

## 契约缺口

1. 当前 Validator 没有直接的 `WRONG_TIME_ROLE` 检查；`FALSE_PRECISION` 只覆盖哨兵值或相对/模糊时间的非法归一化，无法检查 registration/submission/event 等业务角色。
2. `MISSING_TIME_AMBIGUITY` 只检查已被建模成 relative/vague 的 TimePoint；若 Planner 先把“暂定”“条件适用”错误地标成精确事实，Validator 不会反向发现语义缺失。
3. `MISSING_ACTION` 仅在零 Task 且正则命中动作线索时触发，无法发现部分漏 Task，也无法识别“回复”被改成“参加”。
4. `MISSING_EVENT` 只检查有限 Event 正则，不能完整判断一个事实应同时形成 Event 和 Task。
5. `MISSING_TIMEPOINT` 的表面 token 对齐产生 5 个 false positive，包括信息期、时间范围和 Event 已有时间的表达差异。

## D6 结论

当前 Router 与 Validator 都不足以成为安全的两阶段启用门槛。后续若正式实施，应先让它们消费显式 FactLedger 的关系、角色、条件和证据，而不是继续扩充来源正文正则；本阶段不修改其生产实现。
