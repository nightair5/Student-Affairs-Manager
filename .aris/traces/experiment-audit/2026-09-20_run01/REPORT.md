# Experiment audit trace

- Reviewer: fresh same-family model agent, ultra reasoning.
- Mode: read-only; no network; no model calls; no file mutation by reviewer.
- Inputs: runner, gateway, budget, scorer, candidate10 teaching package, prepared requests/references, binding/billing/send review, 24 raw, 24 results, comparison, unified ledger, receipt manifest and referenced local dependencies.
- Result: A PASS, B FAIL, C PASS, D FAIL, E FAIL, F PASS; overall strict audit FAIL.
- Main evidence: pairing and accounting closed; full teaching package confounds the example-only claim; scorer has keyword/non-bijective and case-specific gaps; OS04 candidate10 regression; analysis CLI is not long-term idempotent; K-specific failure paths are not verified.
- User-facing route: fix candidate10 OS04 over-inference, separate ablation variables, strengthen structured scorer, then run an independent blind holdout. No Preview/Production authorization.
