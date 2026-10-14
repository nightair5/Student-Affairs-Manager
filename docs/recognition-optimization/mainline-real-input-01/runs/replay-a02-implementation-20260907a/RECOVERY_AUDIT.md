# MAINLINE-REAL-INPUT-01 recovery audit

Date: 2026-09-07. Status: **NOT_COMPLETE / AUDIT_ONLY**.

## Outcome

The two authorized recovery defects are repaired and checked: framework execution no longer defaults to root environment-file loading, and recorded-mode opening cannot create or upgrade a missing original database. Actual Edge has now restored the real A02 response into the original App/database and reopened its review panel after refresh. Final user confirmation is not accepted yet: the common panel mislabels this real response as human engineering. No new model request was made; model recognition accuracy: **本轮未测量**。

## Authorization and changes

- Start HEAD and remote: bccc453226d35ca50656d84add81921bbd3b768a, existing branch codex/e2-multimodal-recognition-exp. No reset/rebase/reinstallation or repeated implementation.
- Only `src/experiments/realInput01/browser.tsx` and `acceptance.test.tsx` changed relative to CONTINUATION_REVIEW_SNAPSHOT. Other 40 implementation files remain byte-identical. Final 42 hashes: RECOVERY_IMPLEMENTATION_SNAPSHOT.json.
- Recorded IndexedDB opens register an aborting upgrade listener before legacy store handlers; version other than 1 fails before opening. Existing v1 and legacy/default behavior retain positive controls. Probe transactions abort, never initialize a fallback workspace. Global store/repository source code remains unmodified; the authorized replay separately persists a pending draft in the original isolated database.
- Added one upgrade-event regression with actual source extraction and normal controls. The EventTarget harness is not claimed to be IndexedDB engine proof; actual Edge supplies that proof separately.
- Type validation found a required test prop missing. Added only `initialText=""` to the authorized new acceptance test call, without weakening assertions. Independent supplemental review verified this exact change.
- Framework isolation: explicit envFile/configFile disablement before framework load, fresh temporary env/cache/build locations, nonsecret fixture positive/negative checks, parent-process file-read guard. This is not a system-wide IO trace. No actual root `.env` contents were read this round. Prior unauthorized default reads remain recorded as historical FAIL.

## Layered evidence (attempts are not additional samples)

| Layer | Latest evidence and limitations |
| --- | --- |
| Directed | Before: 13 pass / 1 expected fail. Final three-file run: 64/64. Original assertions preserved. Later one required prop type fix is included in the final full functional run. |
| Independent review | Recovery differences PASS; required-prop supplement PASS. Final delivery BLOCKED on the separately observed provenance banner; see RECOVERY_REVIEW. |
| lint / types | lint 0 errors, 4 warnings. App type attempt1 failed for missing initialText; attempt2 PASS. Node type PASS. |
| Functional | Attempt1 1230 pass / 1 timeout / 1 skip during parallel work. Attempt2, two workers and unchanged timeout/assertions: 1231 pass / 0 fail / 1 skip. No claim that the skipped case passed. |
| Core Node / contracts | 62/62; Schema/time generated-artifact checks both PASS. No old one-shot runner invoked. |
| Budget/gateway | First combined orchestration lacked required temporary fixture inputs: 4 pass / 80 fail, preserved. Correct explicit fresh test-temp configuration: budget+gateway 83/83. This does not turn the combined checker file into PASS. |
| Historical/current separation | Original historical snapshot 20 files exact-byte SHA and original library 4/4. Current dependency compatibility 13 checks, old 357 dependencies plus the two approved MIT type additions. Historical current-workspace R2 3/1 FAIL retained, not relabelled. |
| Build / isolation | Fresh output build PASS; 14 stable JS bundles contain none of the recorded-mode markers. Root environment loading disabled. |
| Security / dependencies | 1194 source/build files scanned, 0 findings; public npm audit 0 vulnerabilities using fresh cache/config. No dependencies installed or changed. |
| Protection | 945 original protected files, 160 old evidence files, prior CONTINUATION evidence, ledger and 5 receipts preserved; log prefix preserved. Initial pure-hash scan guard rejected tracked `.env.example` before reading it; final inventory explicitly allowed only that tracked placeholder. Actual root `.env` remained blocked. |
| Actual browser | Original Edge/origin/database, real IndexedDB abort probe, independent original repository read, recorded A02 replay and refreshed Inbox/panel PASS. Material save / formal confirmation / downstream / final download NOT_RUN after scope blocker. |

### Engineering limitation that remains explicit

`check-mainline-real-input-01.node-test.mjs` was not accepted as a current full gate: the first combined run stopped on missing fixture inputs, and the old checker also binds a historical recovery HEAD. Budget/gateway were rerun independently, not by editing/skipping old assertions or resetting HEAD. Its historical-bound coverage and any applicable current safe orchestration still need to be reconciled before final delivery. This audit does not say all engineering gates passed. Raw attempt logs are retained rather than merged into a fictional passing run.

## Actual browser blocker and minimal next authorization

At `DraftReviewPanel.tsx:148`, all isolated capabilities produce “人工工程响应（非模型预测）”. `App.tsx:1514` does not forward the existing real-input runtime recognitionDescription to the panel. This is a real user-facing contradiction, not a model semantic error or proof of changed stored provenance. It was observed before any formal confirmation this round.

Request only two existing total-42 files as additional replay exceptions (12 change paths become 14; the total implementation set stays 42):

1. `src/App.tsx`: only the real-input runtime branch forwards its existing recognitionDescription to the confirmation panel.
2. `src/components/DraftReviewPanel.tsx`: optional source-description prop for that banner. With the prop absent, retain old/default display and all capability restrictions. No widening of edit/confirm powers.

Regression belongs in the already-approved acceptance.test.tsx: actual A02/history description, human-engineering and ordinary default controls. Do not change raw response, provider identity, stored Source, score, budget, shared validator or semantics. Do not fix this by pretending the model response is human engineering.

### Ready-to-authorize continuation

> 继续同一 MAINLINE-REAL-INPUT-01，不重做PLAN。以本轮实际审计提交/远端及 RECOVERY_IMPLEMENTATION_SNAPSHOT、CHECKS 为基线，核对42源码、945保护、160旧证据、CONTINUATION证据、账本5收据及日志边界。明确增加原42内 App.tsx 与 DraftReviewPanel.tsx 两个最小例外：仅在真实输入runtime传递既有来源说明、面板以可选props显示，旧默认与能力限制不变；对应回归放原获准acceptance.test.tsx。禁止改原回答/身份/评分/账本。先复现真实模型被误标人工的正常/反例并修复、独审；按当前源码完成适用工程门，旧历史HEAD检查单列，不通过回切或改旧断言救门。然后在原6631/原库现有A02待确认记录继续材料必需性/准备状态、逐键修改/保存、主动确认、刷新找回及真实下载对独立读库；范围内普通缺陷连续处理。若需要修改现有只读checker或其他文件，列出精确职责申请。保持根环境读取禁用和新临时输出；0模型/密钥/剪贴板/新数据/真实库/稳定入口/部署。全通过才42业务与报告精确提交推送，否则仅审计保留现场。

## Historical and delivery boundaries

A01 permanent failure, one request and 3300000 microyuan unknown reserve remain. A02 grant consumed; 16392 microyuan settled upper bound, cumulative 2 requests / 3316392 occupied. No paid/recover/A03, no new receipt or ledger event. Historical scores and FAIL, old 40/42 and 17 tests are unchanged. Current actual browser observations are not model accuracy, unseen-data quality or human editing-time measurement.

Only new RECOVERY reports, short CURRENT_CONTEXT and appended OPTIMIZATION_LOG are eligible for this failure-evidence commit. All 42 business files stay uncommitted. Exact staged listing, final protection and remote comparison will be checked at delivery; this report's start HEAD is not a fabricated final commit ID.
