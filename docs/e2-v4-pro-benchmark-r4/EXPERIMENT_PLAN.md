# E2.9-R4 Protocol 3.2.0

R4 is a fresh, Preview-only successor experiment. It does not reuse R3 observations, identifiers, labels, mappings, packets, or adjudications. R3 remains frozen at `73b507e` with `EXPERIMENT BLOCKED` and quality `NOT_AVAILABLE`.

## Threat model and isolation

The human reviewer must not be able to identify the model behind X or Y from direct lineage, nested metadata, arbitrary string values, performance side channels, filenames, case identifiers, or mapping chronology. The packet is built by explicit business-field projection; a recursive registry scanner rejects forbidden keys and values before any packet is emitted.

The packet excludes model/provider/fingerprint fields, execution and transport metadata, request/deployment identifiers, prompt/pipeline versions, raw responses, retry information, latency, usage, token counts, and finish reason. Case identifiers are replaced with `review-case-NNN`.

X/Y assignment is independently derived per case from a 64-character-or-longer in-memory reveal secret. Only a one-way assignment commitment is included before adjudication. No mapping key is created until the labels file has been completed and hashed. Reveal requires `labelsCompletedAt < keyRevealedAt` and verifies every commitment.

Expected answers and strict scores are excluded from generation and human adjudication. Strict scoring is a separate post-generation process and is bound to the frozen manifest, Prompt, Schema, protocol bundle, and complete checkpoint hashes.

## Stage machine

`READINESS_OPEN -> SMOKE_OPEN -> SCREENING_OPEN -> PATH_MASK_PREVIEW_OPEN -> ADJUDICATION_OPEN -> SCORING_OPEN -> COMPLETE`

Every transition is fail-closed. Readiness is 3 probes per model; Smoke is 5 cases x 2 models; Screening is 8 cases x 2 models. Only a first `UPSTREAM_JSON_TRUNCATED` response with the registered evidence may receive one protocol retry. No failed observation may be overwritten or rerun under the same ID.

After Screening: generate a packet preview, require zero leaks, obtain a fresh path-identification review, then freeze the formal packet and fresh human labels. Only after labels freeze may the mapping be revealed and strict scoring run. Selection and Blind are not authorized.

## Security

The endpoint exists only on an isolated Cloudflare Preview deployment behind `E2_R4_BENCHMARK_ENABLED=true`, exact-Origin checking, and a temporary Bearer secret held only in process/Cloudflare Secret storage. The normal Preview and Production configurations keep the R4 flag false. Cleanup disables the Preview flag, verifies 404, deletes only the temporary bearer, retains `DEEPSEEK_API_KEY`, performs a secret scan, and confirms Production was not deployed.

## Stop conditions

Any path leak, chronology error, hash mismatch, unexpected rerun, lineage failure, observation corruption, invalid prerequisite, or independent-audit FAIL yields `EXPERIMENT BLOCKED` and the recommendation: "Benchmark infrastructure needs redesign before further model calls." No R5 is started automatically.
