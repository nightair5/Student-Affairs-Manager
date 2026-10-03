// Versioned extraction of D26's once-send core. Original frozen code stays unchanged.
import {createHash} from 'node:crypto'
import {fileLock,atomicStateWriter,rawWriter,validatePriceScope,conservativeUpperMicroUsd,rawUsage,nextOrdinal,auditUnitMetadata,MAX_OUTPUT_TOKENS} from './d26-executor.mjs'
export {fileLock,atomicStateWriter,rawWriter,validatePriceScope,conservativeUpperMicroUsd,rawUsage,nextOrdinal,auditUnitMetadata}
const digest=v=>createHash('sha256').update(v).digest('hex')
const check=(ok,code)=>{if(!ok)throw Error('D26_EXEC_'+code)}
export function createScopedEngine(scope){
check(scope&&/^[A-Z0-9-]+$/.test(scope.batch)&&Number.isInteger(scope.count)&&scope.count>0&&scope.count<=24,'SCOPED_BATCH')
function newState(units, binding) {
  return { version: 'scoped-execution-state-2', batch: scope.batch, model: 'deepseek-flash', ...binding, authorized: false,
    units: units.map(unit => ({ ordinal: unit.ordinal, unitIdentitySha256: unit.unitIdentitySha256, requestSha256: unit.requestSha256, status: 'NOT_SENT' })) }
}
function assertAuthorization(state, auth, units, binding) {
  check(state.version === 'scoped-execution-state-2' && state.batch === scope.batch && state.model === 'deepseek-flash' && state.units.length === scope.count && units.length === scope.count, 'STATE')
  check(auth?.authorized === true && auth.authorizationSource === 'CURRENT_USER_MESSAGE' && /^[a-f0-9]{64}$/u.test(auth.userMessageSha256)
    && auth.batch === scope.batch && auth.count === scope.count && auth.model === state.model
    && auth.manifestSha256 === binding.manifestSha256 && auth.identitiesSha256 === binding.identitiesSha256
    && state.manifestSha256 === binding.manifestSha256 && state.identitiesSha256 === binding.identitiesSha256
    && Number.isSafeInteger(auth.hardLimitMicroUsd) && auth.hardLimitMicroUsd > 0
    && typeof auth.grantId === 'string' && auth.grantId.length > 0 && /^[a-f0-9]{40}$/u.test(auth.committedHead), 'AUTHORIZATION_REQUIRED')
  check(auth.endpoint === 'https://api.deepseek.com/responses' && auth.retry === 0 && auth.repair === 0 && auth.verifier === 0, 'ROUTE_OR_EXTRA_CALLS')
  check(auth.units?.length === scope.count && auth.requestSha256s?.length === scope.count && state.units.every((row, index) => row.ordinal === index + 1
    && row.unitIdentitySha256 === units[index].unitIdentitySha256 && row.requestSha256 === units[index].requestSha256
    && auth.units[index] === row.unitIdentitySha256 && auth.requestSha256s[index] === row.requestSha256), 'IDENTITY_DRIFT')
  validatePriceScope(auth.pricing)
  check(scope.count * conservativeUpperMicroUsd(auth.pricing.maxInputTokens, MAX_OUTPUT_TOKENS, auth.pricing) <= auth.hardLimitMicroUsd, 'BUDGET_UNRESOLVED')
}
async function runOne({ state, auth, units, binding, ledger, transport, persist, rawStore, lock, preflight }) {
  check(typeof lock === 'function', 'CROSS_PROCESS_LOCK_REQUIRED')
  return lock(async () => {
    assertAuthorization(state, auth, units, binding)
    const ordinal = nextOrdinal(state); check(ordinal !== null, 'COMPLETE')
    const unit = units[ordinal - 1], row = state.units[ordinal - 1]
    check(digest(JSON.stringify(unit.body)) === unit.requestSha256 && unit.body.model === 'deepseek-flash'
      && unit.body.temperature === 0 && unit.body.reasoning?.effort === 'none' && unit.body.max_output_tokens === MAX_OUTPUT_TOKENS
      && unit.body.stream === false, 'REQUEST_OR_PARAMETERS_DRIFT')
    check(ledger && transport && persist && rawStore && typeof preflight === 'function', 'ADAPTER_REQUIRED')
    await preflight({ state, auth, unit, ordinal })
    validatePriceScope(auth.pricing)
    const upper = conservativeUpperMicroUsd(auth.pricing.maxInputTokens, MAX_OUTPUT_TOKENS, auth.pricing)
    check(state.units.reduce((sum, entry) => sum + (entry.status === 'SETTLED' ? entry.costUpperMicroUsd : 0), 0) + upper <= auth.hardLimitMicroUsd, 'BUDGET_EXCEEDED')
    try {
      await ledger.reserve({ batch: scope.batch, grantId: auth.grantId, ordinal, requestSha256: unit.requestSha256, unitIdentitySha256: unit.unitIdentitySha256, upperMicroUsd: upper })
      row.status = 'RESERVED'; await persist(state)
    } catch (error) {
      row.status = 'UNCERTAIN'; row.haltReason = 'RESERVE_OR_STATE'; await persist(state).catch(() => {})
      throw Error('D26_RESERVE_UNCERTAIN', { cause: error })
    }
    try {
      row.status = 'SENDING'; await persist(state)
      const response = await transport.sendOnce(JSON.stringify(unit.body), unit)
      check(response && Number.isInteger(response.status) && typeof response.text === 'string', 'TRANSPORT')
      const raw = { ordinal, requestSha256: unit.requestSha256, unitIdentitySha256: unit.unitIdentitySha256, httpStatus: response.status,
        requestId: response.requestId ?? null, contentType: response.contentType ?? null, rawHttpText: response.text, responseSha256: digest(response.text), receivedAt: new Date().toISOString() }
      await rawStore.writeOnce(raw); row.status = 'RAW_SAVED'; row.responseSha256 = raw.responseSha256; await persist(state)
      const usage = rawUsage(response.text), costUpperMicroUsd = usage === 'NOT_OBSERVABLE' ? upper
        : conservativeUpperMicroUsd(usage.input_tokens, usage.output_tokens, auth.pricing)
      await ledger.settle({ batch: scope.batch, grantId: auth.grantId, ordinal, responseSha256: raw.responseSha256, httpStatus: response.status,
        usage, costUpperMicroUsd, providerActualUsd: 'NOT_OBSERVABLE' })
      row.status = 'SETTLED'; row.httpStatus = response.status; row.usage = usage; row.costUpperMicroUsd = costUpperMicroUsd; await persist(state)
      return row
    } catch (error) {
      row.haltReason = row.status === 'RAW_SAVED' ? 'SETTLE_OR_STATE' : 'SEND_RAW_OR_STATE'
      row.status = 'UNCERTAIN'; await persist(state).catch(() => {})
      throw Error('D26_SAFETY_STOP_UNCERTAIN', { cause: error })
    }
  })
}
return {newState,assertAuthorization,runOne,fileLock,atomicStateWriter,rawWriter,validatePriceScope,conservativeUpperMicroUsd,rawUsage,nextOrdinal,auditUnitMetadata}
}
