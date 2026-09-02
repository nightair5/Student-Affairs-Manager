# RCO-5-002 facts-1.1 fresh audit

**Verdict:** `FAIL / CONTRACT_PROVENANCE_LAUNDERING_REPRODUCED`

The read-only same-family reviewer reproduced six invalid ledgers accepted by the `facts-1.1` candidate:

1. material attributes pooled from a different material;
2. an unrelated time bound to an action;
3. an unrelated constraint bound to an action;
4. a location pooled from a different event;
5. an optional action accepted without textual object support;
6. fabricated evidence accepted when runtime `sourceContent` was absent.

Positive controls for `requiresAction=false + explicit event`, required `sourceId`, versioning, corrected audit path and blocked quality gates passed. The candidate is rejected; `RCO-G5 QUALITY NOT_RUN`, `RCO-6 BLOCKED`, and `NO_PROMOTION` remain unchanged.
