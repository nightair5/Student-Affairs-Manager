# P6 Router 校准与质量画像

- 状态：**P6_ROUTER_GATE_PASSED_EXPOSED_DIAGNOSTIC**
- 样例：80 条已暴露诊断样例；80/80 完成，实际策略全部为 `single_pass`。
- Preview Version：`23a2769c-b787-467a-bd7e-614de0211852`；模型 `deepseek-v4-flash`；Prompt `recognition-2.4.1`。
- FactLedger / 两阶段 Planner：未调用；complex 加强模式 Feature Flag 仍关闭。

## Router 指标

| Metric | Result | Gate |
| --- | ---: | ---: |
| Accuracy | 97.50% | >= 75% |
| Complex Recall | 100.00% | >= 85% |
| Under-routing | 0.00% | <= 15% |
| Over-routing | 2.50% | <= 25% |

混淆矩阵：simple→simple 19、simple→medium 1；medium→medium 27、medium→complex 1；complex→complex 32。P6 Router 门槛通过。

## 按预测路由的实际 Path A 画像

| Route | n | Task P | Task R | Material R | Time Role | Time Value | Event | Evidence | Strict Major | Severe | Latency mean / p95 | Tokens input / output |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 19 | 80.00% | 80.00% | 100.00% | 66.67% | 66.67% | 50.00% | 92.59% | 21.05% | 0.00% | 6903 / 8584 ms | 71511 / 22255 |
| medium | 28 | 65.52% | 52.78% | 92.11% | 64.29% | 57.14% | 50.00% | 95.41% | 85.71% | 0.00% | 6947 / 8795 ms | 71925 / 33698 |
| complex | 33 | 86.36% | 74.03% | 96.77% | 84.31% | 82.35% | 100.00% | 99.01% | 75.76% | 0.00% | 11668 / 16449 ms | 128099 / 73196 |

## 解释边界

- Router metrics are calibration results on exposed diagnostic labels and are not Blind evidence.
- All 80 model calls used selectedStrategy=single_pass. Per-route quality, latency and tokens are descriptive complexity profiles, not a causal comparison of different execution strategies.
- The complex intensive candidate remains disabled; no FactLedger or two-stage Planner was called.
- User-impact Major Correction was not re-adjudicated for this P6 run; strict Major Correction is reported and must not be relabeled as user impact.
