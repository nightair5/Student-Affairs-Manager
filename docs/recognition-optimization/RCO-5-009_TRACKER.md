# RCO-5-009 执行跟踪

| Run ID | 目的 | 数据 | 模型调用 | 状态 |
|---|---|---|---:|---|
| RCO-5-009-C1 | 本机动作/对象候选目录 | 定向与属性夹具 | 0 | PASS |
| RCO-5-009-S1 | 候选分类严格合同 | 篡改/缺失/重复夹具 | 0 | PASS |
| RCO-5-009-C2 | 局部 composer 与 quarantine | 对抗夹具 | 0 | PASS |
| RCO-5-009-B8-R1 | 已见 B8 oracle + frozen raw 分层回归 | 12 cases | 0 | PASS_SEEN_NOT_MODEL_REPLICATION |
| RCO-5-009-B9-F1 | 全新 B9 首次本机门 | 新匿名 cases | 0 | ELIGIBLE_AFTER_COMPONENT_FREEZE_COMMIT_PUSH |

固定边界：不修改 B8 或任何既有 Expected/freeze/dataset/checkpoint/cache、RCO-5-008 组件和稳定路径；不调用模型、不读取 Secret、不启动 RCO-6、不部署。

动态事实：B8 旧模型候选 P/R/F1 为 90%/90%/90%（18 个真候选、2 个漏项、2 个伪修订动作）；新本机链路的 oracle 与 legacy-salvage 产品结果均为 Task F1/Complete 100%，但本机恢复不计入模型正确率。
