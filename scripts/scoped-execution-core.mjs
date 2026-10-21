// Versioned extraction of D26's once-send core. Original frozen code stays unchanged.
import {createHash} from 'node:crypto'
import {fileLock,atomicStateWriter,rawWriter,validatePriceScope,conservativeUpperMicroUsd,rawUsage,nextOrdinal,auditUnitMetadata,MAX_OUTPUT_TOKENS} from './d26-executor.mjs'
import {classifyPhaseError} from './scoped-execution-diagnostics.mjs'
export {fileLock,atomicStateWriter,rawWriter,validatePriceScope,conservativeUpperMicroUsd,rawUsage,nextOrdinal,auditUnitMetadata}
const digest=v=>createHash('sha256').update(v).digest('hex')
const check=(ok,code)=>{if(!ok)throw Error('D26_EXEC_'+code)}
export function createScopedEngine(scope,{diagnostics}={}){
check(scope&&/^[A-Z0-9-]+$/.test(scope.batch)&&Number.isInteger(scope.count)&&scope.count>0&&scope.count<=24,'SCOPED_BATCH')
const parameters=scope.parameters??{temperature:0,maxOutputTokens:MAX_OUTPUT_TOKENS}
const modelAware=parameters.transportRoute==='worker-chat-completions-model-2'
const workerChat=parameters.transportRoute==='worker-chat-completions-1'||modelAware
const billingModel=modelAware?parameters.billingModel:'deepseek-flash'
const actualModel=modelAware?parameters.actualModel:'deepseek-v4-flash'
const thinking=modelAware?parameters.thinking:'disabled'
if(modelAware)check(['deepseek-v4-flash','deepseek-flash','deepseek-v4-pro'].includes(actualModel)&&billingModel===(actualModel==='deepseek-v4-pro'?'deepseek-v4-pro':'deepseek-flash')&&['enabled','disabled'].includes(thinking),'MODEL_PROFILE')
// New Worker requests explicitly bind their larger output budget. Frozen
// Responses and 6000-token Worker packets retain the original 8192 reserve.
const budgetOutputTokens=workerChat?Math.max(MAX_OUTPUT_TOKENS,parameters.maxOutputTokens):MAX_OUTPUT_TOKENS
const scopedUpper=(input,output,pricing)=>{
 if(budgetOutputTokens===MAX_OUTPUT_TOKENS)return conservativeUpperMicroUsd(input,output,pricing)
 check(pricing.maxOutputTokens===budgetOutputTokens&&Number.isSafeInteger(input)&&input>=0&&input<=pricing.maxInputTokens&&Number.isSafeInteger(output)&&output>=0&&output<=budgetOutputTokens,'TOKEN_BOUND')
 const cost=Math.ceil(input*pricing.peakInputUsdPerMillion+output*pricing.peakOutputUsdPerMillion);check(Number.isSafeInteger(cost)&&cost>=0,'COST_OVERFLOW');return cost
}
const observedUsage=text=>{if(!workerChat)return rawUsage(text);try{const u=JSON.parse(text).usage;if(Number.isSafeInteger(u?.prompt_tokens)&&u.prompt_tokens>=0&&Number.isSafeInteger(u?.completion_tokens)&&u.completion_tokens>=0)return {...u,input_tokens:u.prompt_tokens,output_tokens:u.completion_tokens,usageBoundary:'NATIVE_CHAT_COMPLETIONS'}}catch{/* Original bytes remain authoritative; absent usage is unknown. */}return 'NOT_OBSERVABLE'}
const auditMetadata=(raw,row,settle,pricing)=>{if(!workerChat)return auditUnitMetadata(raw,row,settle,pricing);const usage=observedUsage(raw.rawHttpText),cost=usage==='NOT_OBSERVABLE'?scopedUpper(pricing.maxInputTokens,budgetOutputTokens,pricing):scopedUpper(usage.input_tokens,usage.output_tokens,pricing);check(raw.httpStatus===row.httpStatus&&row.httpStatus===settle.httpStatus&&JSON.stringify(usage)===JSON.stringify(row.usage)&&JSON.stringify(usage)===JSON.stringify(settle.usage)&&cost===row.costUpperMicroUsd&&cost===settle.costUpperMicroUsd,'RAW_STATE_SETTLEMENT_METADATA_DRIFT');return {usage,costUpperMicroUsd:cost}}
check(Number.isFinite(parameters.temperature)&&parameters.temperature>=0&&parameters.temperature<=2&&Number.isSafeInteger(parameters.maxOutputTokens)&&parameters.maxOutputTokens>0&&parameters.maxOutputTokens<=(modelAware?32768:workerChat?16384:MAX_OUTPUT_TOKENS),'SCOPED_PARAMETERS')
function newState(units, binding) {
  return { version: 'scoped-execution-state-2', batch: scope.batch, model: billingModel, ...binding, authorized: false,
    units: units.map(unit => ({ ordinal: unit.ordinal, unitIdentitySha256: unit.unitIdentitySha256, requestSha256: unit.requestSha256, status: 'NOT_SENT' })) }
}
function assertAuthorization(state, auth, units, binding) {
  check(state.version === 'scoped-execution-state-2' && state.batch === scope.batch && state.model === billingModel && state.units.length === scope.count && units.length === scope.count, 'STATE')
  check(auth?.authorized === true && auth.authorizationSource === 'CURRENT_USER_MESSAGE' && /^[a-f0-9]{64}$/u.test(auth.userMessageSha256)
    && auth.batch === scope.batch && auth.count === scope.count && auth.model === state.model
    && auth.manifestSha256 === binding.manifestSha256 && auth.identitiesSha256 === binding.identitiesSha256
    && state.manifestSha256 === binding.manifestSha256 && state.identitiesSha256 === binding.identitiesSha256
    && Number.isSafeInteger(auth.hardLimitMicroUsd) && auth.hardLimitMicroUsd > 0
    && typeof auth.grantId === 'string' && auth.grantId.length > 0 && /^[a-f0-9]{40}$/u.test(auth.committedHead), 'AUTHORIZATION_REQUIRED')
  check(auth.endpoint === (workerChat?'https://api.deepseek.com/chat/completions':'https://api.deepseek.com/responses') && auth.retry === 0 && auth.repair === 0 && auth.verifier === 0, 'ROUTE_OR_EXTRA_CALLS')
  check(auth.units?.length === scope.count && auth.requestSha256s?.length === scope.count && state.units.every((row, index) => row.ordinal === index + 1
    && row.unitIdentitySha256 === units[index].unitIdentitySha256 && row.requestSha256 === units[index].requestSha256
    && auth.units[index] === row.unitIdentitySha256 && auth.requestSha256s[index] === row.requestSha256), 'IDENTITY_DRIFT')
  validatePriceScope(auth.pricing)
  check(scope.count * scopedUpper(auth.pricing.maxInputTokens, budgetOutputTokens, auth.pricing) <= auth.hardLimitMicroUsd, 'BUDGET_UNRESOLVED')
}
async function runOne({ state, auth, units, binding, ledger, transport, persist, rawStore, lock, preflight }) {
  check(typeof lock === 'function', 'CROSS_PROCESS_LOCK_REQUIRED')
  return lock(async () => {
    assertAuthorization(state, auth, units, binding)
    const ordinal = nextOrdinal(state); check(ordinal !== null, 'COMPLETE')
    const unit = units[ordinal - 1], row = state.units[ordinal - 1]
    let phase=null
    const mark=async next=>{phase=next;await diagnostics?.record({ordinal,unitIdentitySha256:unit.unitIdentitySha256,requestSha256:unit.requestSha256,phase})}
    const stop=async error=>{try{await diagnostics?.record({ordinal,unitIdentitySha256:unit.unitIdentitySha256,requestSha256:unit.requestSha256,
      phase:'STOP_UNCERTAIN',failedPhase:phase,code:classifyPhaseError(error)})}catch{/* Preserve the original safety stop even when observation fails. */}}
    check(digest(JSON.stringify(unit.body)) === unit.requestSha256 && (modelAware&&thinking==='enabled'?unit.body.temperature===undefined:unit.body.temperature === parameters.temperature)
      && (workerChat
        ? unit.body.model===actualModel && unit.body.thinking?.type===thinking && (!modelAware||thinking!=='enabled'||unit.body.reasoning_effort==='high') && unit.body.max_tokens===parameters.maxOutputTokens && unit.body.response_format?.type==='json_object' && Array.isArray(unit.body.messages)
        : unit.body.model==='deepseek-flash' && unit.body.reasoning?.effort==='none' && unit.body.max_output_tokens===parameters.maxOutputTokens && unit.body.stream===false), 'REQUEST_OR_PARAMETERS_DRIFT')
    check(ledger && transport && persist && rawStore && typeof preflight === 'function', 'ADAPTER_REQUIRED')
    await preflight({ state, auth, unit, ordinal })
    validatePriceScope(auth.pricing)
    const upper = scopedUpper(auth.pricing.maxInputTokens, budgetOutputTokens, auth.pricing)
    check(state.units.reduce((sum, entry) => sum + (entry.status === 'SETTLED' ? entry.costUpperMicroUsd : 0), 0) + upper <= auth.hardLimitMicroUsd, 'BUDGET_EXCEEDED')
    try {
      await mark('RESERVE_ENTER')
      await ledger.reserve({ batch: scope.batch, grantId: auth.grantId, ordinal, requestSha256: unit.requestSha256, unitIdentitySha256: unit.unitIdentitySha256, upperMicroUsd: upper })
      await mark('RESERVE_COMPLETED');row.status = 'RESERVED';await mark('RESERVED_STATE_WRITE_ENTER');await persist(state);await mark('RESERVED_STATE_WRITE_COMPLETED')
    } catch (error) {
      await stop(error)
      row.status = 'UNCERTAIN'; row.haltReason = 'RESERVE_OR_STATE'; await persist(state).catch(() => {})
      throw Error('D26_RESERVE_UNCERTAIN', { cause: error })
    }
    try {
      row.status = 'SENDING';await mark('SENDING_STATE_WRITE_ENTER');await persist(state);await mark('SENDING_STATE_WRITE_COMPLETED')
      await mark('TRANSPORT_ENTER')
      const response = await transport.sendOnce(JSON.stringify(unit.body), unit, {mark})
      await mark('TRANSPORT_RETURNED')
      check(response && Number.isInteger(response.status) && typeof response.text === 'string', 'TRANSPORT')
      const raw = { ordinal, requestSha256: unit.requestSha256, unitIdentitySha256: unit.unitIdentitySha256, httpStatus: response.status,
        requestId: response.requestId ?? null, contentType: response.contentType ?? null, rawHttpText: response.text, responseSha256: digest(response.text), receivedAt: new Date().toISOString() }
      await mark('RAW_WRITE_ENTER');await rawStore.writeOnce(raw);await mark('RAW_WRITE_COMPLETED')
      row.status = 'RAW_SAVED'; row.responseSha256 = raw.responseSha256;await mark('RAW_STATE_WRITE_ENTER');await persist(state);await mark('RAW_STATE_WRITE_COMPLETED')
      const usage = observedUsage(response.text), costUpperMicroUsd = usage === 'NOT_OBSERVABLE' ? upper
        : scopedUpper(usage.input_tokens, usage.output_tokens, auth.pricing)
      await mark('SETTLE_ENTER');await ledger.settle({ batch: scope.batch, grantId: auth.grantId, ordinal, responseSha256: raw.responseSha256, httpStatus: response.status,
        usage, costUpperMicroUsd, providerActualUsd: 'NOT_OBSERVABLE' })
      await mark('SETTLE_COMPLETED');row.status = 'SETTLED'; row.httpStatus = response.status; row.usage = usage; row.costUpperMicroUsd = costUpperMicroUsd
      await mark('SETTLED_STATE_WRITE_ENTER');await persist(state);await mark('SETTLED_STATE_WRITE_COMPLETED')
      return row
    } catch (error) {
      await stop(error)
      row.haltReason = row.status === 'RAW_SAVED' ? 'SETTLE_OR_STATE' : 'SEND_RAW_OR_STATE'
      row.status = 'UNCERTAIN'; await persist(state).catch(() => {})
      throw Error('D26_SAFETY_STOP_UNCERTAIN', { cause: error })
    }
  })
}
return {billingModel,workerChat,newState,assertAuthorization,runOne,fileLock,atomicStateWriter,rawWriter,validatePriceScope,conservativeUpperMicroUsd:scopedUpper,budgetOutputTokens,rawUsage:observedUsage,nextOrdinal,auditUnitMetadata:auditMetadata}
}
