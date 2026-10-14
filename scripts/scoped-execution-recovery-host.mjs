// Recovery version derived from the frozen scoped host; frozen host remains unchanged.
// Versioned parameterization of D26 host's existing durable lock/receipt protocol.
import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,readdirSync,realpathSync} from 'node:fs'
import {join,relative,isAbsolute} from 'node:path'
import {tmpdir} from 'node:os'
import {isDeepStrictEqual} from 'node:util'
import {validateChain} from './candidate13-d6-budget.mjs'
import {safeCode} from './d26-execution-host.mjs'
const digest=v=>createHash('sha256').update(v).digest('hex')
const check=(ok,code)=>{if(!ok)throw Error('D26_HOST_'+code)}
const read=p=>JSON.parse(readFileSync(p,'utf8'))
function writeOnce(path,value){const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}}
export function createRecoveryScopedHost(scope,options){
const BATCH=scope.batch,COUNT=scope.count,SNAPSHOT=scope.snapshot
check(/^[A-Z0-9-]+$/.test(BATCH)&&Number.isInteger(COUNT)&&COUNT>0&&COUNT<=24&&/^[a-f0-9]{40}$/.test(SNAPSHOT),'SCOPED_HOST')
if(options.role==='OFFLINE_ANONYMOUS_FAKE_TRANSPORT'){const rel=relative(realpathSync(tmpdir()),realpathSync(options.root)),lrel=relative(realpathSync(options.root),realpathSync(options.ledgerPath));check(rel&&!rel.startsWith('..')&&!isAbsolute(rel)&&lrel&&!lrel.startsWith('..')&&!isAbsolute(lrel),'OFFLINE_TEMP_PATH_REQUIRED')}
function assertHostAuthorization(auth, engine, units, binding, now = Date.now()) {
  engine.assertAuthorization(engine.newState(units, binding), auth, units, binding)
  check(auth.hostVersion === 'scoped-execution-host-2' && auth.snapshotCommit === SNAPSHOT, 'HOST_AND_SNAPSHOT_AUTH')
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

function createHost({ root, ledgerPath, engine, packageRead, gitCheck, append, transport, role, renewal, fault = async () => {} }) {
  const authPath = join(root, 'AUTHORIZATION.json'), statePath = join(root, 'STATE.json'), lockPath = join(root, 'lock')
  const rawPath = join(root, 'raw'), receiptsPath = join(root, 'receipts'), haltPath = join(root, 'HALT.json')
  const authorization = () => {
    check(existsSync(authPath), 'AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND')
    const originalAuth = read(authPath), pack = packageRead()
    const auth = renewal ? renewal(originalAuth) : originalAuth
    assertHostAuthorization(auth, engine, pack.units, pack.binding)
    check(digest(readFileSync(join(root, 'USER_AUTHORIZATION.txt'))) === auth.userMessageSha256, 'USER_AUTHORIZATION_EVIDENCE')
    const evidenceBytes = readFileSync(join(root, 'PRICE_EVIDENCE.json')), evidence = JSON.parse(evidenceBytes)
    check(digest(evidenceBytes) === originalAuth.priceEvidenceSha256
      && isDeepStrictEqual(evidence.pricing, originalAuth.pricing)
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
    else check(later[0]?.event.kind === 'scopedGrant' && later.every(row => row.event.batchId === BATCH && row.event.grantId === auth.grantId), 'LEDGER_BATCH_DRIFT')
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
    else check(state.version === 'scoped-execution-state-2' && state.batch === BATCH && state.model === 'deepseek-flash'
      && state.manifestSha256 === binding.manifestSha256 && state.identitiesSha256 === binding.identitiesSha256
      && state.units.length === COUNT && state.units.every((row, index) => row.ordinal === index + 1
        && row.unitIdentitySha256 === units[index].unitIdentitySha256 && row.requestSha256 === units[index].requestSha256
        && auth.units[index] === row.unitIdentitySha256 && auth.requestSha256s[index] === row.requestSha256), 'READ_ONLY_IDENTITY_DRIFT')
    check(engine.nextOrdinal(state) === ordinal, 'STATE_ORDER')
    const { later } = ledgerRead(auth, true), settled = state.units.filter(row => row.status === 'SETTLED').length
    check(later.length === 1 + 2 * settled && (ordinal === null ? settled === COUNT : ordinal === settled + 1), 'LEDGER_STATE_DRIFT')
    const grant = later[0].event
    check(grant.head === auth.committedHead && grant.snapshotCommit === SNAPSHOT && grant.authorizationSha256 === authSha256
      && grant.manifestSha256 === binding.manifestSha256 && grant.identitiesSha256 === binding.identitiesSha256
      && grant.hardLimitMicroUsd === auth.hardLimitMicroUsd, 'GRANT_LEDGER_DRIFT')
    const upper = engine.conservativeUpperMicroUsd(auth.pricing.maxInputTokens, 8192, auth.pricing)
    for (let index = 0; index < settled; index++) {
      const unit = units[index], row = state.units[index], reserve = later[1 + 2 * index]?.event, settle = later[2 + 2 * index]?.event
      const raw = read(join(rawPath, String(index + 1).padStart(2, '0') + '.json'))
      check(reserve?.kind === 'scopedReserve' && settle?.kind === 'scopedSettle' && reserve.ordinal === index + 1 && settle.ordinal === index + 1
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
    async prepareAuthorized() { throw Error('D26_HOST_RECOVERY_NO_NEW_GRANT') },
    async dispatchNext() {
      authorization()
      check(existsSync(statePath) && !existsSync(haltPath), 'NO_PREPARED_STATE_OR_HALTED')
      // State is loaded after acquiring the OS-visible lock, never before it.
      return engine.fileLock(lockPath, async () => {
        const pack = authorization(), state = read(statePath)
        const ordinal = engine.nextOrdinal(state)
        auditSettled(pack, state, ordinal)
        if (ordinal === null) return { status: 'COMPLETE', sent: COUNT, role }
        try {
          const row = await engine.runOne({ state, auth: pack.auth, units: pack.units, binding: pack.binding,
            lock: callback => callback(), persist,
            rawStore: { writeOnce: async raw => { await fault('before_raw'); await engine.rawWriter(rawPath).writeOnce(raw); await fault('after_raw') } },
            preflight: async () => {
              const fresh = authorization(); check(fresh.authSha256 === pack.authSha256, 'AUTH_CHANGED_DURING_RUN')
              auditSettled(fresh, state, ordinal)
            },
            ledger: { reserve: args => appendRow(pack.auth, { kind: 'scopedReserve', batchId: BATCH, ...args }),
              settle: args => appendRow(pack.auth, { kind: 'scopedSettle', batchId: BATCH, ...args }) },
            transport: { sendOnce: async (body, unit) => {
              const fresh = authorization(); check(fresh.authSha256 === pack.authSha256, 'AUTH_CHANGED_BEFORE_SEND')
              const { later } = ledgerRead(pack.auth, true), reservation = later.at(-1)?.event
              check(later.length === 2 * unit.ordinal && reservation.kind === 'scopedReserve' && reservation.ordinal === unit.ordinal
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
      const batchEvidence = { rows: batchLedgerRows, grantCount: batchEvents.filter(event => event.kind === 'scopedGrant').length,
        reserveCount: batchEvents.filter(event => event.kind === 'scopedReserve').length, settleCount: batchEvents.filter(event => event.kind === 'scopedSettle').length,
        units: pack.units.map(unit => ({ ordinal: unit.ordinal,
          reserveCount: batchEvents.filter(event => event.kind === 'scopedReserve' && event.ordinal === unit.ordinal).length,
          settleCount: batchEvents.filter(event => event.kind === 'scopedSettle' && event.ordinal === unit.ordinal).length })) }
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

return createHost(options)
}
