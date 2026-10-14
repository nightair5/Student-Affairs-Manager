# experiment-audit trace

- Date: 2026-09-15
- Scope: baseline-hard-corrections-20260915a
- Reviewer task: `/root/hard_correction_experiment_audit`
- Reviewer model family: gpt-5.6-sol
- Reviewer effort: ultra
- Independence: same-family provisional
- Mode: read-only
- Initial verdict: FAIL because replay did not execute against the frozen reference.
- Remediation: bind and hash-check `REFERENCES_FINAL.json`, validate source fingerprints, compute denominators, and bind task outcomes to the existing per-case adjudication.
- Final verdict: PASS_WITH_WARNINGS
- Evaluation type: synthetic_proxy + simulation_only
- Remaining limitations: old 3/4 correction-summary mismatch is disclosed; some command logs are summary-only; real browser acceptance is NOT_RUN.
- Business model calls: 0
- Protected inputs modified: false
