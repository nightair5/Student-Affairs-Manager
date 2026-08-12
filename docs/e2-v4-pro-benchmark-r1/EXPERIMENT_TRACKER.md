# E2.9-R1 Experiment Tracker

| Run ID | 阶段 | 内容 | 调用上限 | 状态 | Gate/备注 |
| --- | --- | --- | ---: | --- | --- |
| R1-P0 | Protocol | Git/tag、hash contract、Smoke/Screening/Selection manifest | 0 | COMPLETE | frozen before calls |
| R1-S1 | Preview | endpoint 2.0、测试、Preview deploy、独立 Secret | 0 | TODO | Production 禁止 |
| R1-AUTH | Readiness | Flash 3 + Pro 3 | 6 | TODO | non-scored |
| R1-S0 | Raw evidence | models + Flash/Pro minimal | 2 completion | TODO | ignored raw cache |
| R1-S2 | Smoke v2 | 5 × 2 | 10 | TODO | compatibility/safety only |
| R1-S3 | Screening v2 | 8 × 2 | 16 | TODO | exposed screening |
| R1-S4 | Selection v2 | remaining 16 × 2 | 32 | BLOCKED_BY_S3 | reuse first 8 |
| R1-S5 | Candidate Freeze | immutable candidate manifest | 0 | BLOCKED_BY_S4 | no variable drift |
| R1-S6 | New Blind | 24 × 2 | 48 | BLOCKED_BY_S5 | not created |
| R1-S8 | Audit/cleanup | tests、Preview disable、secret cleanup、fresh audit | 0 | TODO | final STOP |
