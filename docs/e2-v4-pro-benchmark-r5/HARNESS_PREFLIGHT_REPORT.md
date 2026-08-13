# E2.9 Next-Run Harness Preflight Repair

- Status: **LOCAL HARNESS PREFLIGHT READY**
- Model calls: **0**
- Preview activation: **NOT RUN**
- Production deployment: **NOT RUN**
- Selection / Blind / E3 / E4: **NOT RUN**

## Purpose

R4 failed after 32 valid generations because the frozen packet-preview entrypoint imported a named export that did not exist. `node --check` had passed because it validates syntax without resolving the ESM export graph. This repair moves that class of failure before any benchmark token is accepted or model request is sent.

## Implemented repair

1. `completeObservationStatus` is now an explicit export backed by the single frozen complete-status set.
2. `e2-9-r4-entrypoint-preflight.mjs` resolves every static default and named import used by the five post-generation entrypoints:
   - packet preview;
   - packet finalization;
   - reveal;
   - strict scoring;
   - screening gate.
3. The benchmark runner invokes the preflight before reading `E2_V4_PRO_BENCHMARK_TOKEN` and before any network request.
4. The preflight implementation is included in the protocol/deployment bundle list, so a fresh run manifest will bind its source hash.
5. The package exposes an explicit local command: `npm run eval:recognition:e2:r4:preflight`.

## Regression evidence

- Current five-entry import graph: **PASS**.
- Synthetic missing named export: **FAIL CLOSED** with `ENTRYPOINT_IMPORT_MISSING_EXPORT`.
- Direct packet-preview module load: reaches the expected in-memory Secret gate (`PATH_MASK_REVEAL_SECRET_INVALID`) instead of failing at ESM linkage.
- Direct-load check created no packet or other experiment artifact.
- Focused protocol tests: **10/10 PASS**.
- ESLint: **PASS**.

## Scope boundary

This is a local Harness integrity repair only. It does not make R4 scorable, does not modify its frozen observations, does not create a quality conclusion, and does not authorize reuse or selective rerun. A future real benchmark still requires a new protocol version, fresh run/phase labels, fresh observation IDs, a new bundle freeze, Preview safety verification, and explicit authorization before any model calls.

## Next gate

The next engineering step is to create the fresh protocol/run scaffolding and run the full local test, build, security, dry-run deployment, and artifact-binding checks. No Preview activation or model generation should occur until those checks pass.
