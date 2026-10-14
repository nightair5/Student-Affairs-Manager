# RCO-5-006-B1-M1 真实模型验证报告

## 结论

- 实验判定：`INVALID_RUN`
- 原因：candidate 未达到 12/12 Schema 合格，或应调用 verifier 未全部完成且 Schema 合格。
- 产品决定：`NO_PROMOTION / DO_NOT_LAUNCH`
- 证据边界：12 个匿名合成 Development 案例、单一 Codex 作者参考答案；不是独立人工真值、真实材料、真人修改时间、浏览器验收或上线证据。
- 计分口径：契约不合格案例按全错进入固定分母，下面是 fail-closed 产品下界；由于整轮 `INVALID_RUN`，不得把这些诊断数字宣传为正式模型准确率。

## 运行事实

- model：`deepseek-v4-flash-vision-exp`
- temperature：`0`
- candidate：12/12
- verifier：10/最多 12
- 总请求：22/24
- 确认回执：22
- 回执未知：0
- 上游不合格而跳过 verifier：2
- Repair / retry：0 / 0
- Provider billed cost：`NOT_OBSERVABLE`
- Token：63036 input / 20761 output / 83797 total
- 保守峰值代理成本：0.551404 CNY
- 全轮理论上限：8.504602 CNY，低于 10 CNY 硬上限

## 主指标

| 指标 | 结果 | 门槛 |
|---|---:|---:|
| candidate Schema | 10/12 | 12/12 |
| verifier Schema | 9/12 | 12/12 应调用项 |
| scope Precision | 68.4% | 报告 |
| scope Recall | 59.1% | 报告 |
| scope F1 | 63.4% | ≥90% |
| requiresAction | 83.3% | ≥95% |
| 关键语义最低轴 | 29.4% | ≥90% |
| 完整语义 bundle | 8.8% | ≥85% |
| Complete Case | 0.0% | ≥75% |
| Forbidden Default | 0 | 0 |
| Safe Default Recall | 70.0% | ≥90% |
| Missed Safe Default | 3 | 报告 |

## 语义分轴

| 轴 | 正确率 |
|---|---:|
| actor | 61.8% |
| speechAct | 67.6% |
| polarity | 58.8% |
| tense | 29.4% |
| status | 47.1% |
| validity | 64.7% |
| modality | 70.6% |
| inferenceLevel | 70.6% |
| actionType | 63.6% |
| effect | 68.2% |

## 字段引用

| 字段 | 完全匹配率 |
|---|---:|
| action | 68.2% |
| object | 54.5% |
| time | 58.8% |
| material | 40.9% |
| event | 68.2% |
| location | 61.8% |
| revision | 63.6% |

## 逐例状态

| 案例 | candidate | candidate Schema | verifier | verifier Schema | Complete Case |
|---|---|---|---|---|---|
| rco-scope-b1-01 | completed | FAIL | skipped_upstream_invalid | FAIL | FAIL |
| rco-scope-b1-02 | completed | PASS | completed | PASS | FAIL |
| rco-scope-b1-03 | completed | PASS | completed | PASS | FAIL |
| rco-scope-b1-04 | completed | FAIL | skipped_upstream_invalid | FAIL | FAIL |
| rco-scope-b1-05 | completed | PASS | completed | PASS | FAIL |
| rco-scope-b1-06 | completed | PASS | completed | PASS | FAIL |
| rco-scope-b1-07 | completed | PASS | completed | PASS | FAIL |
| rco-scope-b1-08 | completed | PASS | completed | PASS | FAIL |
| rco-scope-b1-09 | completed | PASS | completed | FAIL | FAIL |
| rco-scope-b1-10 | completed | PASS | completed | PASS | FAIL |
| rco-scope-b1-11 | completed | PASS | completed | PASS | FAIL |
| rco-scope-b1-12 | completed | PASS | completed | PASS | FAIL |

## 解释边界

- Expected、默认标签和 forbidden 标签从未进入模型请求，只在本机评分时读取。
- 模型只输出 scope ID 与受控语义；原文位置、逐字证据、关系和 selected 均由本机构造。
- candidate 不合格即不调用 verifier；失败保留在固定分母，不 Repair、不 retry。
- candidate 与 verifier 虽有独立 run ID，但使用同一供应商和同一模型，不等于独立人工复核。
- 本轮未修改稳定路径，未启动 RCO-6，未部署。
