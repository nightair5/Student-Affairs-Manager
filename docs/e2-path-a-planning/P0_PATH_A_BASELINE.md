# E2.7 P0 Path A Baseline Freeze

## Frozen baseline

- Branch: `codex/e2-path-a-planning-v2`
- Commit: `70dd976e1de03d03e4e6fec8b6d7e872945eda27`
- Model: `deepseek-v4-flash`
- Prompt: `recognition-2.4.1`
- RecognitionResult schema: `2.0`
- Pipeline: `recognition-pipeline-2.2.1`
- Validator: `recognition-quality-2.1.0`
- Repair: `recognition-repair-1.1.0` / patch `recognition-repair-patch-1.0.0`
- Router: `recognition-router-1.1.0`

`70dd976` retains the empty-alias scorer integrity fix and the complete E2.5 diagnostic evidence. It does not contain the E2.6 Cloudflare Preview experiment endpoint added after that commit.

## Dataset boundary

The 110 Golden, 40 Exposed Holdout, 108 Generalization Development and 24 E2.6 complex diagnostic cases are all exposed. They remain frozen regression/development/diagnostic assets and have no Blind eligibility. Their canonical LF hashes are recorded in `path-a-baseline-manifest.json`; existing corrections logs remain unchanged.

## FactLedger rejection closure

- `v2-e2-factledger-rejected` points to `f32053a`.
- The historical experiment branch records the Preview shutdown in `c9ad5e8`.
- The experiment bearer Secret was deleted without reading or persisting its value.
- Preview was redeployed from the stable Path A commit as version `a130fa30-a737-40f9-b7aa-2010e5420537` with no FactLedger endpoint or custom route.
- Preview secret listing contains only `DEEPSEEK_API_KEY`; production was not deployed.

The rejected implementation and E2.6 reports remain in Git history. They are not merged into this Path A development branch and cannot be reused as a Planner or production candidate.

## Verification

Run:

```bash
npm run test:e2.7:baseline
```

The verifier checks the baseline commit, version constants, dataset hashes, scorer/component source hashes, rejection tag and absence of the Preview FactLedger endpoint at the baseline commit.
