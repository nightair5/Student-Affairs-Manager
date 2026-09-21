# Candidate11 B2 Development 消融评测

状态：`B2_DEVELOPMENT_RESULTS_READY_FOR_REVIEW`。

本批严格执行 24 个冻结请求；结果仅用于已见 Development 工程筛选，不是独立 Holdout、真人试用或识别转化率。

候选决定：`REJECT_CANDIDATE11`。

| 变体 | 完整来源 | TP / FP / FN | P / R / F1 | Major | Severe | Forbidden | 教学例越界 |
|---|---:|---:|---:|---:|---:|---:|---:|
| V00 | 0/6 | 0 / 0 / 13 | NA / 0.00% / 0.00% | 14 | 7 | 6 | 0 |
| V10 | 0/6 | 0 / 0 / 13 | NA / 0.00% / 0.00% | 14 | 7 | 6 | 0 |
| V01 | 0/6 | 0 / 0 / 13 | NA / 0.00% / 0.00% | 14 | 7 | 6 | 0 |
| V11 | 0/6 | 0 / 0 / 13 | NA / 0.00% / 0.00% | 14 | 7 | 6 | 0 |

描述性效应：M（无 E / 有 E）=0 / 0；E（无 M / 有 M）=0 / 0；M×E=0。

实际调用：24；本地可审计费用上界：CNY 0.523928；provider 实际扣费：NOT_OBSERVABLE。

账本：693 行，SHA-256 `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`，tail `13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd`。

历史 RCO-5-007 保留：`FREEZE_HASH_MISMATCH:package-lock.json`。
