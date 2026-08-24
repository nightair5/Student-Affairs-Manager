# E2.9-R10 paired Screening protocol 1.0.0

This bundle turns the already-qualified R10 facts-first architecture into a runnable, Preview-only paired experiment. It does not modify or deploy the Production Worker.

## Experiment

- Run label: `e29r10-screening-20260824-a`
- Sources: 8 exposed complex diagnostic cases from the frozen source-only manifest.
- Observations: 16 immutable, preregistered A/B observations.
- Model: `deepseek-v4-flash` for both arms.
- Parameters: temperature 0, max tokens 6000, thinking disabled, JSON object, one attempt.
- Path A: one frozen `recognition-2.4.1` single-pass call.
- Path B: one FactLedger extraction call, then deterministic bridge, isolated Planner and non-repairing Validator.
- Generation does not import datasets, Expected answers, scorers or review labels.
- Router and Repair are disabled.

## Execution stages

```text
SOURCE_AND_PROTOCOL_FROZEN
  -> LOCAL_ZERO_MODEL_PASS
  -> INDEPENDENT_READ_ONLY_PASS
  -> PREVIEW_VERSION_QUALIFIED_ZERO_CALL
  -> EXPLICIT_MAX_16_CALL_AUTHORIZATION
  -> RUN_REGISTERED
  -> 16 PAIRED OBSERVATIONS OR FIRST FAILURE
  -> GENERATION_FROZEN
  -> STRICT_SCORING
  -> PATH_MASKED_USER_IMPACT_REVIEW
  -> REVEAL
  -> SCREENING_GATE_PASS | SCREENING_GATE_FAIL
```

The Screening Worker has a unique Worker name, no custom route, versioned Preview-only origin enforcement and a Feature Flag. Its service-bound Durable Object ledger is not publicly routed. The Worker token, ledger caller token and DeepSeek API key are server-side Secrets and are absent from Git and local files.

Reservation is the point of no return for an observation. A model, transport, schema, Planner, Validator or Harness failure is finalized as a terminal record. The same `observationId` can never be rerun or overwritten. A partial or failed run therefore cannot be selectively repaired; a new protocol, run label and complete paired run would be required.

The Worker reports requested, returned, execution and result model identities. All four must equal `deepseek-v4-flash`. Path B fails closed unless the FactLedger contract, deterministic Planner and independent ledger-plan Validator all pass.

Selection, Blind and Production endpoints are machine-locked with HTTP 412. A Screening Gate pass does not automatically authorize any later phase.
