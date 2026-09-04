# RCO-5-008 执行跟踪

| Run ID | 目的 | 数据 | 调用 | 状态 |
|---|---|---|---:|---|
| RCO-5-008-C1 | 受控动作头与条件归属 | 属性/对抗夹具 | 0 | PASS |
| RCO-5-008-P4 | 完整命题安全决策 | 属性/对抗夹具 | 0 | PASS |
| RCO-5-008-E2 | scope/ID 评分与 unsafe default | 属性/对抗夹具 | 0 | PASS |
| RCO-5-008-B7-R1 | 回放已见 B7 raw result | 12 cases | 0 | PASS_SEEN_REGRESSION |
| RCO-5-008-B8-FREEZE | 冻结全新未见 B8 | 12 cases | 0 | ELIGIBLE_SEPARATE_STAGE |

固定边界：不修改 B7 Expected/freeze/dataset/checkpoint/raw result/score、旧 contract、P3 或 cache；不接稳定路径、不启动 RCO-6、不部署。
