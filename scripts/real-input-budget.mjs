import { createHash, randomUUID } from 'node:crypto'
import { open, readFile, mkdir, readdir, lstat, realpath, unlink, rmdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

// Micro-CNY integers. Full input is charged at peak uncached price, including cached tokens.
export const BILLING_POLICY = Object.freeze({ version: 'real-input-budget-2', model: 'deepseek-v4-flash-vision-exp',
  endpoint: 'https://api.deepseek.com/responses', temperature: 0, reasoningEffort: 'none',
  inputTokenCeiling: 1048576, outputTokenCeiling: 8192, requestByteCeiling: 65536,
  inputPriceMicroPerMillion: 3000000, outputPriceMicroPerMillion: 9000000,
  reservationMicroCny: 3300000, limitMicroCny: 10000000, maxRequests: 24 })
export const sha256 = value => createHash('sha256').update(value).digest('hex')
// Explicit new-model upper-price policy; original policy and historical settlements remain unchanged.
export const FLASH41_POLICY = Object.freeze({...BILLING_POLICY,version:'real-input-flash41-budget-1',model:'deepseek-flash',maxRequests:80,
  inputPriceMicroPerMillion:2000000,outputPriceMicroPerMillion:8000000})
// A new grant extends only the authorized Q comparison; prior policies remain byte-for-byte unchanged.
export const FLASH41_PAIRED06_POLICY = Object.freeze({...FLASH41_POLICY,version:'real-input-flash41-budget-6',maxRequests:104})
export const FLASH41_PAIRED07_POLICY = Object.freeze({...FLASH41_POLICY,version:'real-input-flash41-budget-7',maxRequests:128})
export const FLASH41_PAIRED08_POLICY = Object.freeze({...FLASH41_POLICY,version:'real-input-flash41-budget-8',maxRequests:168,limitMicroCny:20000000,
  inputPriceMicroPerMillion:3000000,outputPriceMicroPerMillion:9000000})
export const FLASH41_PAIRED09_POLICY = Object.freeze({...FLASH41_PAIRED08_POLICY,version:'real-input-flash41-budget-9',maxRequests:208})
// Current official peak prices for the one-variable model comparison. Historical
// policies and settlements above remain immutable.
export const MODEL_COMPARE_FLASH_POLICY = Object.freeze({...FLASH41_PAIRED09_POLICY,
  version:'real-input-model-compare-flash-1',maxRequests:248,inputPriceMicroPerMillion:2000000,outputPriceMicroPerMillion:8000000})
export const MODEL_COMPARE_PRO_POLICY = Object.freeze({...MODEL_COMPARE_FLASH_POLICY,
  version:'real-input-model-compare-pro-1',model:'deepseek-v4-pro',inputPriceMicroPerMillion:9000000,outputPriceMicroPerMillion:27000000})
export const MODEL_COMPARE_POLICY = Object.freeze({version:'real-input-model-compare-budget-1',maxRequests:248,
  limitMicroCny:20000000,reservationMicroCny:3300000,
  arms:Object.freeze({A:MODEL_COMPARE_FLASH_POLICY,B:MODEL_COMPARE_PRO_POLICY})})
export function modelComparePolicyFor(unitId) {
  check(typeof unitId==='string'&&/^(?:W(?:0[1-9]|1[0-2])|X0[1-8])-[AB]$/.test(unitId),'MODEL_COMPARE_UNIT')
  return unitId.endsWith('-A')?MODEL_COMPARE_FLASH_POLICY:MODEL_COMPARE_PRO_POLICY
}
// One-variable reasoning comparison. The historical none arm remains exact;
// the low arm changes only the explicit Responses reasoning effort.
export const REASONING_COMPARE_NONE_POLICY = Object.freeze({...MODEL_COMPARE_FLASH_POLICY,
  version:'real-input-reasoning-compare-none-1',maxRequests:288,reasoningEffort:'none'})
export const REASONING_COMPARE_LOW_POLICY = Object.freeze({...REASONING_COMPARE_NONE_POLICY,
  version:'real-input-reasoning-compare-low-1',reasoningEffort:'low'})
export const REASONING_COMPARE_POLICY = Object.freeze({version:'real-input-reasoning-compare-budget-1',maxRequests:288,
  limitMicroCny:20000000,reservationMicroCny:3300000,
  arms:Object.freeze({A:REASONING_COMPARE_NONE_POLICY,B:REASONING_COMPARE_LOW_POLICY})})
export function reasoningComparePolicyFor(unitId) {
  check(typeof unitId==='string'&&/^(?:Y(?:0[1-9]|1[0-2])|Z0[1-8])-[AB]$/.test(unitId),'REASONING_COMPARE_UNIT')
  return unitId.endsWith('-A')?REASONING_COMPARE_NONE_POLICY:REASONING_COMPARE_LOW_POLICY
}
// A separately authorized max-effort comparison. Both arms receive the same
// larger output envelope; only the explicit reasoning effort differs.
export const REASONING_MAX_NONE_POLICY = Object.freeze({...MODEL_COMPARE_FLASH_POLICY,
  version:'real-input-reasoning-max-none-1',maxRequests:290,reasoningEffort:'none',outputTokenCeiling:32768})
export const REASONING_MAX_MAX_POLICY = Object.freeze({...REASONING_MAX_NONE_POLICY,
  version:'real-input-reasoning-max-max-1',reasoningEffort:'max'})
export const REASONING_MAX_POLICY = Object.freeze({version:'real-input-reasoning-max-budget-1',maxRequests:290,
  limitMicroCny:20000000,reservationMicroCny:3300000,
  arms:Object.freeze({A:REASONING_MAX_NONE_POLICY,B:REASONING_MAX_MAX_POLICY})})
export function reasoningMaxPolicyFor(unitId) {
  check(typeof unitId==='string'&&/^M(?:0[1-9]|1[0-9]|20)-[AB]$/.test(unitId),'REASONING_MAX_UNIT')
  return unitId.endsWith('-A')?REASONING_MAX_NONE_POLICY:REASONING_MAX_MAX_POLICY
}
const fail = code => { throw Error('REAL_INPUT_BUDGET_' + code) }
const check = (ok, code) => { if (!ok) fail(code) }
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max
const exact = (value, keys) => check(value && typeof value === 'object' && !Array.isArray(value)
  && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()), 'FIELDS')
function copy(value, seen = new Set(), depth = 0) {
  check(depth < 30, 'JSON_DEPTH')
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') { check(Number.isFinite(value), 'JSON_NUMBER'); return value }
  check(value && typeof value === 'object' && !seen.has(value), 'JSON_OBJECT')
  check([Object.prototype, Array.prototype].includes(Object.getPrototypeOf(value)), 'JSON_PROTOTYPE')
  seen.add(value)
  const keys = Reflect.ownKeys(value), array = Array.isArray(value), out = array ? [] : {}
  check(keys.length < 10000 && (!array || keys.length === value.length + 1), 'JSON_ARRAY')
  for (const key of keys) {
    if (array && key === 'length') continue
    check(typeof key === 'string' && !['__proto__','prototype','constructor'].includes(key), 'JSON_KEY')
    const d = Object.getOwnPropertyDescriptor(value, key)
    check(d && Object.hasOwn(d, 'value') && d.enumerable, 'JSON_DESCRIPTOR')
    if (array) check(/^(0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length, 'JSON_ARRAY')
    out[key] = copy(d.value, seen, depth + 1)
  }
  seen.delete(value); return out
}
const same = (a, b, code) => check(isDeepStrictEqual(a, b), code)
const unitKeys = ['unitId','candidateSha','requestSha','inputSha','scorerSha','requestBytes']
const accounted = reservation => reservation?.status==='settled'||reservation?.status==='settled-incomplete'
function units(rows, group, old = []) {
  check(Array.isArray(rows) && rows.length === (group === 'AB' ? 16 : 8), 'UNIT_COUNT')
  for (const [i, row] of rows.entries()) {
    exact(row, unitKeys)
    const expected = group === 'AB' ? `${i < 8 ? 'A' : 'B'}${String(i % 8 + 1).padStart(2,'0')}` : `C${String(i+1).padStart(2,'0')}`
    check(row.unitId === expected && ['candidateSha','requestSha','inputSha','scorerSha'].every(k => digest(row[k]))
      && integer(row.requestBytes, BILLING_POLICY.requestByteCeiling) && row.requestBytes > 0, 'UNIT_IDENTITY')
    check(row.candidateSha === rows[0].candidateSha && row.scorerSha === rows[0].scorerSha, 'BATCH_DRIFT')
    if (group === 'C') check(row.candidateSha !== old[0].candidateSha && row.inputSha === old[8+i].inputSha
      && row.scorerSha === old[8+i].scorerSha, 'C_NOT_NEW_OR_INPUT_DRIFT')
  }
  return rows
}
export function validateManifest(input) {
  const m = copy(input)
  exact(m, ['version','packageId','policy','billingEvidence','lockRoot','units'])
  check(m.version === 'real-input-request-manifest-2' && m.packageId === 'MAINLINE-REAL-INPUT-01', 'MANIFEST_VERSION')
  same(m.policy, BILLING_POLICY, 'POLICY_CHANGED')
  exact(m.billingEvidence, ['checkedAt','validUntil','evidenceSha'])
  const { checkedAt, validUntil, evidenceSha } = m.billingEvidence
  check(typeof checkedAt === 'string' && typeof validUntil === 'string' && digest(evidenceSha)
    && Number.isFinite(Date.parse(checkedAt)) && Date.parse(validUntil) > Date.parse(checkedAt)
    && Date.parse(validUntil) - Date.parse(checkedAt) <= 86400000, 'BILLING_EVIDENCE')
  check(typeof m.lockRoot === 'string' && resolve(m.lockRoot) === m.lockRoot, 'LOCK_ROOT')
  units(m.units, 'AB'); return m
}
export function costUpperMicroCny(inputTokens, outputTokens, policy=BILLING_POLICY) {
  check(integer(inputTokens, policy.inputTokenCeiling) && integer(outputTokens, policy.outputTokenCeiling), 'TOKEN_CEILING')
  const numerator = BigInt(inputTokens) * BigInt(policy.inputPriceMicroPerMillion)
    + BigInt(outputTokens) * BigInt(policy.outputPriceMicroPerMillion)
  return Number((numerator + 999999n) / 1000000n)
}
/** JSON.parse checks grammar, but silently discards duplicate properties.
 * Do not use its result as billing evidence until every raw object's decoded
 * keys are unique. Quoted model text is data, not a second usage envelope. */
function unambiguousResponse(rawText) {
  const value=JSON.parse(rawText),objects=[]
  const tokens=/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]]/g
  for(const match of rawText.matchAll(tokens)) {
    const token=match[0]
    if(token==='{'){objects.push(new Set());check(objects.length<=64,'RESPONSE_DEPTH')}
    else if(token==='['){objects.push(null);check(objects.length<=64,'RESPONSE_DEPTH')}
    else if(token==='}'||token===']')objects.pop()
    else {
      let end=match.index+token.length
      while(end<rawText.length&&/[ \t\r\n]/.test(rawText[end]))end++
      if(rawText[end]!==':')continue
      const keys=objects.at(-1),key=JSON.parse(token)
      check(keys instanceof Set&&!keys.has(key),'RESPONSE_DUPLICATE_PROPERTY')
      keys.add(key)
    }
  }
  return value
}
const knownPolicy = policy => [BILLING_POLICY,FLASH41_POLICY,FLASH41_PAIRED06_POLICY,FLASH41_PAIRED07_POLICY,
  FLASH41_PAIRED08_POLICY,FLASH41_PAIRED09_POLICY,MODEL_COMPARE_FLASH_POLICY,MODEL_COMPARE_PRO_POLICY,
  REASONING_COMPARE_NONE_POLICY,REASONING_COMPARE_LOW_POLICY,REASONING_MAX_NONE_POLICY,REASONING_MAX_MAX_POLICY]
  .some(value=>isDeepStrictEqual(policy,value))
const responseByteCeiling = policy => policy.outputTokenCeiling>8192?2097152:524288
function validateUsageRecord(rawText,status,policy) {
  check(knownPolicy(policy),'POLICY_CHANGED')
  check(status===200&&typeof rawText==='string'&&Buffer.byteLength(rawText)<=responseByteCeiling(policy),'HTTP_OR_RESPONSE_LIMIT')
  let response
  try { response = unambiguousResponse(rawText) } catch { fail('RESPONSE_JSON_OR_AMBIGUOUS') }
  check(response && response.object==='response'&&['completed','incomplete'].includes(response.status)&&!response.error
    && typeof response.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(response.id)
    && typeof response.model === 'string' && response.model.toLowerCase() === policy.model, 'RESPONSE_IDENTITY')
  const u = response.usage
  exact(u, ['input_tokens','input_tokens_details','output_tokens','output_tokens_details','total_tokens'])
  exact(u.input_tokens_details, ['cached_tokens']); exact(u.output_tokens_details, ['reasoning_tokens'])
  const cost = costUpperMicroCny(u.input_tokens, u.output_tokens,policy)
  const reasoningTokens=u.output_tokens_details.reasoning_tokens
  check(u.input_tokens > 0 && u.output_tokens > 0 && integer(u.total_tokens, policy.inputTokenCeiling+policy.outputTokenCeiling) && u.total_tokens === u.input_tokens + u.output_tokens
    && integer(u.input_tokens_details.cached_tokens, u.input_tokens) && integer(reasoningTokens,u.output_tokens)
    && (policy.reasoningEffort==='none'?reasoningTokens===0:['low','max'].includes(policy.reasoningEffort)), 'USAGE_INCONSISTENT')
  check(cost<=BILLING_POLICY.reservationMicroCny,'RESERVATION_EXCEEDED')
  return {response,responseId:response.id,usage:u,costUpperMicroCny:cost,responseSha:sha256(rawText)}
}
/** Accounting trust is intentionally independent of semantic completeness. */
export function validateUsageAccountingEnvelope(rawText,status,policy=BILLING_POLICY) {
  const checked=validateUsageRecord(rawText,status,policy),details=checked.response.incomplete_details
  if(checked.response.status==='incomplete')check(details&&details.reason==='max_output_tokens','INCOMPLETE_REASON')
  return {responseId:checked.responseId,usage:checked.usage,costUpperMicroCny:checked.costUpperMicroCny,
    responseSha:checked.responseSha,responseStatus:checked.response.status,
    incompleteReason:checked.response.status==='incomplete'?details.reason:null}
}
export function validateUsageEnvelope(rawText, status, policy=BILLING_POLICY) {
  const checked=validateUsageRecord(rawText,status,policy),response=checked.response
  check(response.status==='completed','RESPONSE_INCOMPLETE')
  const output=response.output
  const message=Array.isArray(output)?output.at(-1):null
  const thinkingProtocol=['low','max'].includes(policy.reasoningEffort)&&Array.isArray(output)&&output.length>=1
    &&output.slice(0,-1).every(item=>item&&item.type==='reasoning')
  const noneProtocol=policy.reasoningEffort==='none'&&Array.isArray(output)&&output.length===1
  check((thinkingProtocol||noneProtocol)&&message?.type === 'message'
    && message.role === 'assistant' && Array.isArray(message.content) && message.content.length === 1
    && message.content[0]?.type === 'output_text' && typeof message.content[0].text === 'string'
    && message.content[0].text.trim().length > 0, 'RESPONSE_PROTOCOL')
  return {responseId:checked.responseId,usage:checked.usage,costUpperMicroCny:checked.costUpperMicroCny,responseSha:checked.responseSha}
}

async function regular(path) { const s = await lstat(path); check(s.isFile() && !s.isSymbolicLink(), 'NOT_REGULAR_FILE') }
async function directory(path) { const s = await lstat(path); check(s.isDirectory() && !s.isSymbolicLink() && await realpath(path) === path, 'DIRECTORY_BINDING') }
async function writeNew(path, text) { const f = await open(path, 'wx', 0o600); try { await f.writeFile(text); await f.sync() } finally { await f.close() } }
async function locked(root, fn) {
  await directory(root)
  const lock = join(root, 'ledger.lock'), owner = randomUUID()
  try { await mkdir(lock) } catch { fail('BUSY_OR_ABANDONED_LOCK') }
  try {
    await writeNew(join(lock, 'owner'), owner)
    return await fn()
  } finally {
    // Never remove an unknown/stale lock or recursively delete a directory.
    if (await readFile(join(lock, 'owner'), 'utf8').catch(() => null) === owner) {
      await unlink(join(lock, 'owner')); await rmdir(lock)
    }
  }
}
function replay(lines, manifestSha, manifest) {
  let prior = '0'.repeat(64)
  // A returned diagnostic snapshot must never expose the authoritative manifest.
  const state = { units: copy(manifest.units), reservations: [], halted: null, tail: prior, nextSequence: 0 }
  for (const [sequence, line] of lines.entries()) {
    exact(line, ['sequence','previous','event','hash'])
    check(line.sequence === sequence && line.previous === prior && line.hash === sha256(JSON.stringify({sequence, previous: prior, event: line.event})), 'LEDGER_CHAIN')
    const e = line.event
    check(e && typeof e === 'object', 'LEDGER_EVENT')
    if (sequence === 0) { exact(e, ['kind','manifestSha']); check(e.kind === 'init' && e.manifestSha === manifestSha, 'LEDGER_INITIAL') }
    else if (e.kind === 'candidateC') {
      exact(e, ['kind','units']); check(state.units.length === 16 && !state.halted && state.reservations.length === 16
        && state.reservations.every(r => r.status === 'settled'), 'C_PRECONDITION')
      state.units = [...state.units, ...units(e.units, 'C', manifest.units)]
    } else if (e.kind === 'reserve') {
      exact(e, ['kind','unitId','requestSha','candidateSha','nonce','reservedMicroCny'])
      const u = state.units[state.reservations.length]
      check(!state.halted && state.reservations.every(r=>r.status==='settled') && u && u.unitId === e.unitId
        && u.requestSha === e.requestSha && u.candidateSha === e.candidateSha && typeof e.nonce === 'string'
        && /^[a-f0-9-]{36}$/.test(e.nonce) && e.reservedMicroCny === BILLING_POLICY.reservationMicroCny, 'RESERVE_IDENTITY_OR_ORDER')
      const spent = state.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)
      check(state.reservations.length < BILLING_POLICY.maxRequests && spent + e.reservedMicroCny <= BILLING_POLICY.limitMicroCny, 'LIMIT')
      state.reservations.push({...e, status:'pending', costUpperMicroCny:e.reservedMicroCny})
    } else if (e.kind === 'settle') {
      exact(e, ['kind','unitId','nonce','requestSha','responseSha','responseId','usage','costUpperMicroCny'])
      const r = state.reservations.at(-1)
      check(!state.halted && r?.status==='pending' && r.unitId===e.unitId && r.nonce===e.nonce && r.requestSha===e.requestSha
        && digest(e.responseSha) && typeof e.responseId==='string' && !state.reservations.some(x=>x.responseId===e.responseId), 'SETTLEMENT_BINDING')
      const envelope = JSON.stringify({object:'response',status:'completed',model:BILLING_POLICY.model,id:e.responseId,usage:e.usage,
        output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'ledger usage validation only'}]}]})
      const v = validateUsageEnvelope(envelope, 200)
      check(e.costUpperMicroCny===v.costUpperMicroCny, 'SETTLEMENT_AMOUNT')
      Object.assign(r, e, {status:'settled'})
    } else if (e.kind === 'recoveryReserve') {
      exact(e,['kind','grant','unitId','requestSha','candidateSha','nonce','reservedMicroCny'])
      const grant=validateRecoveryGrant(e.grant,manifest,manifestSha)
      check(!state.recovery&&sequence===grant.parentSequence&&prior===grant.parentTail,'RECOVERY_PARENT')
      check(state.halted==='TRANSPORT_OR_CRASH_UNKNOWN'&&state.reservations.length===1
        &&state.reservations[0].status==='pending'&&state.reservations[0].unitId==='A01'
        &&state.reservations[0].nonce===grant.priorNonce&&state.reservations[0].requestSha===grant.priorRequestSha,'RECOVERY_PRIOR')
      check(e.unitId==='A02'&&e.requestSha===grant.target.requestSha&&e.candidateSha===grant.target.candidateSha
        &&typeof e.nonce==='string'&&/^[a-f0-9-]{36}$/.test(e.nonce)
        &&e.nonce!==grant.priorNonce&&e.reservedMicroCny===BILLING_POLICY.reservationMicroCny,'RECOVERY_RESERVE')
      check(state.reservations.length<BILLING_POLICY.maxRequests
        &&state.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+e.reservedMicroCny<=BILLING_POLICY.limitMicroCny,'LIMIT')
      state.reservations[0].status='held-unknown'
      state.recovery={grant,nonce:e.nonce,status:'pending',priorHalt:state.halted}
      state.reservations.push({kind:'reserve',unitId:e.unitId,requestSha:e.requestSha,candidateSha:e.candidateSha,
        nonce:e.nonce,reservedMicroCny:e.reservedMicroCny,status:'pending',costUpperMicroCny:e.reservedMicroCny})
    } else if (e.kind === 'recoverySettle') {
      exact(e,['kind','unitId','nonce','requestSha','responseSha','responseId','usage','costUpperMicroCny'])
      const r=state.reservations.at(-1)
      check(state.recovery?.status==='pending'&&r?.unitId==='A02'&&e.unitId===r.unitId
        &&e.nonce===state.recovery.nonce&&e.nonce===r.nonce&&e.requestSha===r.requestSha&&digest(e.responseSha)
        &&!state.reservations.some(x=>x.responseId===e.responseId),'RECOVERY_SETTLEMENT_BINDING')
      const checked=validateUsageEnvelope(JSON.stringify({object:'response',status:'completed',model:BILLING_POLICY.model,
        id:e.responseId,usage:e.usage,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'ledger usage validation only'}]}]}),200)
      check(e.costUpperMicroCny===checked.costUpperMicroCny,'SETTLEMENT_AMOUNT')
      Object.assign(r,e,{status:'settled'});state.recovery.status='settled'
      // Historical halt is deliberately retained; success is not permission for another request.
    } else if (e.kind === 'batchGrant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(!state.batch&&sequence===g.parentSequence&&prior===g.parentTail
        &&state.halted==='TRANSPORT_OR_CRASH_UNKNOWN'&&state.recovery?.status==='settled'
        &&state.reservations.length===2&&state.reservations[0].status==='held-unknown'
        &&state.reservations[0].nonce===g.priorNonce&&state.reservations[1].status==='settled'
        &&state.reservations[1].responseSha===g.a02ResponseSha,'BATCH_PARENT')
      state.batch={grant:g,stopped:false}
    } else if (e.kind === 'candidate02Grant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-candidate02-grant-1'&&!state.candidate02
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.batch&&!state.batch.stopped
        &&state.reservations.length===16&&state.reservations[0].status==='held-unknown'
        &&state.reservations[0].nonce===g.priorNonce&&state.reservations[1].responseSha===g.a02ResponseSha
        &&state.reservations.slice(1).every(r=>r.status==='settled'),'C02_PARENT')
      state.candidate02={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'candidate03Grant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-candidate03-grant-1'&&!state.candidate03
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.candidate02&&!state.candidate02.stopped
        &&state.reservations.length===24&&state.reservations[0].status==='held-unknown'
        &&state.reservations[0].nonce===g.priorNonce&&state.reservations[1].responseSha===g.a02ResponseSha
        &&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets[0].candidateSha!==state.candidate02.grant.targets[0].candidateSha,'C03_PARENT')
      state.candidate03={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'paired04Grant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-paired04-grant-1'&&!state.paired04&&state.candidate03&&!state.candidate03.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===32
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets.find(u=>u.unitId.endsWith('-03')).candidateSha===state.candidate03.grant.targets[0].candidateSha,'PAIRED04_PARENT')
      state.paired04={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'paired05Grant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-paired05-grant-1'&&!state.paired05&&state.paired04&&!state.paired04.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===56
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets.every(u=>!state.units.some(old=>old.unitId===u.unitId||old.inputSha===u.inputSha)),'PAIRED05_PARENT')
      state.paired05={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'paired06Grant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-paired06-grant-1'&&!state.paired06&&state.paired05&&!state.paired05.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===80
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets.every(u=>!state.units.some(old=>old.unitId===u.unitId)),'PAIRED06_PARENT')
      validatePaired06Candidates(g,state.paired05.grant)
      state.paired06={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'paired07Grant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-paired07-grant-1'&&!state.paired07&&state.paired06&&!state.paired06.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===104
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets.every(u=>!state.units.some(old=>old.unitId===u.unitId)),'PAIRED07_PARENT')
      validatePaired07Candidates(g,state.paired06.grant)
      state.paired07={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'paired08Grant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-paired08-grant-1'&&!state.paired08&&state.paired07&&!state.paired07.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===128
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets.every(u=>!state.units.some(old=>old.unitId===u.unitId)),'PAIRED08_PARENT')
      validatePaired08Candidates(g,state.paired07.grant)
      state.paired08={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'paired09Grant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-paired09-grant-1'&&!state.paired09&&state.paired08&&!state.paired08.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===168
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets.every(u=>!state.units.some(old=>old.unitId===u.unitId)),'PAIRED09_PARENT')
      validatePaired09Candidates(g,state.paired08.grant)
      state.paired09={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'modelCompareGrant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-model-compare-grant-1'&&!state.modelCompare&&state.paired09&&!state.paired09.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===208
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets.every(u=>!state.units.some(old=>old.unitId===u.unitId)),'MODEL_COMPARE_PARENT')
      validateModelCompareCandidates(g,state.paired09.grant)
      state.modelCompare={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'reasoningCompareGrant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-reasoning-compare-grant-1'&&!state.reasoningCompare&&state.modelCompare&&!state.modelCompare.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===248
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&g.targets.every(u=>!state.units.some(old=>old.unitId===u.unitId)),'REASONING_COMPARE_PARENT')
      validateReasoningCompareCandidates(g,state.modelCompare.grant)
      state.reasoningCompare={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'usageReconcile') {
      exact(e,['kind','unitId','nonce','requestSha','responseSha','responseId','usage','costUpperMicroCny','semanticStatus','incompleteReason'])
      const r=state.reservations.at(-1)
      check(sequence===512&&state.reasoningCompare?.stopped&&state.halted==='RESPONSE_OR_USAGE_INVALID'
        &&r?.unitId==='Y01-B'&&r.status==='pending'&&r.nonce===e.nonce&&r.requestSha===e.requestSha
        &&e.semanticStatus==='incomplete'&&e.incompleteReason==='max_output_tokens'&&digest(e.responseSha)
        &&!state.reservations.some(value=>value.responseId===e.responseId),'USAGE_RECONCILE_BINDING')
      const v=validateUsageAccountingEnvelope(JSON.stringify({object:'response',status:'incomplete',model:REASONING_COMPARE_LOW_POLICY.model,
        id:e.responseId,error:null,incomplete_details:{reason:e.incompleteReason},usage:e.usage}),200,REASONING_COMPARE_LOW_POLICY)
      check(v.costUpperMicroCny===e.costUpperMicroCny,'USAGE_RECONCILE_AMOUNT')
      Object.assign(r,e,{status:'settled-incomplete'})
    } else if (e.kind === 'reasoningMaxGrant') {
      exact(e,['kind','grant']);const g=validateBatchGrant(e.grant,manifest,manifestSha)
      check(g.version==='real-input-reasoning-max-grant-1'&&!state.reasoningMax&&state.reasoningCompare?.stopped
        &&sequence===g.parentSequence&&prior===g.parentTail&&state.reservations.length===250
        &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===g.priorNonce
        &&state.reservations[1].responseSha===g.a02ResponseSha&&state.reservations.slice(1).every(accounted)
        &&state.reservations.at(-1).unitId==='Y01-B'&&state.reservations.at(-1).status==='settled-incomplete'
        &&g.targets.every(u=>!state.units.some(old=>old.unitId===u.unitId)),'REASONING_MAX_PARENT')
      validateReasoningMaxCandidates(g,state.reasoningCompare.grant)
      state.reasoningMax={grant:g,stopped:false};state.units=[...state.units,...g.targets]
    } else if (e.kind === 'batchReserve') {
      exact(e,['kind','unitId','requestSha','candidateSha','nonce','reservedMicroCny'])
      const active=state.reasoningMax??state.reasoningCompare??state.modelCompare??state.paired09??state.paired08??state.paired07??state.paired06??state.paired05??state.paired04??state.candidate03??state.candidate02??state.batch,g=active?.grant,u=g?.targets[state.reservations.length-(state.reasoningMax?250:state.reasoningCompare?248:state.modelCompare?208:state.paired09?168:state.paired08?128:state.paired07?104:state.paired06?80:state.paired05?56:state.paired04?32:state.candidate03?24:state.candidate02?16:2)]
      check(g&&!active.stopped&&state.reservations.slice(1).every(accounted)
        &&u&&u.unitId===e.unitId&&u.requestSha===e.requestSha&&u.candidateSha===e.candidateSha
        &&typeof e.nonce==='string'&&/^[a-f0-9-]{36}$/.test(e.nonce)
        &&!state.reservations.some(r=>r.nonce===e.nonce)&&e.reservedMicroCny===BILLING_POLICY.reservationMicroCny,'BATCH_RESERVE')
      check(state.reservations.length<g.maxTotalRequests
        &&state.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+e.reservedMicroCny<=(state.reasoningMax?REASONING_MAX_POLICY:state.reasoningCompare?REASONING_COMPARE_POLICY:state.modelCompare?MODEL_COMPARE_POLICY:state.paired09?FLASH41_PAIRED09_POLICY:state.paired08?FLASH41_PAIRED08_POLICY:BILLING_POLICY).limitMicroCny,'LIMIT')
      state.reservations.push({...e,status:'pending',costUpperMicroCny:e.reservedMicroCny})
    } else if (e.kind === 'batchSettle') {
      exact(e,['kind','unitId','nonce','requestSha','responseSha','responseId','usage','costUpperMicroCny'])
      const r=state.reservations.at(-1)
      const active=state.reasoningMax??state.reasoningCompare??state.modelCompare??state.paired09??state.paired08??state.paired07??state.paired06??state.paired05??state.paired04??state.candidate03??state.candidate02??state.batch
      check(active&&!active.stopped&&r?.kind==='batchReserve'&&r.status==='pending'
        &&r.unitId===e.unitId&&r.nonce===e.nonce&&r.requestSha===e.requestSha&&digest(e.responseSha)
        &&!state.reservations.some(x=>x.responseId===e.responseId),'BATCH_SETTLEMENT_BINDING')
      const policy=state.reasoningMax?reasoningMaxPolicyFor(r.unitId):state.reasoningCompare?reasoningComparePolicyFor(r.unitId):state.modelCompare?modelComparePolicyFor(r.unitId):state.paired09?FLASH41_PAIRED09_POLICY:state.paired08?FLASH41_PAIRED08_POLICY:state.paired07?FLASH41_PAIRED07_POLICY:state.paired06?FLASH41_PAIRED06_POLICY:state.paired05?FLASH41_POLICY:BILLING_POLICY
      const validationOutput=['low','max'].includes(policy.reasoningEffort)&&e.usage.output_tokens_details.reasoning_tokens>0
        ?[{type:'reasoning'},{type:'message',role:'assistant',content:[{type:'output_text',text:'ledger validation'}]}]
        :[{type:'message',role:'assistant',content:[{type:'output_text',text:'ledger validation'}]}]
      const v=validateUsageEnvelope(JSON.stringify({object:'response',status:'completed',model:policy.model,
        id:e.responseId,usage:e.usage,output:validationOutput}),200,policy)
      check(v.costUpperMicroCny===e.costUpperMicroCny,'SETTLEMENT_AMOUNT');Object.assign(r,e,{status:'settled'})
    } else if (e.kind === 'batchUsageSettle') {
      exact(e,['kind','unitId','nonce','requestSha','responseSha','responseId','usage','costUpperMicroCny','semanticStatus','incompleteReason'])
      const r=state.reservations.at(-1),active=state.reasoningMax
      check(active&&!active.stopped&&r?.kind==='batchReserve'&&r.status==='pending'
        &&r.unitId===e.unitId&&r.nonce===e.nonce&&r.requestSha===e.requestSha&&digest(e.responseSha)
        &&e.semanticStatus==='incomplete'&&e.incompleteReason==='max_output_tokens'
        &&!state.reservations.some(x=>x.responseId===e.responseId),'BATCH_USAGE_SETTLEMENT_BINDING')
      const policy=reasoningMaxPolicyFor(r.unitId),v=validateUsageAccountingEnvelope(JSON.stringify({object:'response',status:'incomplete',
        model:policy.model,id:e.responseId,error:null,incomplete_details:{reason:e.incompleteReason},usage:e.usage}),200,policy)
      check(v.costUpperMicroCny===e.costUpperMicroCny,'BATCH_USAGE_SETTLEMENT_AMOUNT')
      Object.assign(r,e,{status:'settled-incomplete'})
    } else if (e.kind === 'halt') {
      exact(e, ['kind','code']); check(typeof e.code==='string' && /^[A-Z_]{1,80}$/.test(e.code), 'HALT_CODE'); state.halted=e.code
      if(state.recovery)state.recovery.status='stopped'
      if(state.batch)state.batch.stopped=true
      if(state.candidate02)state.candidate02.stopped=true
      if(state.candidate03)state.candidate03.stopped=true
      if(state.paired04)state.paired04.stopped=true
      if(state.paired05)state.paired05.stopped=true
      if(state.paired06)state.paired06.stopped=true
      if(state.paired07)state.paired07.stopped=true
      if(state.paired08)state.paired08.stopped=true
      if(state.paired09)state.paired09.stopped=true
      if(state.modelCompare)state.modelCompare.stopped=true
      if(state.reasoningCompare)state.reasoningCompare.stopped=true
      if(state.reasoningMax)state.reasoningMax.stopped=true
    } else fail('LEDGER_EVENT_KIND')
    prior=line.hash
  }
  check(lines.length>0, 'EMPTY_LEDGER'); state.tail=prior; state.nextSequence=lines.length
  return state
}
async function readState(dir, manifest, manifestSha) {
  const path = join(dir, 'CALL_LEDGER.jsonl'); await regular(path)
  const bytes = await readFile(path)
  check(bytes.length<=1048576 && bytes.length>0 && bytes.at(-1)===10, 'LEDGER_TRUNCATED')
  let lines
  try { lines=bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse) } catch { fail('LEDGER_JSON') }
  const receipts=join(manifest.lockRoot,'records'); await directory(receipts)
  const files=(await readdir(receipts)).sort()
  check(files.length===lines.length, 'LEDGER_RECEIPT_COUNT')
  for (const [i,line] of lines.entries()) {
    const name=String(i).padStart(8,'0')+'.json';check(files[i]===name, 'LEDGER_RECEIPT_SEQUENCE')
    await regular(join(receipts,name))
    check(await readFile(join(receipts,name),'utf8')===JSON.stringify(line), 'LEDGER_RECEIPT_CHANGED')
  }
  return replay(lines, manifestSha, manifest)
}
async function append(dir, manifest, state, event) {
  const data={sequence:state.nextSequence,previous:state.tail,event}, line={...data,hash:sha256(JSON.stringify(data))}
  // Independent write-once receipts make truncating a valid ledger prefix detectable.
  await writeNew(join(manifest.lockRoot,'records',String(data.sequence).padStart(8,'0')+'.json'),JSON.stringify(line))
  const file=await open(join(dir,'CALL_LEDGER.jsonl'),'a')
  try { await file.writeFile(JSON.stringify(line)+'\n');await file.sync() } finally { await file.close() }
}
export async function initializeBudget(dir, input) {
  dir=resolve(dir);const manifest=validateManifest(input);await directory(dir);await directory(manifest.lockRoot)
  return locked(manifest.lockRoot,async()=>{
    await writeNew(join(dir,'REQUEST_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n')
    await writeNew(join(dir,'CALL_LEDGER.jsonl'),'')
    await mkdir(join(manifest.lockRoot,'records'))
    const manifestSha=sha256(await readFile(join(dir,'REQUEST_MANIFEST.json')))
    await append(dir,manifest,{nextSequence:0,tail:'0'.repeat(64)},{kind:'init',manifestSha})
    return manifestSha
  })
}
export async function openBudget(dir, expectedManifestSha, {recoveryGrant,batchGrant}={}) {
  dir=resolve(dir);await directory(dir);check(digest(expectedManifestSha),'MANIFEST_HASH')
  const manifestPath=join(dir,'REQUEST_MANIFEST.json');await regular(manifestPath)
  const raw=await readFile(manifestPath);check(raw.length<=100000&&sha256(raw)===expectedManifestSha,'MANIFEST_CHANGED')
  const manifest=validateManifest(JSON.parse(raw.toString('utf8')))
  const read=async()=>{
    check(sha256(await readFile(manifestPath))===expectedManifestSha,'MANIFEST_CHANGED')
    return readState(dir,manifest,expectedManifestSha)
  }
  await locked(manifest.lockRoot,read)
  check(recoveryGrant===undefined||batchGrant===undefined,'MULTIPLE_GRANTS')
  if(batchGrant!==undefined)return batchBudget(dir,manifest,expectedManifestSha,read,batchGrant)
  if(recoveryGrant!==undefined)return recoveryBudget(dir,manifest,expectedManifestSha,read,recoveryGrant)
  return Object.freeze({
    async snapshot(){return locked(manifest.lockRoot,read)},
    async halt(code){return locked(manifest.lockRoot,async()=>{const state=await read();check(/^[A-Z_]{1,80}$/.test(code),'HALT_CODE');await append(dir,manifest,state,{kind:'halt',code})})},
    async registerCandidateC(inputUnits){const rows=copy(inputUnits);return locked(manifest.lockRoot,async()=>{
      const state=await read();check(state.units.length===16&&!state.halted&&state.reservations.length===16&&state.reservations.every(r=>r.status==='settled'),'C_PRECONDITION')
      units(rows,'C',manifest.units);await append(dir,manifest,state,{kind:'candidateC',units:rows})
    })},
    async reserve(unitId, requestText, observedPolicy=BILLING_POLICY, now=new Date().toISOString()) {
      const policy=copy(observedPolicy);check(typeof requestText==='string','REQUEST_TEXT')
      const requestSha=sha256(requestText), bytes=Buffer.byteLength(requestText)
      const reservation=await locked(manifest.lockRoot,async()=>{
        const state=await read();check(!state.halted,'HALTED')
        if (!isDeepStrictEqual(policy,BILLING_POLICY)) {
          await append(dir,manifest,state,{kind:'halt',code:'POLICY_CHANGED'});fail('POLICY_CHANGED')
        }
        if (!(Number.isFinite(Date.parse(now))&&Date.parse(now)>=Date.parse(manifest.billingEvidence.checkedAt)
          &&Date.parse(now)<=Date.parse(manifest.billingEvidence.validUntil))) {
          await append(dir,manifest,state,{kind:'halt',code:'BILLING_REVIEW_EXPIRED'});fail('BILLING_REVIEW_EXPIRED')
        }
        check(!state.reservations.some(r=>r.unitId===unitId),'DUPLICATE_REQUEST')
        check(state.reservations.every(r=>r.status==='settled'),'INFLIGHT_OR_CRASH_UNKNOWN')
        check(state.reservations.length<BILLING_POLICY.maxRequests,'LIMIT')
        const u=state.units[state.reservations.length]
        check(u&&u.unitId===unitId&&u.requestSha===requestSha&&u.requestBytes===bytes&&bytes<=BILLING_POLICY.requestByteCeiling,'REQUEST_NOT_FROZEN')
        check(state.reservations.length<BILLING_POLICY.maxRequests&&state.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+BILLING_POLICY.reservationMicroCny<=BILLING_POLICY.limitMicroCny,'LIMIT')
        const e={kind:'reserve',unitId,requestSha,candidateSha:u.candidateSha,nonce:randomUUID(),reservedMicroCny:BILLING_POLICY.reservationMicroCny}
        await append(dir,manifest,state,e);return e
      })
      let used=false
      return Object.freeze({unitId,requestSha,
        async complete(rawHttpText, httpStatus=200){
          check(!used,'LEASE_ALREADY_FINALIZED');used=true
          return locked(manifest.lockRoot,async()=>{
            const state=await read(),r=state.reservations.at(-1)
            check(!state.halted&&r?.nonce===reservation.nonce&&r.status==='pending','LEASE_BINDING')
            let value
            try { value=validateUsageEnvelope(rawHttpText,httpStatus);check(!state.reservations.some(x=>x.responseId===value.responseId),'RESPONSE_REUSED') }
            catch { await append(dir,manifest,state,{kind:'halt',code:'RESPONSE_OR_USAGE_INVALID'});fail('RESPONSE_OR_USAGE_INVALID') }
            await append(dir,manifest,state,{kind:'settle',unitId,nonce:reservation.nonce,requestSha,...value})
            return value
          })
        },
        async uncertain(){check(!used,'LEASE_ALREADY_FINALIZED');used=true;return locked(manifest.lockRoot,async()=>{
          const state=await read();check(state.reservations.at(-1)?.nonce===reservation.nonce,'LEASE_BINDING')
          await append(dir,manifest,state,{kind:'halt',code:'TRANSPORT_OR_CRASH_UNKNOWN'})
        })}
      })
    }
  })
}

/** Settle only the trustworthy usage of the previously persisted incomplete Y01-B response.
 * The original response and halt remain immutable; no semantic result becomes replayable. */
export async function reconcileIncompleteUsage(dir,expectedManifestSha,input) {
  dir=resolve(dir);check(digest(expectedManifestSha),'MANIFEST_HASH')
  exact(input,['unitId','requestSha','responseSha','httpStatus','rawHttpText'])
  check(input.unitId==='Y01-B'&&digest(input.requestSha)&&digest(input.responseSha)
    &&input.httpStatus===200&&typeof input.rawHttpText==='string'&&sha256(input.rawHttpText)===input.responseSha,'USAGE_RECONCILE_INPUT')
  const manifestPath=join(dir,'REQUEST_MANIFEST.json');await regular(manifestPath)
  const raw=await readFile(manifestPath);check(raw.length<=100000&&sha256(raw)===expectedManifestSha,'MANIFEST_CHANGED')
  const manifest=validateManifest(JSON.parse(raw.toString('utf8'))),checked=validateUsageAccountingEnvelope(input.rawHttpText,input.httpStatus,REASONING_COMPARE_LOW_POLICY)
  check(checked.responseStatus==='incomplete'&&checked.incompleteReason==='max_output_tokens','USAGE_RECONCILE_STATUS')
  return locked(manifest.lockRoot,async()=>{
    const state=await readState(dir,manifest,expectedManifestSha),r=state.reservations.at(-1)
    check(state.nextSequence===512&&state.halted==='RESPONSE_OR_USAGE_INVALID'&&state.reasoningCompare?.stopped
      &&r?.unitId===input.unitId&&r.status==='pending'&&r.requestSha===input.requestSha
      &&!state.reservations.some(value=>value.responseId===checked.responseId),'USAGE_RECONCILE_PARENT')
    const event={kind:'usageReconcile',unitId:r.unitId,nonce:r.nonce,requestSha:r.requestSha,responseSha:input.responseSha,
      responseId:checked.responseId,usage:checked.usage,costUpperMicroCny:checked.costUpperMicroCny,
      semanticStatus:'incomplete',incompleteReason:checked.incompleteReason}
    await append(dir,manifest,state,event)
    return {unitId:r.unitId,responseId:checked.responseId,responseSha:input.responseSha,semanticStatus:'incomplete',
      incompleteReason:checked.incompleteReason,costUpperMicroCny:checked.costUpperMicroCny,usage:checked.usage}
  })
}

export const RECOVERY_ROUTE=Object.freeze({proxyHost:'127.0.0.1',proxyPort:10081,targetHost:'api.deepseek.com',targetPort:443})

/** Separate opt-in batch authority; original halt and A01 unknown are never cleared. */
function validateBatchGrant(input,manifest,manifestSha) {
  const g=copy(input)
  const candidate02=g.version==='real-input-candidate02-grant-1'
  const candidate03=g.version==='real-input-candidate03-grant-1'
  const paired04=g.version==='real-input-paired04-grant-1'
  const paired05=g.version==='real-input-paired05-grant-1'
  const paired07=g.version==='real-input-paired07-grant-1'
  const paired08=g.version==='real-input-paired08-grant-1'
  const paired09=g.version==='real-input-paired09-grant-1'
  const modelCompare=g.version==='real-input-model-compare-grant-1'
  const reasoningCompare=g.version==='real-input-reasoning-compare-grant-1'
  const reasoningMax=g.version==='real-input-reasoning-max-grant-1'
  const paired06=g.version==='real-input-paired06-grant-1'
  exact(g,['version','grantId','parentTail','parentSequence','ledgerPrefixBytes','ledgerPrefixSha','manifestSha',
    'bindingSha','head','sourcesSha','reviewSha','targets','billingEvidence','route','priorNonce','a02ResponseSha','maxTotalRequests',...(paired05||paired06||paired07||paired08||paired09||modelCompare||reasoningCompare||reasoningMax?['policy']:[])])
  if(paired05)same(g.policy,FLASH41_POLICY,'PAIRED05_POLICY')
  if(paired07)same(g.policy,FLASH41_PAIRED07_POLICY,'PAIRED07_POLICY')
  if(paired08)same(g.policy,FLASH41_PAIRED08_POLICY,'PAIRED08_POLICY')
  if(paired09)same(g.policy,FLASH41_PAIRED09_POLICY,'PAIRED09_POLICY')
  if(modelCompare)same(g.policy,MODEL_COMPARE_POLICY,'MODEL_COMPARE_POLICY')
  if(reasoningCompare)same(g.policy,REASONING_COMPARE_POLICY,'REASONING_COMPARE_POLICY')
  if(reasoningMax)same(g.policy,REASONING_MAX_POLICY,'REASONING_MAX_POLICY')
  if(paired06)same(g.policy,FLASH41_PAIRED06_POLICY,'PAIRED06_POLICY')
  check((reasoningMax||reasoningCompare||modelCompare||paired09||paired08||paired07||paired06||paired05||paired04||candidate03||candidate02||g.version==='real-input-batch-grant-1')&&/^[a-f0-9-]{36}$/.test(g.grantId)
    &&g.parentSequence===(reasoningMax?513:reasoningCompare?507:modelCompare?426:paired09?345:paired08?264:paired07?215:paired06?166:paired05?117:paired04?68:candidate03?51:candidate02?34:5)&&g.maxTotalRequests===(reasoningMax?290:reasoningCompare?288:modelCompare?248:paired09?208:paired08?168:paired07?128:paired06?104:paired05?80:paired04?56:candidate03?32:candidate02?24:16)&&integer(g.ledgerPrefixBytes,1048576)&&g.ledgerPrefixBytes>0
    &&['parentTail','ledgerPrefixSha','manifestSha','bindingSha','sourcesSha','reviewSha','a02ResponseSha'].every(k=>digest(g[k]))
    &&typeof g.head==='string'&&/^[a-f0-9]{40}$/.test(g.head)
    &&typeof g.priorNonce==='string'&&/^[a-f0-9-]{36}$/.test(g.priorNonce),'BATCH_GRANT')
  check(g.manifestSha===manifestSha,'BATCH_MANIFEST')
  if(reasoningMax||reasoningCompare||modelCompare){
    const code=reasoningMax?'REASONING_MAX':reasoningCompare?'REASONING_COMPARE':'MODEL_COMPARE'
    check(Array.isArray(g.targets)&&g.targets.length===40,code+'_TARGETS')
    const cases=new Set();let armAFirst=0
    for(let i=0;i<20;i++){
      const pair=g.targets.slice(i*2,i*2+2),prefix=pair[0]?.unitId?.slice(0,4)
      const validPrefix=reasoningMax?/^M(?:0[1-9]|1[0-9]|20)-$/.test(prefix):reasoningCompare?/^(?:Y(?:0[1-9]|1[0-2])|Z0[1-8])-$/.test(prefix):/^(?:W(?:0[1-9]|1[0-2])|X0[1-8])-$/.test(prefix)
      check(validPrefix&&!cases.has(prefix),code+'_CASE')
      cases.add(prefix);if(pair[0].unitId.endsWith('-A'))armAFirst++
      check(new Set(pair.map(u=>u.unitId)).size===2&&pair.some(u=>u.unitId===prefix+'A')&&pair.some(u=>u.unitId===prefix+'B'),code+'_PAIR')
      for(const u of pair){exact(u,unitKeys);check(['candidateSha','requestSha','inputSha','scorerSha'].every(k=>digest(u[k]))
        &&integer(u.requestBytes,BILLING_POLICY.requestByteCeiling)&&u.requestBytes>0&&u.scorerSha===manifest.units[0].scorerSha,code+'_IDENTITY')}
      check(pair[0].inputSha===pair[1].inputSha&&pair[0].scorerSha===pair[1].scorerSha
        &&pair[0].requestSha!==pair[1].requestSha&&pair[0].candidateSha!==pair[1].candidateSha,code+(reasoningMax||reasoningCompare?'_ONLY_REASONING':'_ONLY_MODEL'))
    }
    check(cases.size===20&&armAFirst===10,code+'_BALANCE')
  }else if(paired04||paired05||paired06||paired07||paired08||paired09){
    const pairCount=paired08||paired09?20:12
    check(Array.isArray(g.targets)&&g.targets.length===pairCount*2,'PAIRED04_TARGETS')
    const candidates=new Map(),inputs=new Set(),cases=new Set();let baselineFirst=0
    for(let i=0;i<pairCount;i++){
      const pair=g.targets.slice(i*2,i*2+2),prefix=paired08||paired09?pair[0]?.unitId?.slice(0,4):paired06||paired07?pair[0]?.unitId?.slice(0,4):`${paired05?'P':'N'}${String(i+1).padStart(2,'0')}-`
      if(paired09){check(/^(?:U(?:0[1-9]|1[0-2])|V0[1-8])-$/.test(prefix)&&!cases.has(prefix),'PAIRED09_CASE');cases.add(prefix);if(pair[0].unitId.endsWith('-03'))baselineFirst++}
      else if(paired08){check(/^(?:S(?:0[1-9]|1[0-2])|T0[1-8])-$/.test(prefix)&&!cases.has(prefix),'PAIRED08_CASE');cases.add(prefix);if(pair[0].unitId.endsWith('-03'))baselineFirst++}
      else if(paired06||paired07){check((paired07?/^R(?:0[1-9]|1[0-2])-$/:/^Q(?:0[1-9]|1[0-2])-$/).test(prefix)&&!cases.has(prefix),'PAIRED06_CASE');cases.add(prefix);if(pair[0].unitId.endsWith('-03'))baselineFirst++}
      check(new Set(pair.map(u=>u.unitId)).size===2&&pair.some(u=>u.unitId===prefix+'03')&&pair.some(u=>u.unitId===prefix+(paired09?'09':paired08?'08':paired07?'07':paired06?'06':paired05?'05':'04')),'PAIRED04_PAIR')
      for(const u of pair){exact(u,unitKeys)
        check(['candidateSha','requestSha','inputSha','scorerSha'].every(k=>digest(u[k]))
          &&integer(u.requestBytes,BILLING_POLICY.requestByteCeiling)&&u.requestBytes>0
          &&u.scorerSha===manifest.units[0].scorerSha,'PAIRED04_IDENTITY')
        const arm=u.unitId.slice(-2)
        if(candidates.has(arm))check(candidates.get(arm)===u.candidateSha,'PAIRED04_CANDIDATE_DRIFT')
        candidates.set(arm,u.candidateSha)
      }
      check(pair[0].inputSha===pair[1].inputSha&&!inputs.has(pair[0].inputSha)
        &&!manifest.units.some(u=>u.inputSha===pair[0].inputSha),'PAIRED04_INPUT')
      inputs.add(pair[0].inputSha)
    }
    check(candidates.get('03')!==candidates.get(paired09?'09':paired08?'08':paired07?'07':paired06?'06':paired05?'05':'04'),'PAIRED04_SAME_CANDIDATE')
    if(paired06||paired07||paired08||paired09)check(cases.size===pairCount&&baselineFirst===pairCount/2,'PAIRED06_BALANCE')
  }else if(candidate02||candidate03){
    check(Array.isArray(g.targets)&&g.targets.length===8,'C02_TARGETS')
    for(const [i,u] of g.targets.entries()){
      exact(u,unitKeys)
      check(u.unitId===`${candidate03?'D':'C'}${String(i+1).padStart(2,'0')}`&&['candidateSha','requestSha','inputSha','scorerSha'].every(k=>digest(u[k]))
        &&integer(u.requestBytes,BILLING_POLICY.requestByteCeiling)&&u.requestBytes>0
        &&u.candidateSha!==manifest.units[0].candidateSha&&u.candidateSha===g.targets[0].candidateSha
        &&u.inputSha===manifest.units[i].inputSha&&u.scorerSha===manifest.units[i].scorerSha,'C02_TARGETS')
    }
  }else same(g.targets,manifest.units.slice(2),'BATCH_TARGETS')
  same(g.route,RECOVERY_ROUTE,'BATCH_ROUTE');exact(g.billingEvidence,['checkedAt','validUntil','evidenceSha'])
  const {checkedAt,validUntil,evidenceSha}=g.billingEvidence
  check(typeof checkedAt==='string'&&typeof validUntil==='string'&&digest(evidenceSha)
    &&Number.isFinite(Date.parse(checkedAt))&&Date.parse(validUntil)>Date.parse(checkedAt)
    &&Date.parse(validUntil)-Date.parse(checkedAt)<=86400000,'BATCH_BILLING')
  return g
}
function validatePaired06Candidates(grant,priorGrant) {
  const oldBaseline=priorGrant.targets.find(u=>u.unitId.endsWith('-03'))
  const baseline=grant.targets.find(u=>u.unitId.endsWith('-03'))
  const candidate=grant.targets.find(u=>u.unitId.endsWith('-06'))
  check(baseline.candidateSha===oldBaseline.candidateSha
    &&!priorGrant.targets.some(u=>u.candidateSha===candidate.candidateSha),'PAIRED06_CANDIDATE')
}
function validatePaired07Candidates(grant,priorGrant) {
  const oldBaseline=priorGrant.targets.find(u=>u.unitId.endsWith('-03'))
  const baseline=grant.targets.find(u=>u.unitId.endsWith('-03'))
  const candidate=grant.targets.find(u=>u.unitId.endsWith('-07'))
  check(baseline.candidateSha===oldBaseline.candidateSha
    &&!priorGrant.targets.some(u=>u.candidateSha===candidate.candidateSha),'PAIRED07_CANDIDATE')
}
function validatePaired08Candidates(grant,priorGrant) {
  const oldBaseline=priorGrant.targets.find(u=>u.unitId.endsWith('-03'))
  const baseline=grant.targets.find(u=>u.unitId.endsWith('-03'))
  const candidate=grant.targets.find(u=>u.unitId.endsWith('-08'))
  check(baseline.candidateSha===oldBaseline.candidateSha
    &&!priorGrant.targets.some(u=>u.candidateSha===candidate.candidateSha),'PAIRED08_CANDIDATE')
}
function validatePaired09Candidates(grant,priorGrant) {
  const oldBaseline=priorGrant.targets.find(u=>u.unitId.endsWith('-03'))
  const baseline=grant.targets.find(u=>u.unitId.endsWith('-03'))
  const candidate=grant.targets.find(u=>u.unitId.endsWith('-09'))
  check(baseline.candidateSha===oldBaseline.candidateSha
    &&!priorGrant.targets.some(u=>u.candidateSha===candidate.candidateSha),'PAIRED09_CANDIDATE')
}
function validateModelCompareCandidates(grant,priorGrant) {
  const baselines=priorGrant.targets.filter(u=>u.unitId.endsWith('-03'))
  for(const [i,pairStart] of Array.from({length:20},(_,index)=>index*2).entries()) {
    const pair=grant.targets.slice(pairStart,pairStart+2),baseline=baselines[i]
    check(baseline&&pair[0].inputSha===baseline.inputSha&&pair[1].inputSha===baseline.inputSha,'MODEL_COMPARE_INPUT')
    const a=pair.find(u=>u.unitId.endsWith('-A'))
    check(a?.candidateSha===baseline.candidateSha,'MODEL_COMPARE_BASELINE')
  }
}
function validateReasoningCompareCandidates(grant,priorGrant) {
  const priorA=priorGrant.targets.filter(u=>u.unitId.endsWith('-A'))
  for(const [i,pairStart] of Array.from({length:20},(_,index)=>index*2).entries()) {
    const pair=grant.targets.slice(pairStart,pairStart+2),baseline=priorA[i]
    check(baseline&&pair[0].inputSha===baseline.inputSha&&pair[1].inputSha===baseline.inputSha,'REASONING_COMPARE_INPUT')
    const a=pair.find(u=>u.unitId.endsWith('-A'))
    check(a?.candidateSha===baseline.candidateSha,'REASONING_COMPARE_BASELINE')
  }
}
function validateReasoningMaxCandidates(grant,priorGrant) {
  const priorInputs=new Set(priorGrant.targets.filter(u=>u.unitId.endsWith('-A')).map(u=>u.inputSha)),inputs=new Set()
  for(let i=0;i<20;i++){
    const pair=grant.targets.slice(i*2,i*2+2)
    check(pair.length===2&&pair[0].inputSha===pair[1].inputSha&&priorInputs.has(pair[0].inputSha)
      &&!inputs.has(pair[0].inputSha),'REASONING_MAX_INPUT')
    inputs.add(pair[0].inputSha)
  }
}
async function batchBudget(dir,manifest,manifestSha,read,input) {
  const grant=validateBatchGrant(input,manifest,manifestSha)
  const candidate02=grant.version==='real-input-candidate02-grant-1',candidate03=grant.version==='real-input-candidate03-grant-1',paired04=grant.version==='real-input-paired04-grant-1'
  const paired07=grant.version==='real-input-paired07-grant-1'
  const paired08=grant.version==='real-input-paired08-grant-1'
  const paired09=grant.version==='real-input-paired09-grant-1'
  const modelCompare=grant.version==='real-input-model-compare-grant-1'
  const reasoningCompare=grant.version==='real-input-reasoning-compare-grant-1'
  const reasoningMax=grant.version==='real-input-reasoning-max-grant-1'
  const paired05=grant.version==='real-input-paired05-grant-1',paired06=grant.version==='real-input-paired06-grant-1'
  const policy=reasoningMax?REASONING_MAX_POLICY:reasoningCompare?REASONING_COMPARE_POLICY:modelCompare?MODEL_COMPARE_POLICY:paired09?FLASH41_PAIRED09_POLICY:paired08?FLASH41_PAIRED08_POLICY:paired07?FLASH41_PAIRED07_POLICY:paired06?FLASH41_PAIRED06_POLICY:paired05?FLASH41_POLICY:BILLING_POLICY
  const offset=reasoningMax?250:reasoningCompare?248:modelCompare?208:paired09?168:paired08?128:paired07?104:paired06?80:paired05?56:paired04?32:candidate03?24:candidate02?16:2,newCandidate=reasoningMax||reasoningCompare||modelCompare||paired09||paired08||paired07||paired06||paired05||paired04||candidate02||candidate03
  const active=s=>reasoningMax?s.reasoningMax:reasoningCompare?s.reasoningCompare:modelCompare?s.modelCompare:paired09?s.paired09:paired08?s.paired08:paired07?s.paired07:paired06?s.paired06:paired05?s.paired05:paired04?s.paired04:candidate03?s.candidate03:candidate02?s.candidate02:s.batch
  const boundRead=async()=>{
    const bytes=await readFile(join(dir,'CALL_LEDGER.jsonl'))
    check(bytes.length>=grant.ledgerPrefixBytes&&sha256(bytes.subarray(0,grant.ledgerPrefixBytes))===grant.ledgerPrefixSha,'BATCH_PREFIX')
    const state=await read()
    if(reasoningMax){check(state.reasoningCompare&&(state.reasoningMax||state.reasoningCompare.stopped),'REASONING_MAX_PARENT');validateReasoningMaxCandidates(grant,state.reasoningCompare.grant)}
    if(reasoningCompare){check(state.modelCompare&&(state.reasoningCompare||!state.modelCompare.stopped),'REASONING_COMPARE_PARENT');validateReasoningCompareCandidates(grant,state.modelCompare.grant)}
    if(modelCompare){check(state.paired09&&(state.modelCompare||!state.paired09.stopped),'MODEL_COMPARE_PARENT');validateModelCompareCandidates(grant,state.paired09.grant)}
    if(paired09){check(state.paired08&&(state.paired09||!state.paired08.stopped),'PAIRED09_PARENT');validatePaired09Candidates(grant,state.paired08.grant)}
    if(paired08){check(state.paired07&&(state.paired08||!state.paired07.stopped),'PAIRED08_PARENT');validatePaired08Candidates(grant,state.paired07.grant)}
    if(paired07){check(state.paired06&&(state.paired07||!state.paired06.stopped),'PAIRED07_PARENT');validatePaired07Candidates(grant,state.paired06.grant)}
    if(paired06){check(state.paired05&&(state.paired06||!state.paired05.stopped),'PAIRED06_PARENT');validatePaired06Candidates(grant,state.paired05.grant)}
    if(paired04)check(state.candidate03&&(state.paired04||!state.candidate03.stopped)
      &&grant.targets.find(u=>u.unitId.endsWith('-03')).candidateSha===state.candidate03.grant.targets[0].candidateSha,'PAIRED04_PARENT_CANDIDATE')
    if(candidate03)check(state.candidate02&&(state.candidate03||!state.candidate02.stopped)
      &&grant.targets[0].candidateSha!==state.candidate02.grant.targets[0].candidateSha,'C03_PARENT_CANDIDATE')
    if(active(state))same(active(state).grant,grant,'BATCH_GRANT_CHANGED')
    else if(reasoningMax)check(state.tail===grant.parentTail&&state.nextSequence===grant.parentSequence&&state.reservations.length===offset
      &&state.reasoningCompare?.stopped&&state.halted==='RESPONSE_OR_USAGE_INVALID'
      &&state.reservations[0].status==='held-unknown'&&state.reservations[0].nonce===grant.priorNonce
      &&state.reservations[1].responseSha===grant.a02ResponseSha&&state.reservations.slice(1).every(accounted)
      &&state.reservations.at(-1).unitId==='Y01-B'&&state.reservations.at(-1).status==='settled-incomplete','REASONING_MAX_PARENT')
    else check(state.tail===grant.parentTail&&state.nextSequence===grant.parentSequence&&state.reservations.length===offset
      &&state.recovery?.status==='settled'&&state.reservations[0].status==='held-unknown'
      &&state.reservations[0].nonce===grant.priorNonce&&state.reservations[1].responseSha===grant.a02ResponseSha
      &&(!newCandidate||state.batch&&!state.batch.stopped&&state.reservations.slice(1).every(r=>r.status==='settled')),'BATCH_PARENT')
    return state
  }
  await locked(manifest.lockRoot,boundRead)
  return Object.freeze({
    snapshot:()=>locked(manifest.lockRoot,async()=>{const s=await boundRead();
      // The gateway can bind all bodies before the first new reserve; no journal mutation here.
      if(newCandidate&&!active(s))s.units=[...s.units,...copy(grant.targets)];return s}),
    halt:code=>locked(manifest.lockRoot,async()=>{const s=await boundRead();check(/^[A-Z_]{1,80}$/.test(code),'HALT_CODE');await append(dir,manifest,s,{kind:'halt',code})}),
    async reserve(unitId,requestText,requestedPolicy=policy,now=new Date().toISOString()) {
      const reservation=await locked(manifest.lockRoot,async()=>{
        let s=await boundRead();check(!active(s)?.stopped&&(reasoningMax||s.recovery?.status==='settled')&&(!newCandidate||reasoningMax||!s.batch.stopped),'BATCH_STOPPED')
        const unitPolicy=reasoningMax?reasoningMaxPolicyFor(unitId):reasoningCompare?reasoningComparePolicyFor(unitId):modelCompare?modelComparePolicyFor(unitId):policy
        same(copy(requestedPolicy),unitPolicy,'POLICY_CHANGED')
        check(Number.isFinite(Date.parse(now))&&Date.parse(now)>=Date.parse(grant.billingEvidence.checkedAt)
          &&Date.parse(now)<=Date.parse(grant.billingEvidence.validUntil),'BATCH_PRICE_EXPIRED')
        const u=grant.targets[s.reservations.length-offset]
        check(s.reservations.slice(1).every(accounted)&&u?.unitId===unitId,'BATCH_ORDER_OR_PENDING')
        check(typeof requestText==='string'&&sha256(requestText)===u.requestSha&&Buffer.byteLength(requestText)===u.requestBytes,'REQUEST_NOT_FROZEN')
        check(s.reservations.length<grant.maxTotalRequests&&s.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+BILLING_POLICY.reservationMicroCny<=policy.limitMicroCny,'LIMIT')
        if(!active(s)){await append(dir,manifest,s,{kind:reasoningMax?'reasoningMaxGrant':reasoningCompare?'reasoningCompareGrant':modelCompare?'modelCompareGrant':paired09?'paired09Grant':paired08?'paired08Grant':paired07?'paired07Grant':paired06?'paired06Grant':paired05?'paired05Grant':paired04?'paired04Grant':candidate03?'candidate03Grant':candidate02?'candidate02Grant':'batchGrant',grant});s=await boundRead()}
        const e={kind:'batchReserve',unitId,requestSha:u.requestSha,candidateSha:u.candidateSha,nonce:randomUUID(),reservedMicroCny:BILLING_POLICY.reservationMicroCny}
        await append(dir,manifest,s,e);return e
      })
      let used=false
      const validLease=s=>check(active(s)&&!active(s).stopped&&s.reservations.at(-1)?.nonce===reservation.nonce
        &&s.reservations.at(-1)?.status==='pending','BATCH_LEASE_BINDING')
      return Object.freeze({unitId,requestSha:reservation.requestSha,
        async complete(raw,status=200){
          check(!used,'LEASE_ALREADY_FINALIZED');used=true
          return locked(manifest.lockRoot,async()=>{
            const s=await boundRead();validLease(s);let value
            const responsePolicy=reasoningMax?reasoningMaxPolicyFor(unitId):reasoningCompare?reasoningComparePolicyFor(unitId):modelCompare?modelComparePolicyFor(unitId):policy
            try{
              if(reasoningMax){
                const accounting=validateUsageAccountingEnvelope(raw,status,responsePolicy)
                check(!s.reservations.some(r=>r.responseId===accounting.responseId),'RESPONSE_REUSED')
                if(accounting.responseStatus==='incomplete'){
                  const event={kind:'batchUsageSettle',unitId,nonce:reservation.nonce,requestSha:reservation.requestSha,responseSha:accounting.responseSha,
                    responseId:accounting.responseId,usage:accounting.usage,costUpperMicroCny:accounting.costUpperMicroCny,
                    semanticStatus:'incomplete',incompleteReason:accounting.incompleteReason}
                  await append(dir,manifest,s,event)
                  return {...accounting,semanticUsable:false}
                }
              }
              value=validateUsageEnvelope(raw,status,responsePolicy);check(!s.reservations.some(r=>r.responseId===value.responseId),'RESPONSE_REUSED')
            }
            catch{await append(dir,manifest,s,{kind:'halt',code:'RESPONSE_OR_USAGE_INVALID'});fail('RESPONSE_OR_USAGE_INVALID')}
            await append(dir,manifest,s,{kind:'batchSettle',unitId,nonce:reservation.nonce,requestSha:reservation.requestSha,...value})
            return value
          })
        },
        async uncertain(){
          check(!used,'LEASE_ALREADY_FINALIZED');used=true
          return locked(manifest.lockRoot,async()=>{const s=await boundRead();validLease(s);await append(dir,manifest,s,{kind:'halt',code:'TRANSPORT_OR_CRASH_UNKNOWN'})})
        }
      })
    }
  })
}

function validateRecoveryGrant(input,manifest,manifestSha) {
  const g=copy(input)
  exact(g,['version','grantId','parentTail','parentSequence','ledgerPrefixBytes','ledgerPrefixSha','manifestSha',
    'bindingSha','priorNonce','priorRequestSha','target','head','sourcesSha','reviewSha','billingEvidence','route'])
  check(g.version==='real-input-a02-grant-1'&&/^[a-f0-9-]{36}$/.test(g.grantId)
    &&g.parentSequence===3&&integer(g.ledgerPrefixBytes,1048576)&&g.ledgerPrefixBytes>0
    &&['parentTail','ledgerPrefixSha','manifestSha','bindingSha','priorRequestSha','sourcesSha','reviewSha'].every(k=>digest(g[k]))
    &&typeof g.priorNonce==='string'&&/^[a-f0-9-]{36}$/.test(g.priorNonce)
    &&typeof g.head==='string'&&/^[a-f0-9]{40}$/.test(g.head),'RECOVERY_GRANT')
  check(g.manifestSha===manifestSha&&g.target.unitId==='A02','RECOVERY_IDENTITY')
  same(g.target,manifest.units[1],'RECOVERY_TARGET');same(g.route,RECOVERY_ROUTE,'RECOVERY_ROUTE')
  exact(g.billingEvidence,['checkedAt','validUntil','evidenceSha'])
  const {checkedAt,validUntil,evidenceSha}=g.billingEvidence
  check(typeof checkedAt==='string'&&typeof validUntil==='string'&&digest(evidenceSha)
    &&Number.isFinite(Date.parse(checkedAt))&&Date.parse(validUntil)>Date.parse(checkedAt)
    &&Date.parse(validUntil)-Date.parse(checkedAt)<=86400000,'RECOVERY_BILLING')
  return g
}
async function recoveryBudget(dir,manifest,manifestSha,read,input) {
  const grant=validateRecoveryGrant(input,manifest,manifestSha)
  const boundRead=async()=>{
    const bytes=await readFile(join(dir,'CALL_LEDGER.jsonl'))
    check(bytes.length>=grant.ledgerPrefixBytes&&sha256(bytes.subarray(0,grant.ledgerPrefixBytes))===grant.ledgerPrefixSha,'RECOVERY_PREFIX')
    const state=await read()
    if(state.recovery)same(state.recovery.grant,grant,'RECOVERY_GRANT_CHANGED')
    else check(state.tail===grant.parentTail&&state.nextSequence===grant.parentSequence
      &&state.halted==='TRANSPORT_OR_CRASH_UNKNOWN'&&state.reservations.length===1
      &&state.reservations[0].nonce===grant.priorNonce&&state.reservations[0].requestSha===grant.priorRequestSha,'RECOVERY_PRIOR')
    return state
  }
  await locked(manifest.lockRoot,boundRead)
  return Object.freeze({
    snapshot:()=>locked(manifest.lockRoot,boundRead),
    halt:code=>locked(manifest.lockRoot,async()=>{const state=await boundRead()
      check(/^[A-Z_]{1,80}$/.test(code),'HALT_CODE');await append(dir,manifest,state,{kind:'halt',code})}),
    async reserve(unitId,requestText,observedPolicy=BILLING_POLICY,now=new Date().toISOString()) {
      check(unitId==='A02','RECOVERY_UNIT')
      const reservation=await locked(manifest.lockRoot,async()=>{
        const state=await boundRead();check(!state.recovery,'RECOVERY_CONSUMED')
        same(copy(observedPolicy),BILLING_POLICY,'POLICY_CHANGED')
        check(Number.isFinite(Date.parse(now))&&Date.parse(now)>=Date.parse(grant.billingEvidence.checkedAt)
          &&Date.parse(now)<=Date.parse(grant.billingEvidence.validUntil),'RECOVERY_BILLING_EXPIRED')
        check(typeof requestText==='string'&&sha256(requestText)===grant.target.requestSha
          &&Buffer.byteLength(requestText)===grant.target.requestBytes,'REQUEST_NOT_FROZEN')
        check(state.reservations.length<BILLING_POLICY.maxRequests
          &&state.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+BILLING_POLICY.reservationMicroCny<=BILLING_POLICY.limitMicroCny,'LIMIT')
        // One write-once record both consumes the grant and reserves before any transport.
        const e={kind:'recoveryReserve',grant,unitId,requestSha:grant.target.requestSha,candidateSha:grant.target.candidateSha,
          nonce:randomUUID(),reservedMicroCny:BILLING_POLICY.reservationMicroCny}
        await append(dir,manifest,state,e);return e
      })
      let used=false
      return Object.freeze({unitId,requestSha:reservation.requestSha,
        async complete(raw,status=200) {
          check(!used,'LEASE_ALREADY_FINALIZED');used=true
          return locked(manifest.lockRoot,async()=>{
            const state=await boundRead();check(state.recovery?.nonce===reservation.nonce&&state.recovery.status==='pending','LEASE_BINDING')
            let value
            try{value=validateUsageEnvelope(raw,status);check(!state.reservations.some(r=>r.responseId===value.responseId),'RESPONSE_REUSED')}
            catch{await append(dir,manifest,state,{kind:'halt',code:'RESPONSE_OR_USAGE_INVALID'});fail('RESPONSE_OR_USAGE_INVALID')}
            await append(dir,manifest,state,{kind:'recoverySettle',unitId,nonce:reservation.nonce,requestSha:reservation.requestSha,...value})
            return value
          })
        },
        async uncertain() {
          check(!used,'LEASE_ALREADY_FINALIZED');used=true
          return locked(manifest.lockRoot,async()=>{const state=await boundRead()
            check(state.recovery?.nonce===reservation.nonce&&state.recovery.status==='pending','LEASE_BINDING')
            await append(dir,manifest,state,{kind:'halt',code:'TRANSPORT_OR_CRASH_UNKNOWN'})})
        }
      })
    }
  })
}
