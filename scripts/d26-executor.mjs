import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { D26_ROOT, D26_BATCH, verifyD26, sha } from './prepare-d26.mjs'
import { fileLock, atomicStateWriter, rawWriter } from './candidate17-d17-executor.mjs'
export { fileLock, atomicStateWriter, rawWriter }

export const MAX_OUTPUT_TOKENS = 8192
export const MAX_CONTEXT_TOKENS = 1_048_576
const check = (value, code) => { if (!value) throw Error('D26_EXEC_' + code) }
export function validatePriceScope(pricing, now = Date.now()) {
  check(pricing && pricing.sourceUrl === 'https://api-docs.deepseek.com/quick_start/pricing/', 'OFFICIAL_PRICE_REQUIRED')
  const verified = Date.parse(pricing.verifiedAt), until = Date.parse(pricing.validUntil)
  check(Number.isFinite(verified) && Number.isFinite(until) && verified <= now && until > now && until - verified <= 12 * 3600000, 'PRICE_STALE')
  check(Number.isFinite(pricing.peakInputUsdPerMillion) && pricing.peakInputUsdPerMillion >= 0
    && Number.isFinite(pricing.peakOutputUsdPerMillion) && pricing.peakOutputUsdPerMillion >= 0
    && pricing.maxInputTokens === MAX_CONTEXT_TOKENS, 'PRICE_OR_CONTEXT_INVALID')
}
export function conservativeUpperMicroUsd(inputTokens, outputTokens, pricing) {
  check(Number.isSafeInteger(inputTokens) && inputTokens >= 0 && inputTokens <= pricing.maxInputTokens
    && Number.isSafeInteger(outputTokens) && outputTokens >= 0 && outputTokens <= MAX_OUTPUT_TOKENS, 'TOKEN_BOUND')
  // USD per million tokens times tokens is micro USD. This is a budget upper,
  // never a claimed provider charge or a byte-to-token estimate.
  const cost = Math.ceil(inputTokens * pricing.peakInputUsdPerMillion + outputTokens * pricing.peakOutputUsdPerMillion)
  check(Number.isSafeInteger(cost) && cost >= 0, 'COST_OVERFLOW')
  return cost
}
export function rawUsage(rawHttpText) {
  try {
    const usage = JSON.parse(rawHttpText).usage
    if (usage && Number.isSafeInteger(usage.input_tokens) && usage.input_tokens >= 0
      && Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0) return usage
  } catch { /* Preserve the actual raw failure and denominator. */ }
  return 'NOT_OBSERVABLE'
}
export function frozenRequests(root = D26_ROOT) {
  verifyD26(root)
  const units = JSON.parse(readFileSync(join(root, 'PREPARED_REQUEST_IDENTITIES.json'), 'utf8')).requests
  for (const unit of units) check(unit.body.model === 'deepseek-flash' && unit.body.temperature === 0
    && unit.body.reasoning?.effort === 'none' && unit.body.max_output_tokens === MAX_OUTPUT_TOKENS && unit.body.stream === false, 'PARAMETERS')
  const pairs = Array.from({ length: 8 }, (_, index) => units.slice(index * 2, index * 2 + 2))
  check(pairs.every(pair => pair[0].sourceId === pair[1].sourceId && pair[0].arm !== pair[1].arm)
    && pairs.filter(pair => pair[0].arm === 'A').length === 4, 'ORDER_BALANCE')
  return units
}
export function newState(units = frozenRequests(), binding = verifyD26()) {
  return { version: 'd26-execution-state-1', batch: D26_BATCH, model: 'deepseek-flash', ...binding, authorized: false,
    units: units.map(unit => ({ ordinal: unit.ordinal, unitIdentitySha256: unit.unitIdentitySha256, requestSha256: unit.requestSha256, status: 'NOT_SENT' })) }
}
export function assertAuthorization(state, auth, units, binding) {
  check(state.version === 'd26-execution-state-1' && state.batch === D26_BATCH && state.model === 'deepseek-flash' && state.units.length === 16 && units.length === 16, 'STATE')
  check(auth?.authorized === true && auth.authorizationSource === 'CURRENT_USER_MESSAGE' && /^[a-f0-9]{64}$/u.test(auth.userMessageSha256)
    && auth.batch === D26_BATCH && auth.count === 16 && auth.model === state.model
    && auth.manifestSha256 === binding.manifestSha256 && auth.identitiesSha256 === binding.identitiesSha256
    && state.manifestSha256 === binding.manifestSha256 && state.identitiesSha256 === binding.identitiesSha256
    && Number.isSafeInteger(auth.hardLimitMicroUsd) && auth.hardLimitMicroUsd > 0
    && typeof auth.grantId === 'string' && auth.grantId.length > 0 && /^[a-f0-9]{40}$/u.test(auth.committedHead), 'AUTHORIZATION_REQUIRED')
  check(auth.endpoint === 'https://api.deepseek.com/responses' && auth.retry === 0 && auth.repair === 0 && auth.verifier === 0, 'ROUTE_OR_EXTRA_CALLS')
  check(auth.units?.length === 16 && auth.requestSha256s?.length === 16 && state.units.every((row, index) => row.ordinal === index + 1
    && row.unitIdentitySha256 === units[index].unitIdentitySha256 && row.requestSha256 === units[index].requestSha256
    && auth.units[index] === row.unitIdentitySha256 && auth.requestSha256s[index] === row.requestSha256), 'IDENTITY_DRIFT')
  validatePriceScope(auth.pricing)
  check(16 * conservativeUpperMicroUsd(auth.pricing.maxInputTokens, MAX_OUTPUT_TOKENS, auth.pricing) <= auth.hardLimitMicroUsd, 'BUDGET_UNRESOLVED')
}
export function nextOrdinal(state) {
  const next = state.units.find(row => row.status !== 'SETTLED')
  if (!next) return null
  check(next.status === 'NOT_SENT' && state.units.slice(0, next.ordinal - 1).every(row => row.status === 'SETTLED')
    && state.units.slice(next.ordinal).every(row => row.status === 'NOT_SENT'), 'UNCERTAIN_OR_DUPLICATE')
  return next.ordinal
}
export function auditUnitMetadata(raw, row, settle, pricing) {
  const usage = rawUsage(raw.rawHttpText)
  const cost = usage === 'NOT_OBSERVABLE' ? conservativeUpperMicroUsd(pricing.maxInputTokens, MAX_OUTPUT_TOKENS, pricing)
    : conservativeUpperMicroUsd(usage.input_tokens, usage.output_tokens, pricing)
  check(raw.httpStatus === row.httpStatus && row.httpStatus === settle.httpStatus
    && JSON.stringify(usage) === JSON.stringify(row.usage) && JSON.stringify(usage) === JSON.stringify(settle.usage)
    && cost === row.costUpperMicroUsd && cost === settle.costUpperMicroUsd, 'RAW_STATE_SETTLEMENT_METADATA_DRIFT')
  return { usage, costUpperMicroUsd: cost }
}
/** No default transport, credential loader or ledger path. Real adapters require a new scoped authorization and preflight. */
export async function runOne({ state, auth, units, binding, ledger, transport, persist, rawStore, lock, preflight }) {
  check(typeof lock === 'function', 'CROSS_PROCESS_LOCK_REQUIRED')
  return lock(async () => {
    assertAuthorization(state, auth, units, binding)
    const ordinal = nextOrdinal(state); check(ordinal !== null, 'COMPLETE')
    const unit = units[ordinal - 1], row = state.units[ordinal - 1]
    check(sha(JSON.stringify(unit.body)) === unit.requestSha256 && unit.body.model === 'deepseek-flash'
      && unit.body.temperature === 0 && unit.body.reasoning?.effort === 'none' && unit.body.max_output_tokens === MAX_OUTPUT_TOKENS
      && unit.body.stream === false, 'REQUEST_OR_PARAMETERS_DRIFT')
    check(ledger && transport && persist && rawStore && typeof preflight === 'function', 'ADAPTER_REQUIRED')
    await preflight({ state, auth, unit, ordinal })
    validatePriceScope(auth.pricing)
    const upper = conservativeUpperMicroUsd(auth.pricing.maxInputTokens, MAX_OUTPUT_TOKENS, auth.pricing)
    check(state.units.reduce((sum, entry) => sum + (entry.status === 'SETTLED' ? entry.costUpperMicroUsd : 0), 0) + upper <= auth.hardLimitMicroUsd, 'BUDGET_EXCEEDED')
    try {
      await ledger.reserve({ batch: D26_BATCH, grantId: auth.grantId, ordinal, requestSha256: unit.requestSha256, unitIdentitySha256: unit.unitIdentitySha256, upperMicroUsd: upper })
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
        requestId: response.requestId ?? null, contentType: response.contentType ?? null, rawHttpText: response.text, responseSha256: sha(response.text), receivedAt: new Date().toISOString() }
      await rawStore.writeOnce(raw); row.status = 'RAW_SAVED'; row.responseSha256 = raw.responseSha256; await persist(state)
      const usage = rawUsage(response.text), costUpperMicroUsd = usage === 'NOT_OBSERVABLE' ? upper
        : conservativeUpperMicroUsd(usage.input_tokens, usage.output_tokens, auth.pricing)
      await ledger.settle({ batch: D26_BATCH, grantId: auth.grantId, ordinal, responseSha256: raw.responseSha256, httpStatus: response.status,
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
export function offlineAudit(root = D26_ROOT) {
  return { ...verifyD26(root), modelRequests: 0, grant: 0, reserve: 0, settle: 0,
    pricing: 'REQUIRES_FRESH_OFFICIAL_VERIFICATION_AND_BATCH_AUTHORIZATION', providerActualUsd: 'NOT_OBSERVABLE', ledgerMode: 'NO_LEDGER_READ_OR_WRITE' }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === '--verify') console.log(JSON.stringify(offlineAudit()))
  else throw Error('D26_AUTHORIZATION_REQUIRED_NO_GRANT_NO_DEFAULT_TRANSPORT')
}
