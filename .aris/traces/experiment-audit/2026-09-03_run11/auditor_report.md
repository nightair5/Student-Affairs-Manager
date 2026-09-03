# RCO-5-004 proposition graph V2 fresh audit

**Verdict:** `FAIL / REJECT_CANDIDATE / NO_PROMOTION`

The frozen candidate passed 56 registered tests, but “API K\u200Bey” bypassed sensitive-content matching through an invisible format character. The two-sentence case “请上传附件。附件是API Key，必须提交。” also let a sensitive material proposition ride through a superficially harmless attachment relation.

The candidate did not safely normalize hostile text or prevent relation-level laundering. RCO-G5 quality remained `NOT_RUN`; no business model call, stable-path integration or deployment occurred.
