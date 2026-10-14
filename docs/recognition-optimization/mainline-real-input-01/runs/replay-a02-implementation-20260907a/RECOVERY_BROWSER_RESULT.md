# A02 recovery — actual Edge results

Status: PARTIAL / DELIVERY BLOCKED. Model recognition accuracy: 本轮未测量。

## Environment and identity

- Official browser control, Edge browser 2 / original tab 763114724.
- Original origin: http://127.0.0.1:6631 . Original run: real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862; no `new=1`.
- Original database: rco-mainline-01-02-i1-real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862.
- Replaced only the verified old local test server with the approved recorded-A02 launcher; upstream disabled. Framework environment loading was disabled before loading/building. No credential, clipboard, model or real-user database access.
- No database cleared, replaced or initialized as a working fallback. A probe name was used solely for twice-aborted IndexedDB transactions; neither transaction committed a database.

## Observed PASS

1. Recorded launcher mounted the real App on the original tab and database. Page described A02 as a historical real-model response, with zero calls this round.
2. The actual IndexedDB probe observed oldVersion `[0,0]` on two opens of the same probe name; legacy upgrade handler calls 0. Both transactions aborted; the second oldVersion 0 verifies the first open did not persist a database. See RECOVERY_IDB_PROBE.json. This is separate from the EventTarget unit test.
3. The engineering tool independently instantiated `new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()` against the original database. The full object was retained as `recoveryBefore` in the same official CUA REPL. Its SHA-256 was `b7c08ed26349a7ad5e1a67236058aa9c91ed6b678a2cf210647f5d59473b758a`, 16 Sources, 0 formal Tasks. This matches the previous actual download (2) workspace digest; it is not two hashes of one download.
4. Before replay, observed workspace writes 0, foreign database accesses 0, forbidden network 0, blocked upgrade events 2. Those observations apply to this probe, not unexecuted journeys.
5. Clicked the real recorded-A02 replay button. Existing original response entered the same repository as a pending suggestion, preserving `live_model_candidate`. Source `source:00af0dfa`, Draft `source:00af0dfa:draft:1:1`; formal Tasks remained 0.
6. Refreshed the same page; Inbox recovered the ready A02 draft. Opened “核对1项” in the actual confirmation panel. It displayed 保存活动手册, explicit absence of deadline, one material requiring separate necessity/preparation review, and no automatic selection.

## Blocking actual observation

The dialog was captured read-only as `recoveryPanelEvidence` in the same REPL. Its first line was:

> 第 2 步 · 人工工程响应（非模型预测）

The underlying original notice was 请保存活动手册。没有截止日期要求。 The page-level description correctly said A02历史真实模型响应回放 · 本轮零调用, so these user-visible identities conflict. `DraftReviewPanel.tsx:148` hardcodes the human-engineering banner whenever isolatedCapabilities is true; `App.tsx:1514` supplies that capability flag without the already-existing runtime description. Both are currently read-only outside the 12-path replay changes. No banner repair was made in this recovery.

This observation does not show that the stored response identity changed. It does prevent honest final user acceptance of the current display.

## NOT_RUN / not claimed

After observing the out-of-scope defect, no material-review save, sequential title edit, active review/selection, formal confirmation, confirmation fault/expiry/duplicate journey, post-confirmation task/calendar retrieval or new JSON download was performed. No DOM notice is counted as a persisted formal task. The previous memory acceptance remains a separate layer, not browser completion.

The original tab is left at the pending A02 panel and the recorded-only local server remains available. No browser/system settings were changed. Resume this exact database and pending draft; do not use a new database or rerun A02.
