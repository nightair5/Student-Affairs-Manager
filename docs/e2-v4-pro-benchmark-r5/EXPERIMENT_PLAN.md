# E2.9-R5 Protocol 3.3.0

R5 is a fresh, Preview-only successor experiment. It does not reuse any R1-R4 observation, identifier, run label, checkpoint, mapping, packet, adjudication, score, or model output. Earlier runs remain historical protocol evidence only; they cannot support an R5 quality claim.

Protocol artifacts may be frozen only from a clean Git worktree. The frozen implementation commit, complete deployment-chain bundle, manifests, run label, phase labels, and observation IDs must all be new and mutually bound before Preview activation.

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

The endpoint exists only on an isolated Cloudflare Preview deployment behind `E2_R5_BENCHMARK_ENABLED=true`, exact-Origin checking, and a fresh temporary `E2_R5_BENCHMARK_TOKEN` Bearer secret held only in process/Cloudflare Secret storage. The normal Preview and Production configurations keep the R5 flag false. The R5-only activation configuration exposes no earlier experiment ledger bindings. Cleanup disables the Preview flag, verifies 404, deletes only the temporary R5 bearer, retains `DEEPSEEK_API_KEY`, performs a secret scan, and confirms Production was not deployed.

## Stop conditions

Any dirty freeze, path leak, chronology error, hash mismatch, unexpected rerun, lineage failure, observation corruption, invalid prerequisite, or independent-audit FAIL yields `EXPERIMENT BLOCKED` and the recommendation: "Benchmark infrastructure needs redesign before further model calls." No Preview activation, model phase, Selection, or Blind starts automatically.
