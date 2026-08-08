# E2-A recognition baseline audit

## Frozen production baseline

| Item | Audited value |
| --- | --- |
| Result schema | `RecognitionResult 2.0` |
| Prompt version | `recognition-2.0.0` |
| Model identifier | `deepseek-v4-flash` |
| Production route | same-origin `POST /api/deepseek/extract` |
| Production status route | `GET /api/deepseek/status` |
| Input limit | 24,000 characters after request validation |
| Output ceiling | 6,000 completion tokens at the Worker upstream call |
| Production rate limit | 8 requests per 60 seconds per anonymous client key |
| Runtime validation | Worker normalization plus frontend `isRecognitionResult` |

The E2-A implementation does not modify any of these items. The production Worker records completion-token count in its server log but does not return usage to the caller. Therefore a client-side baseline can measure end-to-end latency, but Token/Cost must remain unobserved unless a future, separately approved observability change exposes non-sensitive usage.

## Existing evaluation audit

The pre-E2 suite contains 60 deterministic fixtures and calls only `buildLocalRecognition`. It provides useful fallback regression coverage, but it cannot establish current DeepSeek quality because:

1. it never calls the production model;
2. expected structures are coarse ranges and keywords rather than entity-level Project/Milestone/Task/Subtask/Material/TimePoint/Event/Evidence/Ambiguity contracts;
3. it emits aggregate metrics only and does not persist per-case failure reasons;
4. it has no invalid-output, request-failure, latency, usage or cost accounting;
5. it does not enforce a strict provider boundary in its report.

E2-A adds a separate dataset and harness instead of changing those historical denominators.

## Safety and scope check

- All cases are synthetic and anonymous; no real student names, IDs, phone numbers, files or workspace content are included.
- Security cases treat embedded instructions as untrusted source text. Forbidden-output checks inspect semantic tasks/projects/events, not the evidence quote that correctly preserves the hostile source.
- The runner uses the deployed same-origin proxy and never reads or stores the DeepSeek key.
- Domain v8, migration, repository, Project Matching, Follow, Prompt and Worker behavior remain untouched.
- Regular CI executes deterministic tests only. The paid/networked production baseline is an explicit command and cannot run accidentally in CI.
