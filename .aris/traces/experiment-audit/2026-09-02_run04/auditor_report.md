# RCO-5-002 facts-1.2 fresh audit

**Verdict:** `FAIL / CONTRACT_RELATION_AND_GROUNDING_BYPASSES_REPRODUCED`

The frozen `facts-1.2` candidate rejected the six exact `facts-1.1` counterexamples, but the reviewer reproduced the same classes by combining unrelated sentences into one source-valid evidence quote. It also reproduced noun-substring actions, negated actions, description laundering, partial quantity matching, incompatible event time roles, selected dependencies of optional actions, and missing runtime reference-time/timezone acceptance.

The candidate is rejected. `RCO-G5 QUALITY NOT_RUN`, `RCO-6 BLOCKED`, `NO_PROMOTION`, and `DO_NOT_LAUNCH` remain unchanged. Component identities and detailed findings are recorded in `docs/recognition-optimization/RCO-5_REPAIR_V2_COMPONENT_FREEZE.json` and the append-only optimization log.
