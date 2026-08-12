# E2.9 Experiment Tracker

| Run ID | 阶段 | 目的 | 模型/样本 | 调用 | 状态 | Gate |
| --- | --- | --- | --- | ---: | --- | --- |
| S0-A | S0 | `/models` + 最小 Pro 兼容性 | Pro / 无用户数据 | 1 | PASS | exact model + fingerprint + JSON + usage |
| S1 | S1 | Preview-only 安全端点 | 无正式样例 | 0 | PASS | flag + host + bearer + allowlist + firewall |
| S2 | S2 | 兼容性冒烟 | Flash+Pro / 3 exposed | 6 observations / 5 completions | FAIL | one non-retryable Flash 401 |
| S3 | S3 | 快速配对筛选 | Flash+Pro / 8 exposed | 0 | BLOCKED_PRE_CALL | frozen 24 lacks information-only/prompt-injection coverage |
| S4 | S4 | 完整 Selection | Flash+Pro / 剩余16 exposed | 0 | NOT RUN | early stop |
| S6 | S6 | 新 Blind | Flash+Pro / 24 new blind | 0 | NOT RUN | early stop; Blind not created |
| S7 | S7 | Preview Browser B1–B4 | Pro candidate | 0 | NOT RUN | early stop |
| S8 | S8 | 独立完整性审计 | 已产生 S0–S3 产物 | 0 | WARN_PROVISIONAL | supports EXPERIMENT BLOCKED |
