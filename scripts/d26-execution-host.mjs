import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, openSync, closeSync, writeFileSync, fsyncSync, realpathSync, readdirSync } from 'node:fs'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { validateChain } from './candidate13-d6-budget.mjs'

export const BATCH = 'D26-C17-C18-DEVELOPMENT-R1'
export const SNAPSHOT = '4699d5cfdd6211299d9ab82ef7000d99fc8fe8f8'
export const FROZEN = Object.freeze({ manifestSha256: 'c41185c3831d35db610e5a4a563b7471b0bd60d1d92a373edd6a5c10d28f7ac2', identitiesSha256: '89f33327eabd2ec90f9d383ac922d56b56ca4654cfee0be47aac083eea411e89' })
export const AUTHORITATIVE_LEDGER = resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const HOST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE = 'docs/recognition-optimization/d26-correction'
const BRANCH = 'codex/e2-candidate11-blind-eval'
const digest = value => createHash('sha256').update(value).digest('hex')
const check = (value, code) => { if (!value) throw Error('D26_HOST_' + code) }
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim()
const contained = (root, path) => { const rel = relative(root, path); return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) }
function writeOnce(path, value) {
  const file = openSync(path, 'wx', 0o600)
  try { writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); fsyncSync(file) } finally { closeSync(file) }
}

/** The active D27 app is intentionally not the D26 comparison tree. Check a
 * separate unchanged snapshot; never regenerate a frozen artifact or chdir. */
export function verifySnapshot(snapshotRoot, hostRoot = HOST_ROOT) {
  snapshotRoot = realpathSync(snapshotRoot)
  check(snapshotRoot !== realpathSync(hostRoot), 'SEPARATE_SNAPSHOT_REQUIRED')
  const manifestBytes = readFileSync(join(snapshotRoot, PACKAGE, 'MANIFEST.json'))
  const identityBytes = readFileSync(join(snapshotRoot, PACKAGE, 'PREPARED_REQUEST_IDENTITIES.json'))
  check(digest(manifestBytes) === FROZEN.manifestSha256 && digest(identityBytes) === FROZEN.identitiesSha256, 'FROZEN_PACKAGE_BYTES')
  const manifest = JSON.parse(manifestBytes), identities = JSON.parse(identityBytes)
  check(manifest.batch === BATCH && manifest.sourceCount === 8 && manifest.requestCount === 16
    && manifest.status === 'NOT_RUN' && manifest.dispatchAuthorized === false, 'FROZEN_SCOPE')
  for (const entry of manifest.components) {
    const path = resolve(snapshotRoot, entry.path)
    check(contained(snapshotRoot, path) && digest(readFileSync(path, 'utf8').replace(/\r\n/gu, '\n')) === entry.sha256, 'SNAPSHOT_COMPONENT_DRIFT')
  }
  for (const entry of manifest.artifacts) {
    const path = resolve(snapshotRoot, PACKAGE, entry.path)
    check(contained(snapshotRoot, path) && digest(readFileSync(path)) === entry.sha256, 'SNAPSHOT_ARTIFACT_DRIFT')
  }
  const units = identities.requests
  check(identities.status === 'NOT_RUN' && identities.dispatchAuthorized === false && units.length === 16, 'IDENTITY_COUNT')
  for (const [index, unit] of units.entries()) {
    const { unitIdentitySha256, body, status, dispatchAuthorized, ...identity } = unit
    check(unit.ordinal === index + 1 && unit.batch === BATCH && status === 'NOT_RUN' && dispatchAuthorized === false
      && digest(JSON.stringify(identity)) === unitIdentitySha256 && digest(JSON.stringify(body)) === unit.requestSha256, 'IDENTITY_DRIFT')
    check(body.model === 'deepseek-flash' && body.temperature === 0 && body.reasoning?.effort === 'none'
      && body.max_output_tokens === 8192 && body.stream === false && Buffer.byteLength(JSON.stringify(body)) <= 65536, 'FROZEN_PARAMETERS')
  }
  check(new Set(units.map(unit => unit.unitIdentitySha256)).size === 16 && new Set(units.map(unit => unit.requestSha256)).size === 16, 'DUPLICATE_IDENTITY')
  const pairs = Array.from({ length: 8 }, (_, index) => units.slice(index * 2, index * 2 + 2))
  check(new Set(pairs.map(pair => pair[0].sourceId)).size === 8
    && pairs.every(pair => pair[0].sourceId === pair[1].sourceId && new Set(pair.map(unit => unit.arm)).size === 2)
    && pairs.filter(pair => pair[0].arm === 'A').length === 4, 'PAIR_ORDER')
  // These existing D25 safety adapters are imported from the host checkout.
  // Bind their bytes to the original snapshot rather than silently trusting a
  // later change to a credential, transport or ledger implementation.
  for (const name of ['candidate13-d6-budget.mjs', 'real-input-budget.mjs', 'real-input-model-gateway.mjs', 'd25-ledger-append.ps1']) {
    const path = 'scripts/' + name
    const original = execFileSync('git', ['show', SNAPSHOT + ':' + path], { cwd: hostRoot, maxBuffer: 32 * 1024 * 1024 }).toString('utf8').replace(/\r\n/gu, '\n')
    check(digest(readFileSync(join(hostRoot, path), 'utf8').replace(/\r\n/gu, '\n')) === digest(original), 'SHARED_SAFETY_ADAPTER_DRIFT')
  }
  return { units, binding: { ...FROZEN }, snapshot: SNAPSHOT, components: manifest.components.length, artifacts: manifest.artifacts.length }
}

export function assertHostAuthorization(auth, engine, units, binding, now = Date.now()) {
  engine.assertAuthorization(engine.newState(units, binding), auth, units, binding)
  check(auth.hostVersion === 'd26-execution-host-1' && auth.snapshotCommit === SNAPSHOT, 'HOST_AND_SNAPSHOT_AUTH')
  check(Number.isSafeInteger(auth.ledgerBaselineRows) && auth.ledgerBaselineRows > 0
    && Number.isSafeInteger(auth.ledgerBaselineBytes) && auth.ledgerBaselineBytes > 0
    && /^[a-f0-9]{64}$/u.test(auth.ledgerBaselineSha256), 'LEDGER_AUTH_BINDING')
  check(auth.pricing.model === 'deepseek-flash' && auth.pricing.endpoint === 'https://api.deepseek.com/responses'
    && auth.pricing.maxOutputTokens === 8192 && auth.pricing.tokenBoundMethod === 'FULL_OFFICIAL_CONTEXT_UPPER_BOUND'
    && auth.pricing.reasoningMetering === 'INCLUDED_IN_OUTPUT_TOKENS'
    && auth.pricing.additionalChargeUpperMicroUsd === 0
    && /^[a-f0-9]{64}$/u.test(auth.priceEvidenceSha256), 'BUDGET_UNRESOLVED_PRICE_RULES')
  engine.validatePriceScope(auth.pricing, now)
  check(/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/u.test(auth.grantId), 'GRANT_ID')
}

function gitBound(hostRoot, head) {
  check(git(hostRoot, ['branch', '--show-current']) === BRANCH && git(hostRoot, ['rev-parse', 'HEAD']) === head
    && git(hostRoot, ['rev-parse', '@{u}']) === head
    && git(hostRoot, ['ls-remote', 'origin', 'refs/heads/' + BRANCH]).split(/\s+/u)[0] === head
    && !git(hostRoot, ['status', '--porcelain']), 'GIT_NOT_CLEAN_COMMITTED_AND_SYNCHRONIZED')
}

function createHost({ root, ledgerPath, engine, packageRead, gitCheck, append, transport, role, fault = async () => {} }) {
  const authPath = join(root, 'AUTHORIZATION.json'), statePath = join(root, 'STATE.json'), lockPath = join(root, 'lock')
  const rawPath = join(root, 'raw'), receiptsPath = join(root, 'receipts'), haltPath = join(root, 'HALT.json')
  const authorization = () => {
    check(existsSync(authPath), 'AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND')
    const auth = read(authPath), pack = packageRead()
    assertHostAuthorization(auth, engine, pack.units, pack.binding)
    check(digest(readFileSync(join(root, 'USER_AUTHORIZATION.txt'))) === auth.userMessageSha256, 'USER_AUTHORIZATION_EVIDENCE')
    const evidenceBytes = readFileSync(join(root, 'PRICE_EVIDENCE.json')), evidence = JSON.parse(evidenceBytes)
    check(digest(evidenceBytes) === auth.priceEvidenceSha256
      && isDeepStrictEqual(evidence.pricing, auth.pricing)
      && evidence.role === (role === 'OFFLINE_ANONYMOUS_FAKE_TRANSPORT' ? 'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED' : 'OFFICIAL_PRICE_VERIFIED'), 'PRICE_EVIDENCE_BINDING')
    gitCheck(auth.committedHead)
    return { auth, ...pack, authSha256: digest(readFileSync(authPath)) }
  }
  const ledgerRead = (auth, afterGrant) => {
    const bytes = readFileSync(ledgerPath), chain = validateChain(bytes)
    check(bytes.length >= auth.ledgerBaselineBytes && chain.rows.length >= auth.ledgerBaselineRows
      && digest(bytes.subarray(0, auth.ledgerBaselineBytes)) === auth.ledgerBaselineSha256, 'LEDGER_PREFIX')
    const later = chain.rows.slice(auth.ledgerBaselineRows)
    check(!chain.rows.slice(0, auth.ledgerBaselineRows).some(row => row.event.grantId === auth.grantId || row.event.batchId === BATCH || row.event.batch === BATCH), 'BATCH_OR_GRANT_ALREADY_USED')
    if (!afterGrant) check(later.length === 0 && bytes.length === auth.ledgerBaselineBytes && digest(bytes) === auth.ledgerBaselineSha256, 'FRESH_LEDGER_REQUIRED')
    else check(later[0]?.event.kind === 'd26Grant' && later.every(row => row.event.batchId === BATCH && row.event.grantId === auth.grantId), 'LEDGER_BATCH_DRIFT')
    return { bytes, chain, later }
  }
  const appendRow = async (auth, event, afterGrant = true) => {
    const { bytes, chain } = ledgerRead(auth, afterGrant)
    const row = { sequence: chain.rows.length, previous: chain.tail, event }
    row.hash = digest(JSON.stringify(row))
    const line = JSON.stringify(row) + '\n', receipt = join(receiptsPath, String(row.sequence).padStart(9, '0') + '.json')
    const file = openSync(receipt, 'wx', 0o600)
    try { writeFileSync(file, line); fsyncSync(file) } finally { closeSync(file) }
    await fault('before_' + event.kind)
    await append({ ledgerPath, receipt, before: bytes, after: Buffer.concat([bytes, Buffer.from(line)]), event })
    await fault('after_' + event.kind)
    const actual = readFileSync(ledgerPath)
    validateChain(actual)
    check(actual.equals(Buffer.concat([bytes, Buffer.from(line)])), 'LEDGER_APPEND_UNCERTAIN')
  }
  const auditSettled = (pack, state, ordinal, readOnly = false) => {
    const { auth, units, binding, authSha256 } = pack
    check(state.authorized === true && state.grantId === auth.grantId && state.committedHead === auth.committedHead
      && state.hostAuthorizationSha256 === authSha256 && state.snapshotCommit === SNAPSHOT, 'STATE_AUTH_DRIFT')
    if (!readOnly) engine.assertAuthorization(state, auth, units, binding)
    else check(state.version === 'd26-execution-state-1' && state.batch === BATCH && state.model === 'deepseek-flash'
      && state.manifestSha256 === binding.manifestSha256 && state.identitiesSha256 === binding.identitiesSha256
      && state.units.length === 16 && state.units.every((row, index) => row.ordinal === index + 1
        && row.unitIdentitySha256 === units[index].unitIdentitySha256 && row.requestSha256 === units[index].requestSha256
        && auth.units[index] === row.unitIdentitySha256 && auth.requestSha256s[index] === row.requestSha256), 'READ_ONLY_IDENTITY_DRIFT')
    check(engine.nextOrdinal(state) === ordinal, 'STATE_ORDER')
    const { later } = ledgerRead(auth, true), settled = state.units.filter(row => row.status === 'SETTLED').length
    check(later.length === 1 + 2 * settled && (ordinal === null ? settled === 16 : ordinal === settled + 1), 'LEDGER_STATE_DRIFT')
    const grant = later[0].event
    check(grant.head === auth.committedHead && grant.snapshotCommit === SNAPSHOT && grant.authorizationSha256 === authSha256
      && grant.manifestSha256 === binding.manifestSha256 && grant.identitiesSha256 === binding.identitiesSha256
      && grant.hardLimitMicroUsd === auth.hardLimitMicroUsd, 'GRANT_LEDGER_DRIFT')
    const upper = engine.conservativeUpperMicroUsd(auth.pricing.maxInputTokens, 8192, auth.pricing)
    for (let index = 0; index < settled; index++) {
      const unit = units[index], row = state.units[index], reserve = later[1 + 2 * index]?.event, settle = later[2 + 2 * index]?.event
      const raw = read(join(rawPath, String(index + 1).padStart(2, '0') + '.json'))
      check(reserve?.kind === 'd26Reserve' && settle?.kind === 'd26Settle' && reserve.ordinal === index + 1 && settle.ordinal === index + 1
        && reserve.requestSha256 === unit.requestSha256 && reserve.unitIdentitySha256 === unit.unitIdentitySha256 && reserve.upperMicroUsd === upper
        && settle.responseSha256 === row.responseSha256 && settle.costUpperMicroUsd === row.costUpperMicroUsd
        && raw.ordinal === index + 1 && raw.requestSha256 === unit.requestSha256 && raw.unitIdentitySha256 === unit.unitIdentitySha256
        && raw.responseSha256 === row.responseSha256 && digest(raw.rawHttpText) === row.responseSha256, 'RAW_LEDGER_UNIT_DRIFT')
      engine.auditUnitMetadata(raw, row, settle, auth.pricing)
      check(row.usage !== 'NOT_OBSERVABLE', 'PRIOR_USAGE_UNCERTAIN_STOP')
    }
    check(readdirSync(rawPath).length === settled, 'UNEXPECTED_RAW_OR_DUPLICATE')
    check(readdirSync(receiptsPath).length === later.length, 'UNEXPECTED_RECEIPT_OR_APPEND_UNCERTAIN')
    for (const row of later) check(readFileSync(join(receiptsPath, String(row.sequence).padStart(9, '0') + '.json'), 'utf8') === JSON.stringify(row) + '\n', 'RECEIPT_DRIFT')
  }
  const persist = async state => { await fault('persist_' + (state.units.find(row => row.status !== 'SETTLED')?.status ?? 'COMPLETE')); await engine.atomicStateWriter(statePath)(state) }
  const seal = async (code, state) => {
    // The retained cross-process lock also blocks reuse if writing this receipt fails.
    if (!existsSync(haltPath)) writeOnce(haltPath, { version: 'd26-host-halt-1', role, batch: BATCH, code,
      observedAt: new Date().toISOString(), units: state?.units?.map(row => ({ ordinal: row.ordinal, status: row.status })) ?? null,
      instruction: 'READ_ONLY_RECONCILIATION_NO_AUTOMATIC_RETRY_OR_LOCK_REMOVAL' })
  }
  return {
    async verify() {
      const pack = packageRead(), bytes = readFileSync(ledgerPath), chain = validateChain(bytes)
      return { status: 'READ_ONLY_VERIFIED_NO_AUTHORIZATION_IMPLIED', role, snapshot: SNAPSHOT, ...pack.binding, units: pack.units.length,
        authorizationFileExists: existsSync(authPath), lockExists: existsSync(lockPath), haltExists: existsSync(haltPath),
        metricScope: 'THIS_READ_ONLY_OPERATION_NOT_BATCH_TOTALS', modelRequests: 0, grant: 0, reserve: 0, settle: 0,
        ledger: { rows: chain.rows.length, bytes: bytes.length, sha256: digest(bytes), tail: chain.tail } }
    },
    async prepareAuthorized() {
      authorization() // No mkdir or grant on missing/invalid authorization.
      check(!existsSync(statePath) && !existsSync(haltPath), 'RUN_ALREADY_STARTED_OR_HALTED')
      return engine.fileLock(lockPath, async () => {
        const pack = authorization(), { auth, units, binding, authSha256 } = pack
        check(!existsSync(statePath) && !existsSync(haltPath), 'RUN_ALREADY_STARTED_OR_HALTED')
        ledgerRead(auth, false)
        mkdirSync(rawPath); mkdirSync(receiptsPath)
        try {
          await appendRow(auth, { kind: 'd26Grant', batchId: BATCH, grantId: auth.grantId, head: auth.committedHead,
            snapshotCommit: SNAPSHOT, ...binding, hardLimitMicroUsd: auth.hardLimitMicroUsd, authorizationSha256: authSha256, role }, false)
          await fault('after_grant_before_state')
          writeOnce(statePath, { ...engine.newState(units, binding), authorized: true, grantId: auth.grantId, committedHead: auth.committedHead,
            snapshotCommit: SNAPSHOT, hostAuthorizationSha256: authSha256, role })
          return { status: 'AUTHORIZED_NOT_SENT', role, units: 16, grantId: auth.grantId }
        } catch (error) { await seal('GRANT_OR_INITIAL_STATE_UNCERTAIN'); throw error }
      })
    },
    async dispatchNext() {
      authorization()
      check(existsSync(statePath) && !existsSync(haltPath), 'NO_PREPARED_STATE_OR_HALTED')
      // State is loaded after acquiring the OS-visible lock, never before it.
      return engine.fileLock(lockPath, async () => {
        const pack = authorization(), state = read(statePath)
        const ordinal = engine.nextOrdinal(state)
        auditSettled(pack, state, ordinal)
        if (ordinal === null) return { status: 'COMPLETE', sent: 16, role }
        try {
          const row = await engine.runOne({ state, auth: pack.auth, units: pack.units, binding: pack.binding,
            lock: callback => callback(), persist,
            rawStore: { writeOnce: async raw => { await fault('before_raw'); await engine.rawWriter(rawPath).writeOnce(raw); await fault('after_raw') } },
            preflight: async () => {
              const fresh = authorization(); check(fresh.authSha256 === pack.authSha256, 'AUTH_CHANGED_DURING_RUN')
              auditSettled(fresh, state, ordinal)
            },
            ledger: { reserve: args => appendRow(pack.auth, { kind: 'd26Reserve', batchId: BATCH, ...args }),
              settle: args => appendRow(pack.auth, { kind: 'd26Settle', batchId: BATCH, ...args }) },
            transport: { sendOnce: async (body, unit) => {
              const fresh = authorization(); check(fresh.authSha256 === pack.authSha256, 'AUTH_CHANGED_BEFORE_SEND')
              const { later } = ledgerRead(pack.auth, true), reservation = later.at(-1)?.event
              check(later.length === 2 * unit.ordinal && reservation.kind === 'd26Reserve' && reservation.ordinal === unit.ordinal
                && reservation.requestSha256 === unit.requestSha256 && reservation.unitIdentitySha256 === unit.unitIdentitySha256, 'RESERVATION_BEFORE_SEND')
              await fault('before_send')
              const response = await transport.sendOnce(body, unit, pack.auth)
              await fault('after_send')
              return response
            } } })
          // The old executor conservatively settles missing usage. Keep that
          // evidence, but do not proceed to another billable request afterwards.
          if (row.usage === 'NOT_OBSERVABLE') {
            await seal('USAGE_OR_BILLING_UNKNOWN_AFTER_CONSERVATIVE_SETTLEMENT', state)
            throw Error('D26_HOST_USAGE_OR_BILLING_UNKNOWN_STOP')
          }
          return { role, ...row }
        } catch (error) { await seal('UNIT_SEND_RAW_OR_SETTLEMENT_UNCERTAIN', state); throw error }
      })
    },
    async resumeReadOnly() {
      const pack = packageRead(), bytes = readFileSync(ledgerPath), chain = validateChain(bytes)
      const state = existsSync(statePath) ? read(statePath) : null
      let next = null, audit = 'NO_STATE', uncertainty = null, priceStatus = 'NOT_CHECKED_NO_STATE'
      const batchEvents = chain.rows.filter(row => row.event.batchId === BATCH || row.event.batch === BATCH).map(row => row.event)
      const batchLedgerRows = batchEvents.length
      const batchEvidence = { rows: batchLedgerRows, grantCount: batchEvents.filter(event => event.kind === 'd26Grant').length,
        reserveCount: batchEvents.filter(event => event.kind === 'd26Reserve').length, settleCount: batchEvents.filter(event => event.kind === 'd26Settle').length,
        units: pack.units.map(unit => ({ ordinal: unit.ordinal,
          reserveCount: batchEvents.filter(event => event.kind === 'd26Reserve' && event.ordinal === unit.ordinal).length,
          settleCount: batchEvents.filter(event => event.kind === 'd26Settle' && event.ordinal === unit.ordinal).length })) }
      const localEvidence = { rawFiles: existsSync(rawPath) ? readdirSync(rawPath).length : 0,
        receiptFiles: existsSync(receiptsPath) ? readdirSync(receiptsPath).length : 0, incompleteStateWrite: existsSync(statePath + '.new') }
      if (!state && (localEvidence.rawFiles || localEvidence.receiptFiles || localEvidence.incompleteStateWrite)) {
        audit = 'UNRESOLVED'; uncertainty = 'D26_HOST_LOCAL_RECORDS_WITHOUT_STATE'
      }
      if (!state && batchLedgerRows > 0) { audit = 'UNRESOLVED'; uncertainty = 'D26_HOST_LEDGER_BATCH_WITHOUT_STATE' }
      if (state) {
        try {
          const auth = read(authPath)
          // An expired price or a moved HEAD must not prevent read-only forensics.
          // The immutable authorization SHA/identity/ledger/raw checks remain.
          check(state.manifestSha256 === pack.binding.manifestSha256 && state.identitiesSha256 === pack.binding.identitiesSha256, 'READ_ONLY_STATE_BINDING')
          check(digest(readFileSync(join(root, 'USER_AUTHORIZATION.txt'))) === auth.userMessageSha256
            && digest(readFileSync(join(root, 'PRICE_EVIDENCE.json'))) === auth.priceEvidenceSha256, 'READ_ONLY_AUTHORIZATION_EVIDENCE_DRIFT')
          check(isDeepStrictEqual(read(join(root, 'PRICE_EVIDENCE.json')).pricing, auth.pricing), 'READ_ONLY_PRICE_EVIDENCE_BINDING')
          try { engine.validatePriceScope(auth.pricing); priceStatus = 'CURRENT_AS_RECORDED_NOT_REVERIFIED' } catch { priceStatus = 'EXPIRED_OR_INVALID_NO_DISPATCH' }
          next = engine.nextOrdinal(state)
          auditSettled({ ...pack, auth, authSha256: digest(readFileSync(authPath)) }, state, next, true)
          audit = 'CONSISTENT'
        } catch (error) { next = null; audit = 'UNRESOLVED'; uncertainty = safeCode(error) }
      }
      return { status: existsSync(haltPath) || existsSync(lockPath) || audit === 'UNRESOLVED' ? 'HALTED_READ_ONLY' : 'READ_ONLY', role,
        state, nextOrdinal: next, audit, uncertainty, priceStatus, batchEvidence, localEvidence, dispatchEligibility: 'NOT_EVALUATED_READ_ONLY',
        lockExists: existsSync(lockPath), halt: existsSync(haltPath) ? read(haltPath) : null,
        ledger: { rows: chain.rows.length, sha256: digest(bytes), tail: chain.tail, batchRows: batchLedgerRows }, dispatch: 'NOT_PERFORMED', ledgerWrites: 0 }
    },
  }
}

export function safeCode(error) {
  const message = Object.getOwnPropertyDescriptor(error ?? {}, 'message')?.value
  return typeof message === 'string' && /^(?:D26_HOST_|D26_EXEC_|D26_|D17_|CANDIDATE13_D6_BUDGET_)[A-Z0-9_]+$/u.test(message) ? message : 'D26_HOST_OPERATION_FAILED_NO_SENSITIVE_DIAGNOSTICS'
}

/** Inspect only bytes and metadata already received. Offline tests supply a
 * synthetic secret; no credential loader or network is used by this function. */
export function inspectTransportResponse({ bytes, contentType = null, requestId = null }, secret) {
  check(Buffer.isBuffer(bytes) && bytes.length <= 524288, 'RESPONSE_TOO_LARGE')
  check(typeof secret === 'string' && secret.length >= 16, 'RESPONSE_INSPECTION_CONFIGURATION')
  check((contentType === null || typeof contentType === 'string' && contentType.length <= 256)
    && (requestId === null || typeof requestId === 'string' && requestId.length <= 1024), 'RESPONSE_METADATA_INVALID')
  // Invalid UTF-8 is an uncertain response, not a silently rewritten raw.
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  const pending = [text, contentType, requestId].filter(value => value !== null).map(value => ({ text: value, depth: 0 }))
  const seen = new Set(); let inspected = 0
  while (pending.length) {
    const item = pending.pop()
    if (seen.has(item.text)) continue
    seen.add(item.text); inspected += item.text.length
    check(item.depth <= 32 && inspected <= 4194304, 'RESPONSE_INSPECTION_LIMIT')
    check(!item.text.includes(secret), 'CREDENTIAL_REFLECTION')
    for (const match of item.text.matchAll(/"(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\\u0000-\u001f])*"/gu)) {
      const decoded = JSON.parse(match[0])
      check(!decoded.includes(secret), 'CREDENTIAL_REFLECTION')
      if (decoded.includes('"')) pending.push({ text: decoded, depth: item.depth + 1 })
    }
  }
  return { text, contentType, requestId }
}

export async function createLiveHost(snapshotRoot, hostRoot = HOST_ROOT) {
  const root = join(hostRoot, '.data', 'd26', 'execution')
  const packageRead = () => verifySnapshot(snapshotRoot, hostRoot)
  packageRead()
  const engine = await import(pathToFileURL(join(realpathSync(snapshotRoot), 'scripts/d26-executor.mjs')).href)
  return createHost({ root, ledgerPath: AUTHORITATIVE_LEDGER, engine, packageRead, role: 'SCOPED_DEVELOPMENT_HOST_NOT_AUTHORIZATION',
    gitCheck: head => gitBound(hostRoot, head),
    append: async ({ ledgerPath, receipt, before, after }) => {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', join(hostRoot, 'scripts/d25-ledger-append.ps1'),
        '-Ledger', ledgerPath, '-ExpectedSha', digest(before), '-RowPath', receipt, '-ExpectedAfterSha', digest(after)], { stdio: 'pipe' })
    },
    transport: { sendOnce: async (bodyText, unit, auth) => {
      // This branch is unreachable from import, verify, read-only resume, or a
      // missing authorization. Credential values never enter logs/artifacts.
      const { createPinnedProxyFetch, assertModelGatewayConfigured } = await import('./real-input-model-gateway.mjs')
      const env = resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env')
      if (existsSync(env)) process.loadEnvFile(env)
      assertModelGatewayConfigured()
      const secret = process.env.DEEPSEEK_API_KEY, controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 120000)
      try {
        const response = await createPinnedProxyFetch()(auth.endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
          body: bodyText, redirect: 'manual', signal: controller.signal })
        const chunks = []; let length = 0
        for await (const chunk of response.body) { length += chunk.length; check(length <= 524288, 'RESPONSE_TOO_LARGE'); chunks.push(chunk) }
        return { status: response.status, ...inspectTransportResponse({ bytes: Buffer.concat(chunks),
          contentType: response.headers.get('content-type'), requestId: response.headers.get('x-request-id') }, secret) }
      } finally { clearTimeout(timer) }
    } } })
}

/** Offline tests can only use an existing temporary root; no live transport,
 * environment file or authoritative ledger is reachable through this factory. */
export function createOfflineHost(options) {
  const root = realpathSync(options.root), ledgerPath = realpathSync(options.ledgerPath)
  check(contained(realpathSync(tmpdir()), root) && contained(root, ledgerPath) && ledgerPath !== AUTHORITATIVE_LEDGER, 'OFFLINE_TEMP_PATH_REQUIRED')
  return createHost({ ...options, root, ledgerPath, role: 'OFFLINE_ANONYMOUS_FAKE_TRANSPORT' })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [mode, snapshotFlag, snapshotRoot, ...extra] = process.argv.slice(2)
    check(['--verify', '--prepare-authorized', '--dispatch-next', '--resume-read-only'].includes(mode)
      && snapshotFlag === '--snapshot' && snapshotRoot && !extra.length, 'USAGE_REQUIRES_MODE_AND_SNAPSHOT')
    // Missing authorization is rejected even when the supplied snapshot cannot
    // load. This path creates no execution directory or lock.
    if (mode === '--prepare-authorized' || mode === '--dispatch-next') check(existsSync(join(HOST_ROOT, '.data/d26/execution/AUTHORIZATION.json')), 'AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND')
    const host = await createLiveHost(resolve(snapshotRoot))
    const method = { '--verify': 'verify', '--prepare-authorized': 'prepareAuthorized', '--dispatch-next': 'dispatchNext', '--resume-read-only': 'resumeReadOnly' }[mode]
    console.log(JSON.stringify(await host[method](), null, 2))
  } catch (error) { console.error(JSON.stringify({ status: 'STOPPED', code: safeCode(error), retry: false })); process.exitCode = 2 }
}
