# R10 paired Screening protocol 1.1.0

Status: `ARCHIVED_RESEARCH`

Release eligibility: `NOT_FOR_RELEASE`

This checkpoint is preserved for research traceability only. It must not be used as a Product v2 Beta release dependency, resumed for Screening, or deployed to Preview or Production without a separate explicit authorization.

This is a Preview-only, maximum-16-call paired Screening protocol. It supersedes protocol 1.0.0, which failed independent integrity review before any model call.

The generation process reads only the tracked label-free source-input manifest. It cannot read semantic-role labels, Expected answers, scoring modules, path mappings or historical conclusions. Both arms receive the same source input and use the exact same deepseek-v4-flash parameters. Path A performs one frozen single-pass recognition call. Path B performs one FactLedger extraction call, followed only by deterministic validation, bridge, Planner and Validator code.

The server preregisters the exact 16-observation interleaved plan. Observation IDs, indices, arms, case IDs and source/input hashes are frozen. Reservations are sequential, create-once and capped at 16. A failed or expired reservation makes the run terminal and blocks later observations.

The runner accepts only the exact Cloudflare version-preview origin derived from the full Worker version ID and the fixed Workers domain. Before a Bearer token can be sent, the endpoint, deployment evidence, clean Git commit/tree and independent readiness review must all match.

Scoring is unavailable until the generation checkpoint, deployment evidence, contract response, fresh registration and final Durable Object state form one closed hash chain with all 16 immutable complete observations. Only then may the scorer load exposed Expected fixtures.

The reviewer packet uses neutral schemas and an allowlist projection. It contains no generation hashes, model/path identity, scores or Expected data. A salted mapping commitment is published before review; labels bind the exact packet and audit bytes. Reveal and Gate recompute the mapping commitment and reconstruct every anonymous option from the frozen checkpoint.

Selection, Blind and Production remain machine-locked. A Screening Gate pass only permits a separate request for Selection authorization.
