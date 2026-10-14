# RCO-5-008-B8-M1 真实模型端到端验证

## 结论

- 实验判定：`NO_PROMOTION_PAID_REPLICATION_BLOCKED`
- 原因：至少一项预注册的锚点、端到端任务、危险误勾或修订安全门槛未通过。
- 产品决定：`NO_STABLE_INTEGRATION / RCO-6_NOT_STARTED / NOT_DEPLOYED`
- 证据边界：12 个匿名合成 Development 案例、单一 Codex 作者参考答案；不是独立人工真值、真实材料正确率、真人修改时间、浏览器验收或商业上线证据。

## 运行事实

- model：`deepseek-v4-flash-vision-exp`；temperature：0；thinking：none。
- candidate：12/12；verifier / Repair / retry：0 / 0 / 0。
- 明确终态：12/12；严格 Schema：12/12。
- Provider billed CNY：`NOT_OBSERVABLE`。
- Provider usage：12407 input / 5178 output / 17585 total。
- 按冻结价格上界和 10 CNY/USD 保守换算的已观测代理成本：0.122940 CNY；理论全轮上限 2.205350 CNY，低于 10 CNY 硬上限。

## 预注册主指标

| 指标 | 结果 | 门槛 |
|---|---:|---:|
| Scope Precision / Recall / F1 | 90.9% / 83.3% / 87.0% | 各 100% |
| 动作原文完全正确 | 40.0% | 100% |
| 对象原文完全正确 | 90.0% | 100% |
| 完整锚点案例 | 25.0% | 100% |
| Task Precision / Recall / F1 | 100.0% / 75.0% / 85.7% | 各 100% |
| requiresAction | 83.3% | 100% |
| Complete Task Case | 66.7% | 100% |
| Major Correction | 33.3% | 报告 |
| unsafe default false positive | 0 | 0 |
| Forbidden | 0 | 0 |
| cancels / supersedes / amends | 0.0% / 100.0% / 0.0% | 各 100% |
| 旧要求失效 / 新要求生效 | 33.3% / 100.0% | 各 100% |
| 歧义保持未解析 | 0.0% | 100% |
| stale / selected stale | 0 / 0 | 0 / 0 |

## 失败案例

- rco-task-b8-02: model=completed_valid; anchor=FAIL; TP/FP/FN=1/0/0; task=PASS; unsafe=0; relation=PASS; unresolved=PASS; schema=PASS; composer=PASS
- rco-task-b8-03: model=completed_valid; anchor=FAIL; TP/FP/FN=1/0/0; task=PASS; unsafe=0; relation=PASS; unresolved=PASS; schema=PASS; composer=PASS
- rco-task-b8-04: model=completed_valid; anchor=FAIL; TP/FP/FN=1/0/0; task=PASS; unsafe=0; relation=PASS; unresolved=PASS; schema=PASS; composer=PASS
- rco-task-b8-05: model=completed_valid; anchor=FAIL; TP/FP/FN=2/0/0; task=PASS; unsafe=0; relation=PASS; unresolved=PASS; schema=PASS; composer=PASS
- rco-task-b8-06: model=completed_valid; anchor=FAIL; TP/FP/FN=2/0/0; task=PASS; unsafe=0; relation=PASS; unresolved=PASS; schema=PASS; composer=PASS
- rco-task-b8-07: model=completed_valid; anchor=FAIL; TP/FP/FN=1/0/1; task=FAIL; unsafe=0; relation=PASS; unresolved=PASS; schema=PASS; composer=PASS
- rco-task-b8-09: model=completed_valid; anchor=FAIL; TP/FP/FN=0/0/1; task=FAIL; unsafe=0; relation=FAIL; unresolved=PASS; schema=PASS; composer=ACTION_HEAD_NOT_CONTROLLED:directives[1].action
- rco-task-b8-11: model=completed_valid; anchor=FAIL; TP/FP/FN=1/0/1; task=FAIL; unsafe=0; relation=FAIL; unresolved=FAIL; schema=PASS; composer=PASS
- rco-task-b8-12: model=completed_valid; anchor=FAIL; TP/FP/FN=0/0/2; task=FAIL; unsafe=0; relation=PASS; unresolved=FAIL; schema=PASS; composer=ACTION_HEAD_NOT_CONTROLLED:directives[2].action

## 解释边界

- Expected、语义、风险、requiresAction、修订关系和 selected 从未进入模型请求。
- 模型只选择 scope、动作和对象；最小动作头、条件事实、字符位置、任务状态、安全默认和修订关系均由冻结的本机代码生成。
- 每案只有 1 次 candidate；结构不合格直接记失败，不调用 verifier，不 Repair、不 retry。
- 本轮没有修改冻结数据、Expected、contract、RCO-5-008 组件或 cache，没有接稳定路径、启动 RCO-6 或部署。
