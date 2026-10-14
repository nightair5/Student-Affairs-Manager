# RCO-5-006-B1-M1 真实模型验证报告

## 结论

- 实验判定：`INVALID_RUN`
- 原因：candidate 未达到 12/12 Schema 合格，或应调用 verifier 未全部完成且 Schema 合格。
- 产品决定：`NO_PROMOTION / DO_NOT_LAUNCH`
- 证据边界：12 个匿名合成 Development 案例、单一 Codex 作者参考答案；不是独立人工真值、真实材料、真人修改时间、浏览器验收或上线证据。

## 运行事实

- model：`deepseek-v4-flash-vision-exp`
- temperature：`0`
- candidate：1/12
- verifier：0/最多 12
- 总请求：1/24
- 确认回执：0
- 回执未知：1
- 上游不合格而跳过 verifier：0
- Repair / retry：0 / 0
- Provider billed cost：`NOT_OBSERVABLE`
- Token：不完整（0/1 个请求返回 usage）
- 保守峰值代理成本：NOT OBSERVABLE
- 全轮理论上限：8.504602 CNY，低于 10 CNY 硬上限

## 主指标

| 指标 | 结果 | 门槛 |
|---|---:|---:|
| candidate Schema | 0/12 | 12/12 |
| verifier Schema | 0/12 | 12/12 应调用项 |
| scope Precision | N/A | 报告 |
| scope Recall | N/A | 报告 |
| scope F1 | N/A | ≥90% |
| requiresAction | 0.0% | ≥95% |
| 关键语义最低轴 | 0.0% | ≥90% |
| 完整语义 bundle | N/A | ≥85% |
| Complete Case | 0.0% | ≥75% |
| Forbidden Default | 0 | 0 |
| Safe Default Recall | N/A | ≥90% |
| Missed Safe Default | 0 | 报告 |

## 语义分轴

| 轴 | 正确率 |
|---|---:|
| actor | N/A |
| speechAct | N/A |
| polarity | N/A |
| tense | N/A |
| status | N/A |
| validity | N/A |
| modality | N/A |
| inferenceLevel | N/A |
| actionType | N/A |
| effect | N/A |

## 字段引用

| 字段 | 完全匹配率 |
|---|---:|
| action | N/A |
| object | N/A |
| time | N/A |
| material | N/A |
| event | N/A |
| location | N/A |
| revision | N/A |

## 逐例状态

| 案例 | candidate | candidate Schema | verifier | verifier Schema | Complete Case |
|---|---|---|---|---|---|
| rco-scope-b1-01 | transport_failure | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-02 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-03 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-04 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-05 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-06 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-07 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-08 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-09 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-10 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-11 | missing | FAIL | missing | FAIL | FAIL |
| rco-scope-b1-12 | missing | FAIL | missing | FAIL | FAIL |

## 解释边界

- Expected、默认标签和 forbidden 标签从未进入模型请求，只在本机评分时读取。
- 模型只输出 scope ID 与受控语义；原文位置、逐字证据、关系和 selected 均由本机构造。
- candidate 不合格即不调用 verifier；失败保留在固定分母，不 Repair、不 retry。
- candidate 与 verifier 虽有独立 run ID，但使用同一供应商和同一模型，不等于独立人工复核。
- 本轮未修改稳定路径，未启动 RCO-6，未部署。
