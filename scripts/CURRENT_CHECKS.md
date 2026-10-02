# Current engineering and historical checks

The three independently runnable layers are:

- `npm run test:product`: all non-experiment TypeScript suites, both generated
  contracts, server, Worker (including D26), Functions and time parity.
- `npm run test:safety`: portable current experiment TypeScript suites, newly generated
  engineering carriers, synthetic governance/executor tests and current explicitly
  registered Node tests. The carrier-dependent acceptance suite is a separate group;
  preparation failure records FAIL/NOT_RUN and the other groups still run.
- `npm run test:historical`: immutable original hashes plus unchanged legacy
  assertions. Missing private recordings are NOT_AVAILABLE. Old runtime hash
  assertions still run when inputs exist and retain their actual failures; they do
  not become a current product quality score. Reproduce a frozen runtime on its
  recorded original Git snapshot, not by changing its old manifest to current code.

Six D19-D24 suites that construct previews from the private D17 execution package
run in historical, with explicit STATE, AUTHORIZATION, raw and recorded-ledger
prerequisites. The real-input runtime and carrier acceptance files mix portable
checks with old private A02 recordings: current safety runs the exact complement
of the two runtime and eight carrier historical cases; historical runs those ten
cases when their original preparation and independent-readback files exist.
The complementary selectors are maintained in `current-checks-support.mjs` and
checked against the unchanged test titles. New unrelated cases remain in safety.
No historical assertion or frozen fixture has been rewritten.

`npm test` runs all three and reports every group. Exit 0 means all selected groups
passed; 1 means a failure; 2 means incomplete coverage (NOT_AVAILABLE/NOT_RUN).
There is no `continue-on-error`, global timeout increase or removed failing suite.
CI runs layers as independent jobs and uploads their logs even after failure.
Linux cannot execute the unchanged D25 PowerShell writer-lock test; it reports
NOT_AVAILABLE, and the Windows safety job executes that test. Missing platform
coverage is not reported as PASS.

Reports live in `.data/candidate11/checks/<phase>/<timezone>/summary.json` with
per-group logs, outcomes and reasons. `TZ=UTC` and `TZ=Asia/Shanghai` reach child
processes. The test wrapper filters environment names before reading values,
blocks root `.env*`/`.dev.vars*`, never loads credentials and does not dispatch
business models. Historical legacy checks may read their recorded ledger inputs;
the current product/safety layers do not require the real authority ledger.

Generated source hashes explicitly use LF. The old mixed CRLF/LF working files
previously produced the same JavaScript body but a different source hash after a
Linux checkout. Regeneration changes the hash header only; meaningful source
changes still fail `--check`.

The carrier font is the checked-in OFL Noto resource documented in
`assets/fonts/README.md`; it adds no npm dependency. Its byte hash, every notice
character's cmap entry and distinct rendered Chinese glyphs must pass before any
new carrier is written. All outputs use a fresh temporary directory. This checks
engineering assets, not OCR accuracy or a new model benchmark.

Historical original checking is independently anchored to the governance and
D25 manifest bytes at commit `7b90b1e806919ea9a8fb02e6c62a9657499ee94a`.
It checks all available entries even when another original is missing. Changed
originals remain FAIL; absent originals remain NOT_AVAILABLE. Current App/source
dependencies sealed by a historical experiment are not silently re-sealed.
