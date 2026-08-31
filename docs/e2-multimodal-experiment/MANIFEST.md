# E2-MM Output Manifest

| 文件 | 作用 | 状态 |
|---|---|---|
| `2026-08-31_EXPERIMENT_PLAN.md` | 冻结的日期版本、三臂协议、门槛与运行顺序 | FROZEN |
| `EXPERIMENT_PLAN.md` | 当前入口与门槛摘要 | CURRENT |
| `EXPERIMENT_TRACKER.md` | 逐里程碑运行状态 | CURRENT |
| `PRIVACY_SECURITY_BROWSER_ACCEPTANCE.md` | A–J 阻断式验收矩阵 | CURRENT |
| `PREVIEW_DEPLOYMENT.md` | 独立 Preview、工程门槛与发布隔离证据 | CONFIGURED_PRE_RUN |
| `SYNTHETIC_UNSEEN_V1_FREEZE.json` | 36 条匿名合成未见材料、OCR 与 Expected 的运行前哈希冻结 | FROZEN_BEFORE_MODEL_CALLS |
| `2026-08-31_EXPERIMENT_PLAN_V2.md` | 同模型三臂、严格图片隔离、聚类推断与 fail-closed 评分修订 | CURRENT_PRE_REGISTRATION |
| `SYNTHETIC_UNSEEN_V2_FREEZE.json` | 第二批新材料、OCR 与 Expected 的逐例哈希冻结 | FROZEN_BEFORE_MODEL_CALLS |
| `2026-08-31_DIRECT_IMAGE_REPLICATION_PLAN.md` | 第三批未见材料的直接图片识别复验方案与判定边界 | CURRENT_PRE_REGISTRATION |
| `SYNTHETIC_UNSEEN_V3_IMAGE_ONLY_FREEZE.json` | 第三批新材料、OCR 与 Expected 的逐例哈希冻结 | FROZEN_BEFORE_MODEL_CALLS |

真实材料、图片、Expected、参与者信息、原始模型输出、密钥与授权头均不得进入此目录或 Git。
