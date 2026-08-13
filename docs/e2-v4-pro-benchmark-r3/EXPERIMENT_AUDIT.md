# E2.9-R3 Independent Experiment Audit

This file records the final findings returned by a fresh independent read-only audit agent; the primary executor only structured that returned result after the auditor was interrupted before file output.

## Verdict

`FAIL`

- Final experiment state: `EXPERIMENT BLOCKED`
- Quality conclusion: `NOT_AVAILABLE`
- Pro vs Flash inference: prohibited
- Selection / Candidate Freeze / Blind: `NOT RUN / NOT CREATED`

## Critical finding

The path-masked packet contains `result.modelName` in all 16 anonymous X/Y result objects across eight pairs. It directly exposes `deepseek-v4-pro` and `deepseek-v4-flash` before adjudication. The fresh reviewer correctly recorded all eight pairs as `INSUFFICIENT_INFORMATION`.

This is an irreversible path-masking integrity failure. Semantic preferences and the pair-preference gate are invalid. The generated `V4_PRO_SCREENING_V3_FAIL` file is retained as a machine blocking record, but it must not be interpreted as a model-quality failure. Protocol integrity failure takes precedence.

## Independently reproduced checks

- Protocol/run/bundle were frozen before calls: run manifest at 07:02:51Z, final activation at 07:07:54Z, first Readiness call at 07:08:40Z.
- Run self-hash and source, Readiness, Smoke, Screening, and bundle manifest bindings match.
- Schema, Prompt/Pipeline, scorer, dataset, and Protocol/Deployment bundles all recompute to the frozen hashes.
- Observation plan contains 32 unique IDs with phase cardinality 6/10/16.
- Actual record contains 32 observations and 32 attempts; all completed on attempt 1, with no retry, third attempt, or observation replacement.
- Requested, returned, execution, and result model names match for all observations; semantic role, deployment, Prompt, Schema, and Pipeline bindings also match.
- Screening checkpoint is `GENERATION_COMPLETE`; ledger is `COMPLETE` at `SCORING_OPEN`.
- Expected-answer generation firewall has code and test coverage. Expected fixtures load only after complete integrity checks.
- Strict metrics independently reproduce the aggregate exactly.
- Tokens reproduce as Flash 34,455 and Pro 33,962.
- Cumulative final-attempt latency reproduces as Flash 72,099 ms and Pro 129,520 ms.
- R3 non-model protocol tests pass 18/18.
- Live cleanup check: R3 endpoint HTTP 404; Secret list contains only `DEEPSEEK_API_KEY`; temporary benchmark bearer is absent.
- Production latest deployment remains `3b6d6ba2-e21f-495c-80e4-c4bac62366be` from 2026-08-08.

## Limitations

- Cloudflare Secret verification is name-only; secret plaintext was not and must not be read.
- The independent audit reran the focused 18-test R3 protocol suite, not the entire npm suite. The primary execution separately recorded the full suite before Preview calls.
- The auditor did not call a model, deploy, modify a Secret, or rerun an observation.

## Required disposition

Do not infer that Pro is better, equal, or worse than Flash from R3. Fix and test recursive removal of all provider/model lineage fields from future blind packets, then obtain new authorization for any successor experiment. Do not repair this frozen run by relabeling or selective rerun.
