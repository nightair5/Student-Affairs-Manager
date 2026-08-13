# E2.9-R3 Protocol 3.1.0 Experiment Plan

## Scope

R3 is a new Preview-only successor run. It never resumes, edits, scores or reuses R2 observations. The authorized path is Readiness → Smoke → Screening → Scoring, followed by a fresh path-masked review and independent integrity audit. Selection, Candidate Freeze, Blind, E3, E4 and Production deployment are outside scope.

Frozen model behavior remains `recognition-2.4.1`, RecognitionResult Schema 2.0, `recognition-pipeline-2.2.1`, temperature 0, thinking disabled and `max_tokens=6000`. Router and Repair are bypassed/disabled. Expected fixtures and human labels are absent from generation inputs.

## Transport policy

`UPSTREAM_JSON_TRUNCATED` requires all of the following machine evidence:

- the provider attempt received HTTP 200;
- Content-Type is JSON;
- the outer provider response ends inside an unfinished JSON document;
- the outer envelope exposes the exact requested model before `choices`;
- no complete RecognitionResult is available.

Only this status permits one pre-registered retry inside the same observation. Attempt 1 is appended to the server ledger before attempt 2 begins. Attempt 2 cannot overwrite attempt 1, cannot use a new observation ID and cannot be followed by attempt 3.

Complete provider responses containing invalid model JSON or a Schema-invalid RecognitionResult are `MODEL_JSON_INVALID` and are never retried. Authentication, fallback, identity, semantic, integrity and scoring failures are also non-retryable.

## Frozen cardinality and gates

- Readiness: 3 probes per model, 6 observations, one attempt each. Any failure stops R3.
- Smoke: 5 exposed cases × 2 models, 10 observations. All must be `complete` or `complete_after_protocol_retry`.
- Screening: 8 exposed cases × 2 models, 16 observations, starting from 0/16 with new IDs.
- Scoring: expected fixtures are loaded only after the complete checkpoint, server ledger, deployment activation and every frozen hash binding pass.

Because Smoke intentionally overlaps Screening, each deterministic `caseAlias` is phase-scoped (`smoke:<caseId>` or `screening:<caseId>`). The observation ID is derived from `SHA-256(runId:caseAlias:modelAlias)`, so no observation can be reused across phases.

`complete_after_protocol_retry` is scorable, but retries, attempts, truncated attempts, failures and observed attempt latency are reported separately by model. Tokens from an incomplete truncated response remain `NOT_OBSERVABLE`.

## Quality decision

The frozen Screening gate requires Pro Task Recall not below Flash, Task Precision drop no more than 5 percentage points, Evidence Coverage at least 90%, Severe Error no higher than Flash, Prompt Injection PASS, at least 2/8 fresh path-masked pair preferences for Pro, at most 1/8 preferences for Flash, zero fallback and zero final protocol failure.

The path-masked reviewer receives only source text and anonymous X/Y results. The reveal key is generated only after the labels are frozen.

## Security closure

R3 uses a separate Preview route, separate Preview Durable Object service and temporary `E2_V4_PRO_BENCHMARK_TOKEN`. The token exists only in Cloudflare Secret and process memory. At the end the Preview flag returns to false, the endpoint must return 404 and the temporary token must be deleted. The normal `DEEPSEEK_API_KEY` remains untouched. Production is never deployed.
