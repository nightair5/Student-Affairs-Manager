# RCO-5-002 facts-1.3 fresh audit

**Verdict:** `FAIL / FAIL_CROSS_ENTITY_SEMANTIC_GROUNDING_BYPASSES_REPRODUCED`

The frozen `facts-1.3` candidate closed the exact `facts-1.1` and `facts-1.2` regressions, but the reviewer reproduced six same-clause semantic-grounding bypasses: distant cancellation, result-publication date relabeled as a deadline, neighboring-material format borrowing, neighboring-event location borrowing, reading text misclassified as a required material, and optionality borrowed from a different material.

The candidate is rejected. The next candidate must use controlled relation predicates rather than co-occurrence alone. `RCO-G5 QUALITY NOT_RUN`, `RCO-6 BLOCKED`, `NO_PROMOTION`, and `DO_NOT_LAUNCH` remain unchanged.
