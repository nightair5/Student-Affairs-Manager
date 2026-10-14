# RCO-5-002 facts-1.4 fresh audit

**Verdict:** `FAIL / FAIL_CONTROLLED_RELATION_GROUNDING_BYPASSES_REPRODUCED`

The frozen candidate passed 54 registered contract cases but still accepted selected facts created by same-clause entity substitution, later cancellation, expanded raw-time text, description borrowing, entity substrings and nominalized action aliases. The reviewer reproduced these outcomes through an in-memory, no-write execution bound to the frozen component hashes.

The result establishes a design limit: quote membership, sentence splitting and controlled lexical patterns can reject known examples, but cannot prove semantic ownership of a field or relation. The candidate is rejected. The next architecture must carry parser-verified source spans and typed relation assertions, leaving ambiguous ownership unlinked and unselected.

`RCO-G5 QUALITY NOT_RUN`, `RCO-6 BLOCKED`, `NO_PROMOTION`, and `DO_NOT_LAUNCH` remain unchanged.
