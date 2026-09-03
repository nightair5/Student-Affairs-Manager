# RCO-5-004 proposition graph V3 fresh audit

**Verdict:** `FAIL / REJECT_CANDIDATE / NO_PROMOTION`

The frozen candidate passed 59 registered tests, but “请上传Access Token文件。” could still become selected. The sensitive-term list omitted the English token phrase, while the material allowlist accepted the generic suffix “文件”.

This showed that object-name allowlisting plus a finite sensitive lexicon could not establish transfer safety. RCO-G5 quality remained `NOT_RUN`; no business model call, stable-path integration or deployment occurred.
