# E2.9 Experiment Tracker

| Run ID | 阶段 | 目的 | 模型/样本 | 调用 | 状态 | Gate |
| --- | --- | --- | --- | ---: | --- | --- |
| S0-A | S0 | `/models` + 最小 Pro 兼容性 | Pro / 无用户数据 | 1 | TODO | model identity |
| S2 | S2 | 兼容性冒烟 | Flash+Pro / 3 exposed | 6 | BLOCKED_BY_S0 | smoke |
| S3 | S3 | 快速配对筛选 | Flash+Pro / 8 exposed | 16 | BLOCKED_BY_S2 | screening |
| S4 | S4 | 完整 Selection | Flash+Pro / 剩余16 exposed | 32 | BLOCKED_BY_S3 | selection |
| S6 | S6 | 新 Blind | Flash+Pro / 24 new blind | 48 | BLOCKED_BY_S4 | blind |
| S7 | S7 | Preview Browser B1–B4 | Pro candidate | 0 formal eval | BLOCKED_BY_S6 | browser |
| S8 | S8 | 独立完整性审计 | 全部产物 | 0 | BLOCKED_BY_RESULTS | integrity |
