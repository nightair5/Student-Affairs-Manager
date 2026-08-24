# Student Affairs Product v2.0 — E2.9-R10 Facts-First Preview Protocol

## 1. Status and purpose

- Protocol version: `e2-9-r10-facts-first-protocol-1.1.5`
- Current phase: `G_ZERO_MODEL_IMPLEMENTATION_NOT_YET_QUALIFIED`
- Production recognition/generation calls authorized by this protocol: `0`
- Production deployment: prohibited
- Selection: prohibited until Screening Gate passes
- Blind: prohibited until Selection Gate passes and a separate authorization is recorded
- E3/E4: not entered

R10 tests one architectural claim only:

> A model that first records literal source facts into a validated FactLedger, followed by a deterministic constrained Planner, is more reliable for complex school notices than the current single-pass recognition path.

R10 does not change Workspace v8, Repository, Migration, DomainCommitPlan, Capture/Commit, the Production Worker, frozen Expected answers, or the Production default recognition path.

Frozen component versions for this protocol are:

| Component | Version |
| --- | --- |
| FactLedger contract | `e2-r10-fact-ledger-contract-1.1.0` |
| Ledger-to-Planner bridge | `e2-r10-ledger-planner-bridge-1.1.0` |
| Isolated Planner | `e2-r10-isolated-planner-1.1.0` |
| Ledger-to-Plan Validator | `e2-r10-ledger-plan-validator-1.1.0` |
| Qualification contract | `e2.9-r10-qualification-contract-1.2.5` |
| Qualification Worker | `e2-r10-qualification-worker-1.1.5` |
| Private qualification ledger | `e2-r10-qualification-ledger-1.1.5` |

## 2. Paired architecture

### Path A — frozen single pass

```text
source text
  -> frozen single-pass model request
  -> RecognitionResult 2.0
  -> frozen scorer and user-impact review
```

### Path B — facts first

```text
source text
  -> same model and request parameters, FactLedger response schema
  -> strict FactLedger parser and validation
  -> reference-only Normalizer
  -> deterministic isolated Planner
  -> deterministic Ledger-to-Plan Validator
  -> RecognitionResult 2.0 experiment output
  -> same frozen scorer and user-impact review
```

Path B uses one model generation call per source. The Planner, Normalizer, Validator, hashing, masking, scoring and Gate are deterministic and make no model calls.

## 3. Fact authority

FactLedger is the only business-fact authority for Path B. It records:

- obligation: actor, modality, action predicate and object;
- material and its business role;
- literal time expression, time role, precision and supersession;
- event;
- condition;
- constraint;
- ambiguity;
- exact source evidence.

FactLedger answers only “what the source explicitly says.” It does not create Workspace v8 entities, decide Milestone grouping, or write user data.

Every Fact must cite an exact evidence span. Relative, vague and unknown time must remain unnormalized and require confirmation. A failed FactLedger validation blocks Planner execution.

## 4. Permission matrix

| Component | May do | Must not do |
| --- | --- | --- |
| Fact extractor | Record source facts and literal relations | Decide Task/Milestone layout |
| Normalizer | Deduplicate IDs, remove dangling references, close already-declared bidirectional references | Add/delete facts or change action, object, modality, role, value, condition, constraint or ambiguity meaning |
| Planner | Project validated facts into RecognitionResult 2.0 and emit PlanningTrace | Read Expected, invent facts, repair FactLedger, change time/material roles |
| Validator | Compare FactLedger, PlanningTrace and output; emit structured issues | Re-extract with source regex, mutate output, call Repair or a model |
| Scorer | Read frozen outputs after generation checkpoint is immutable | Run during candidate generation or overwrite failed observations |

## 5. Planner invariants

- `required`: one core Task, selected by default when explicit.
- `conditional`: one core Task plus condition/confirmation representation.
- `optional`: optional Task, not selected by default.
- `informational`: no Task.
- `prohibited`: constraint/risk representation, not a normal action Task.
- One atomic obligation maps to one core Task.
- Different actions or independently completable deliverables remain separate.
- Material, TimePoint, location, Milestone and Event never become Tasks by themselves.
- An Event may coexist with a Task only when the FactLedger separately contains an obligation such as attend, arrive or sign in.
- A material quantity is structured only when one applicable quantity constraint contains one unambiguous Arabic or basic Chinese numeral plus a quantity unit, and the value is within 1–100.
- A material submission channel is structured only when one unique channel constraint targets exactly one Material; the exact constraint text is retained.
- Ambiguous, repeated, out-of-range or multi-target quantity/channel constraints remain exact `ignoredContent` and stay relation-bound in PlanningTrace instead of being guessed.
- Equivalent output containers are allowed; fact meaning, evidence and relations are not negotiable.

## 6. Validator contract

The Validator receives only:

```text
validated FactLedger
+ RecognitionResult 2.0
+ PlanningTrace
+ ledger hash
+ result hash
```

Target issue codes are:

- `MISSING_TASK`
- `MISSING_TIMEPOINT`
- `WRONG_TIME_ROLE`
- `MISSING_AMBIGUITY`
- `EVENT_TASK_CONFUSION`
- `UNSUPPORTED_TASK`
- `FACT_MUTATION`
- `INTEGRITY_FAILURE`

All issues are non-repairing. `NO_ISSUE` is derived only when the issue list is empty; it is not emitted as a warning. A trace binding is an index, not proof: the Validator independently checks the bound entity fields and evidence.

## 7. Experiment integrity

Before any model call, the following are frozen and hashed:

- case manifest and source hashes;
- Path A and Path B request schemas;
- model, parameters and response format;
- FactLedger, Planner, Validator and PlanningTrace versions;
- Prompt hashes;
- scorer and user-impact rubric;
- stage Gate;
- Worker routes, Wrangler configuration and deployment chain;
- run label and immutable observation IDs.

The qualification result uses a closed schema rather than an extensible bag of
booleans. Component names, component versions and every required check name are
frozen in code. Missing, renamed or additional checks fail validation. A failed
qualification is itself a valid first-class result and is recorded with later
model stages locked; it must never be replaced by a later successful rerun.

Local evidence may be written only from a clean, committed implementation. The
result binds the full 40-character Git commit, its tree object, and a SHA-256
manifest of every tracked blob. All protocol files must exist in that commit.
A dirty or untracked implementation may run a non-writing diagnostic, but its
status is `LOCAL_QUALIFICATION_FAILED_PREVIEW_LOCKED` and it cannot create
qualification evidence.

Formal local protocol, result and evidence artifacts use create-once writes.
Re-running with byte-identical content is idempotent; any attempt to replace an
existing artifact with different content fails closed. A new result therefore
requires a new run label and new artifact paths rather than overwriting history.

Production isolation is not inferred from an `R10` keyword search. It compares
the current committed production dependency/deployment manifest against frozen
commit `ef52d6b572e89faaaa9a18823df41b526aef3b8d`. The manifest covers all
`src/` and `public/` build inputs, lockfile and build configuration, the
production Wrangler configuration, and the complete relative-import graph
rooted at `cloudflare/worker.mjs`. A changed, added or uncommitted protected
file fails qualification.

Zero-use claims are execution counters, not literals typed into a report. The
qualification runner instruments model invocations, upstream network access and
Expected-answer file access. Their observed counts are included in both the
result and evidence and must agree exactly with the top-level fields.

Generation cannot read Expected answers. Failed observations are append-only and cannot be overwritten by a later success. Requested, returned, execution and result model names must agree. Raw outputs remain in Git-ignored cache; only anonymous aggregates and audit evidence may be committed.

## 8. Stage machine

```text
ZERO_MODEL_IMPLEMENTATION
  -> LOCAL_QUALIFIED
  -> PREVIEW_QUALIFIED
  -> SCREENING_AUTHORIZED
  -> SCREENING_GENERATION_FROZEN
  -> SCREENING_SCORED
  -> SCREENING_ADJUDICATED
  -> SCREENING_GATE_PASS | SCREENING_GATE_FAIL
```

`LOCAL_QUALIFIED` requires unit, Worker and integration tests plus dry-run module inspection. `PREVIEW_QUALIFIED` requires the independent qualification-only version URL to report zero model capability and to record one immutable qualification result.

Readiness, Smoke, Screening, Selection, Blind and Production routes are hard locked in the qualification Worker. A later model-enabled Preview must be a different Worker and requires explicit authorization.

## 9. Proposed Screening, not yet authorized

- 8 exposed complex diagnostic sources;
- paired Path A and Path B;
- 16 total generation calls;
- same source, same DeepSeek model, temperature, token limit and transport policy;
- interleaved order;
- Router bypassed;
- new protocol, run label and observation IDs;
- generation checkpoint frozen before scoring;
- new path-masked review packet and post-label reveal.

The Screening Gate is frozen before calls:

1. Task Recall improves by at least 8 percentage points **or** user-impact Major Correction decreases by at least 15 percentage points;
2. Task Precision decreases by no more than 3 percentage points;
3. Evidence Coverage is at least 95%;
4. Severe Error does not increase;
5. Planning Error decreases;
6. Fact Loss does not increase;
7. all integrity checks pass and every observation is immutable.

Any failed condition stops the protocol. Selection is not automatically authorized by a Screening pass.

## 10. Qualification-only deployment

Run `e29r10-zero-model-qualification-20260824-a` passed local checks but its
first remote upload was rejected by Cloudflare error `100315` because the
Preview-enabled Worker name exceeded 54 characters. No Preview qualification
record or model call was created. Protocol 1.1.0 preserves that failed attempt,
uses a new run label, and adds a machine-enforced name/origin compatibility
check before any Secret rotation or upload.

Run `e29r10-zero-model-qualification-20260824-b` reached the versioned
qualification Worker but failed before ledger registration with Cloudflare
runtime error `1042`. The caller had used the loose `fetch(url, init)` form on
a Service binding. Protocol 1.1.1 preserves that failure, moves to run label
`c`, and requires the documented `fetch(Request)` Service Binding interface;
the Worker test double rejects the former two-argument call.

Run `e29r10-zero-model-qualification-20260824-c` passed the initial local
qualification, then the bound-config preflight exposed a Harness test that
incorrectly required runtime hashes to remain zero after exact frozen hashes
were installed. No remote upload, Secret rotation, ledger record or model call
occurred. Protocol 1.1.2 preserves C as an integrity failure, moves to run label
`d`, and accepts only two complete config states: every runtime hash is the
fail-closed zero placeholder, or every runtime hash exactly matches the frozen
qualification evidence and recomputed deployment artifacts. Partial or
arbitrary nonzero bindings fail.

Run `e29r10-zero-model-qualification-20260824-d` uploaded the D qualification
Worker and rotated the private Ledger caller Secret, but the Ledger rejected the
registration with `412 QUALIFICATION_RECORD_INVALID`. The deployment chain had
not uploaded D Ledger code before `wrangler secret put`; that command creates
and immediately deploys a new version from the Worker's currently deployed
code. Protocol 1.1.3 preserves D as an integrity failure, moves to run label
`e`, deploys the private Ledger code before Secret rotation, and requires the
post-rotation Ledger version to be the only active version at 100 percent before
the qualification Worker can be uploaded. No D qualification record or model
call was created.

Run `e29r10-zero-model-qualification-20260824-e` completed the isolated
qualification-only Preview. The exact versioned Worker returned the same
contract three times, created one immutable record (`201`), returned an
idempotent replay (`200`), and returned the stored state (`200`). Wrong Origin
and authentication checks returned `403` and `401`; Readiness, Smoke,
Screening, Selection, Blind and Production each returned `412` with zero model
calls. The qualification version receives no stable Worker traffic, the
private Ledger is the sole active ledger version, and Production files and
deployment remain unchanged. Evidence is frozen in `preview-qualification-e.json`.

The same-process read-only audit passes, but it is not an independent review.
Screening remains unauthorized until a separate reviewer approves the frozen E
artifacts and the user explicitly authorizes at most 16 Screening calls.

The qualification Worker:

- has a unique Worker name and no custom-domain route;
- keeps the Preview-enabled Worker name within Cloudflare's 54-character limit and binds the configured origin host to that exact name;
- exposes no provider import, API key binding or model gateway;
- accepts only the exact versioned Preview origin;
- uses a server-side token hash and constant-time comparison;
- records one immutable zero-model qualification result in an internal Durable Object ledger;
- returns `412 MODEL_PHASE_NOT_AUTHORIZED` and `modelCalls: 0` for every later phase.

The Durable Object uses a storage transaction for compare-and-create. Two
concurrent identical registrations produce one stored record plus one
idempotent replay; a different result for the same run label receives `409`.
This applies equally to failed qualifications, so a failure cannot be hidden by
a subsequent success.

The ledger has `workers_dev: false`, `preview_urls: false` and no routes. The
qualification Worker calls it through a service binding and a separate
server-side bearer secret. The caller token is stored only as a Worker Secret;
the ledger stores only its SHA-256 secret binding. Neither value is present in
Wrangler configuration or Git.

Preview registration binds the actual qualification Worker version ID and
version timestamp, its canonical upload-module-byte-manifest hash and
Wrangler-config-projection hash, plus the ledger Worker version ID and the
same two artifact hashes. The module manifest contains every relative module
path and the SHA-256 of its exact pre-upload bytes; runtime hash bindings are
redacted from the config projection to avoid a self-referential hash. The same values
must be present in the uploaded Worker environment, the registration and the
ledger's own version metadata. Placeholder, zero, stale or mismatched values
fail closed.

Run `e29r10-zero-model-qualification-20260824-e` is preserved as an independent
integrity failure. Its Preview behavior and internal evidence chain were valid,
but this bundled protocol document was changed after qualification. The E
bundle hash therefore no longer matched the current protocol, while the former
authorization checker could validate a newly recomputed disk hash without
requiring it to equal the E qualification result and Preview evidence. No model
call occurred, but E is permanently ineligible to authorize Screening.

Protocol 1.1.4 used the new run label
`e29r10-zero-model-qualification-20260824-f` and passed local zero-model
qualification. Its deployment script then stopped before the first remote
operation because the active Windows PowerShell runtime did not implement the
static `RandomNumberGenerator.Fill` API. No upload, Secret rotation, ledger
record, model call or Expected read occurred. F is preserved and never retried.

Protocol 1.1.5 uses the new run label
`e29r10-zero-model-qualification-20260824-g` and generates tokens through the
portable `RandomNumberGenerator.Create().GetBytes()` API. Before any future Screening
authorization is accepted, code must recompute and cross-bind all of the
following instead of trusting an authorization file alone:

- the current protocol bundle and frozen Screening Gate;
- the exact local qualification result and its canonical hash;
- the local qualification evidence and its canonical hash;
- the complete sanitized Preview qualification evidence and its canonical hash;
- the deployment evidence hash, qualification Worker version and private Ledger version;
- zero stable traffic for the qualification version and one 100% active Ledger version;
- the independent read-only review artifact and its canonical hash.

The G protocol bundle is immutable after local qualification. G status updates,
Preview evidence and independent-review results are written only to separate,
non-bundled append-only artifacts. Any bundled-file drift invalidates G and
requires another protocol version and run label. Merely supplying syntactically
valid or mutually consistent hashes is insufficient.

The qualification ledger is an experiment audit record only. It is not FactLedger, Workspace v8 or a business database.

`E2_R10_QUALIFICATION_TOKEN_SHA256` is installed only as a Cloudflare Secret. It is intentionally absent from Wrangler configuration and repository files.

`E2_R10_LEDGER_CALLER_TOKEN` and `E2_R10_LEDGER_CALLER_TOKEN_SHA256` are also
server-side Secrets on the qualification and ledger Workers respectively.
No model provider Secret is accepted by either Worker.
