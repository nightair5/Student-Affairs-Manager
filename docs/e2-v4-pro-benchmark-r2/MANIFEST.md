# E2.9-R2 Artifact Manifest

| Artifact | Role | Status |
|---|---|---|
| `EXPERIMENT_PLAN.md` | protocol 3.0.0 preregistration | FROZEN BEFORE CALLS |
| `HASH_CONTRACT.md` | reproducible binding contract | FROZEN BEFORE CALLS |
| `readiness-manifest.json` | two-model readiness plan | GENERATED BEFORE CALLS |
| `smoke-manifest.json` | 5-case role-aware Smoke plan | GENERATED BEFORE CALLS |
| `screening-manifest.json` | 8-case role-aware Screening plan | GENERATED BEFORE CALLS |
| `bundle-hash-manifest.json` | prompt/schema/scorer/protocol/deployment bundle bindings | GENERATED BEFORE CALLS |
| `run-manifest.json` | fresh run labels, observation IDs and state machine | GENERATED BEFORE CALLS |
| `preview-activation.json` | deployed version binding | PENDING DEPLOYMENT |
| `screening-aggregate.json` | anonymous aggregate | NOT RUN |
| `SCREENING_REPORT.md` | final Screening report | NOT RUN |

原始输入、响应、逐例评分及 checkpoints 均保留在 Git ignored `.evaluation-cache/e2-9-r2/protocol-3.0.0/`。
