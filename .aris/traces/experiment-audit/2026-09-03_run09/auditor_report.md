# RCO-5-003 facts-1.7 fresh audit

**Verdict:** `FAIL / REJECT_CANDIDATE / NO_PROMOTION`

The final frozen candidate passed all 52 registered contract fixtures and its four hashes matched. A fresh, unregistered counterexample still passed ledger validation and the shared result schema:

```text
请提交家庭经济困难认定表。想确认一下，家庭经济困难认定表为必交？
```

By spanning only `家庭经济困难认定表为必交`, the candidate omitted the preceding question cue and terminal question mark. The composer produced a selected task and a selected, required material. Exact offsets therefore established where the selected words occurred but not whether the full proposition asserted, questioned, negated or revised them.

Exact offset/sourceId handling, required user confirmation and stable-path isolation passed structurally. The candidate is rejected. `RCO-G5 QUALITY NOT_RUN`, `RCO-6 BLOCKED`, `NO_PROMOTION`, and `DO_NOT_LAUNCH` remain unchanged.
