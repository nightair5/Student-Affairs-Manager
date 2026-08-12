# E2.9-R1 Experiment Tracker

| Run ID | 阶段 | 内容 | 调用上限 | 状态 | Gate/备注 |
| --- | --- | --- | ---: | --- | --- |
| R1-P0 | Protocol | Git/tag、hash contract、Smoke/Screening/Selection manifest | 0 | COMPLETE | frozen before calls |
| R1-S1 | Preview | endpoint 2.0、测试、Preview deploy、独立 Secret | 0 | COMPLETE | Preview only; Production untouched |
| R1-AUTH | Readiness | Flash 3 + Pro 3 | 6 | PASS | 6/6 non-scored |
| R1-S0 | Raw evidence | models + Flash/Pro minimal | 2 completion | PASS | ignored raw cache + committed hashes |
| R1-S2 | Smoke v2 | 5 × 2 | 10 | PASS | 10/10 complete |
| R1-S3 | Screening v2 | 8 × 2 | 16 | V4_PRO_SCREENING_V2_FAIL | 14/16 harness-complete; pure-info pair false-failed `BASIC_CONTENT_EMPTY` |
| R1-S4 | Selection v2 | remaining 16 × 2 | 32 | NOT RUN | blocked by S3; zero calls |
| R1-S5 | Candidate Freeze | immutable candidate manifest | 0 | NOT CREATED | blocked by S3 |
| R1-S6 | New Blind | 24 × 2 | 48 | NOT RUN | zero calls |
| R1-S8 | Audit/cleanup | tests、Preview disable、secret cleanup、fresh audit | 0 | IN PROGRESS | cleanup PASS; fresh audit pending |

Final status: `V4_PRO_SCREENING_V2_FAIL`. Quality conclusion: `NOT AVAILABLE`.
