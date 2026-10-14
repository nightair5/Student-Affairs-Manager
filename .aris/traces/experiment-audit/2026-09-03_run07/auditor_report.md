# RCO-5-003 facts-1.5 fresh audit

**Verdict:** `FAIL / REJECT_CANDIDATE / NO_PROMOTION`

The frozen candidate's exact character offsets, parser segments, relation envelopes, shared-schema composition, evidence offsets and stable-path isolation were verified. However, a ledger could omit later corrections or neighboring entities and still produce selected facts.

Reproduced classes included `不再` and `撤销` bypasses, heading-like action phrases, corrected task/event times, corrected event locations and material attributes, expanded non-temporal raw-time spans, cross-action constraints, quantity-range compression, duplicate event-start roles, event time types attached to actions, unverified material-required state, and untrusted source metadata entering project suggestions.

The 27 registered contract fixtures passed, but that only established those assertions. The candidate was rejected and superseded by a new frozen candidate; `RCO-G5 QUALITY NOT_RUN`, `RCO-6 BLOCKED`, `NO_PROMOTION`, and `DO_NOT_LAUNCH` remained unchanged.
