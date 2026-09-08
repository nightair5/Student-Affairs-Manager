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
export function costUpperMicroCny(inputTokens, outputTokens) {
  check(integer(inputTokens, BILLING_POLICY.inputTokenCeiling) && integer(outputTokens, BILLING_POLICY.outputTokenCeiling), 'TOKEN_CEILING')
  const numerator = BigInt(inputTokens) * BigInt(BILLING_POLICY.inputPriceMicroPerMillion)
    + BigInt(outputTokens) * BigInt(BILLING_POLICY.outputPriceMicroPerMillion)
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
export function validateUsageEnvelope(rawText, status) {
  check(status === 200 && typeof rawText === 'string' && Buffer.byteLength(rawText) <= 524288, 'HTTP_OR_RESPONSE_LIMIT')
  let response
  try { response = unambiguousResponse(rawText) } catch { fail('RESPONSE_JSON_OR_AMBIGUOUS') }
  check(response && response.object === 'response' && response.status === 'completed' && !response.error
    && typeof response.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(response.id)
    && typeof response.model === 'string' && response.model.toLowerCase() === BILLING_POLICY.model, 'RESPONSE_IDENTITY')
  const u = response.usage
  exact(u, ['input_tokens','input_tokens_details','output_tokens','output_tokens_details','total_tokens'])
  exact(u.input_tokens_details, ['cached_tokens']); exact(u.output_tokens_details, ['reasoning_tokens'])
  const cost = costUpperMicroCny(u.input_tokens, u.output_tokens)
  check(u.input_tokens > 0 && u.output_tokens > 0 && integer(u.total_tokens, 2 * BILLING_POLICY.inputTokenCeiling) && u.total_tokens === u.input_tokens + u.output_tokens
    && integer(u.input_tokens_details.cached_tokens, u.input_tokens) && u.output_tokens_details.reasoning_tokens === 0, 'USAGE_INCONSISTENT')
  check(Array.isArray(response.output) && response.output.length === 1 && response.output[0]?.type === 'message'
    && response.output[0].role === 'assistant' && Array.isArray(response.output[0].content) && response.output[0].content.length === 1
    && response.output[0].content[0]?.type === 'output_text' && typeof response.output[0].content[0].text === 'string'
    && response.output[0].content[0].text.trim().length > 0, 'RESPONSE_PROTOCOL')
  check(cost <= BILLING_POLICY.reservationMicroCny, 'RESERVATION_EXCEEDED')
  return { responseId: response.id, usage: u, costUpperMicroCny: cost, responseSha: sha256(rawText) }
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
    } else if (e.kind === 'batchReserve') {
      exact(e,['kind','unitId','requestSha','candidateSha','nonce','reservedMicroCny'])
      const active=state.candidate02??state.batch,g=active?.grant,u=g?.targets[state.reservations.length-(state.candidate02?16:2)]
      check(g&&!active.stopped&&state.reservations.slice(1).every(r=>r.status==='settled')
        &&u&&u.unitId===e.unitId&&u.requestSha===e.requestSha&&u.candidateSha===e.candidateSha
        &&typeof e.nonce==='string'&&/^[a-f0-9-]{36}$/.test(e.nonce)
        &&!state.reservations.some(r=>r.nonce===e.nonce)&&e.reservedMicroCny===BILLING_POLICY.reservationMicroCny,'BATCH_RESERVE')
      check(state.reservations.length<g.maxTotalRequests
        &&state.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+e.reservedMicroCny<=BILLING_POLICY.limitMicroCny,'LIMIT')
      state.reservations.push({...e,status:'pending',costUpperMicroCny:e.reservedMicroCny})
    } else if (e.kind === 'batchSettle') {
      exact(e,['kind','unitId','nonce','requestSha','responseSha','responseId','usage','costUpperMicroCny'])
      const r=state.reservations.at(-1)
      const active=state.candidate02??state.batch
      check(active&&!active.stopped&&r?.kind==='batchReserve'&&r.status==='pending'
        &&r.unitId===e.unitId&&r.nonce===e.nonce&&r.requestSha===e.requestSha&&digest(e.responseSha)
        &&!state.reservations.some(x=>x.responseId===e.responseId),'BATCH_SETTLEMENT_BINDING')
      const v=validateUsageEnvelope(JSON.stringify({object:'response',status:'completed',model:BILLING_POLICY.model,
        id:e.responseId,usage:e.usage,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'ledger validation'}]}]}),200)
      check(v.costUpperMicroCny===e.costUpperMicroCny,'SETTLEMENT_AMOUNT');Object.assign(r,e,{status:'settled'})
    } else if (e.kind === 'halt') {
      exact(e, ['kind','code']); check(typeof e.code==='string' && /^[A-Z_]{1,80}$/.test(e.code), 'HALT_CODE'); state.halted=e.code
      if(state.recovery)state.recovery.status='stopped'
      if(state.batch)state.batch.stopped=true
      if(state.candidate02)state.candidate02.stopped=true
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

export const RECOVERY_ROUTE=Object.freeze({proxyHost:'127.0.0.1',proxyPort:10081,targetHost:'api.deepseek.com',targetPort:443})

/** Separate opt-in batch authority; original halt and A01 unknown are never cleared. */
function validateBatchGrant(input,manifest,manifestSha) {
  const g=copy(input)
  const candidate02=g.version==='real-input-candidate02-grant-1'
  exact(g,['version','grantId','parentTail','parentSequence','ledgerPrefixBytes','ledgerPrefixSha','manifestSha',
    'bindingSha','head','sourcesSha','reviewSha','targets','billingEvidence','route','priorNonce','a02ResponseSha','maxTotalRequests'])
  check((candidate02||g.version==='real-input-batch-grant-1')&&/^[a-f0-9-]{36}$/.test(g.grantId)
    &&g.parentSequence===(candidate02?34:5)&&g.maxTotalRequests===(candidate02?24:16)&&integer(g.ledgerPrefixBytes,1048576)&&g.ledgerPrefixBytes>0
    &&['parentTail','ledgerPrefixSha','manifestSha','bindingSha','sourcesSha','reviewSha','a02ResponseSha'].every(k=>digest(g[k]))
    &&typeof g.head==='string'&&/^[a-f0-9]{40}$/.test(g.head)
    &&typeof g.priorNonce==='string'&&/^[a-f0-9-]{36}$/.test(g.priorNonce),'BATCH_GRANT')
  check(g.manifestSha===manifestSha,'BATCH_MANIFEST')
  if(candidate02){
    check(Array.isArray(g.targets)&&g.targets.length===8,'C02_TARGETS')
    for(const [i,u] of g.targets.entries()){
      exact(u,unitKeys)
      check(u.unitId===`C${String(i+1).padStart(2,'0')}`&&['candidateSha','requestSha','inputSha','scorerSha'].every(k=>digest(u[k]))
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
async function batchBudget(dir,manifest,manifestSha,read,input) {
  const grant=validateBatchGrant(input,manifest,manifestSha)
  const candidate02=grant.version==='real-input-candidate02-grant-1',offset=candidate02?16:2
  const active=s=>candidate02?s.candidate02:s.batch
  const boundRead=async()=>{
    const bytes=await readFile(join(dir,'CALL_LEDGER.jsonl'))
    check(bytes.length>=grant.ledgerPrefixBytes&&sha256(bytes.subarray(0,grant.ledgerPrefixBytes))===grant.ledgerPrefixSha,'BATCH_PREFIX')
    const state=await read()
    if(active(state))same(active(state).grant,grant,'BATCH_GRANT_CHANGED')
    else check(state.tail===grant.parentTail&&state.nextSequence===grant.parentSequence&&state.reservations.length===offset
      &&state.recovery?.status==='settled'&&state.reservations[0].status==='held-unknown'
      &&state.reservations[0].nonce===grant.priorNonce&&state.reservations[1].responseSha===grant.a02ResponseSha
      &&(!candidate02||state.batch&&!state.batch.stopped&&state.reservations.slice(1).every(r=>r.status==='settled')),'BATCH_PARENT')
    return state
  }
  await locked(manifest.lockRoot,boundRead)
  return Object.freeze({
    snapshot:()=>locked(manifest.lockRoot,async()=>{const s=await boundRead();
      // The gateway can bind all bodies before the first new reserve; no journal mutation here.
      if(candidate02&&!s.candidate02)s.units=[...s.units,...copy(grant.targets)];return s}),
    halt:code=>locked(manifest.lockRoot,async()=>{const s=await boundRead();check(/^[A-Z_]{1,80}$/.test(code),'HALT_CODE');await append(dir,manifest,s,{kind:'halt',code})}),
    async reserve(unitId,requestText,policy=BILLING_POLICY,now=new Date().toISOString()) {
      const reservation=await locked(manifest.lockRoot,async()=>{
        let s=await boundRead();check(!active(s)?.stopped&&s.recovery?.status==='settled'&&(!candidate02||!s.batch.stopped),'BATCH_STOPPED')
        same(copy(policy),BILLING_POLICY,'POLICY_CHANGED')
        check(Number.isFinite(Date.parse(now))&&Date.parse(now)>=Date.parse(grant.billingEvidence.checkedAt)
          &&Date.parse(now)<=Date.parse(grant.billingEvidence.validUntil),'BATCH_PRICE_EXPIRED')
        const u=grant.targets[s.reservations.length-offset]
        check(s.reservations.slice(1).every(r=>r.status==='settled')&&u?.unitId===unitId,'BATCH_ORDER_OR_PENDING')
        check(typeof requestText==='string'&&sha256(requestText)===u.requestSha&&Buffer.byteLength(requestText)===u.requestBytes,'REQUEST_NOT_FROZEN')
        check(s.reservations.length<grant.maxTotalRequests&&s.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+BILLING_POLICY.reservationMicroCny<=BILLING_POLICY.limitMicroCny,'LIMIT')
        if(!active(s)){await append(dir,manifest,s,{kind:candidate02?'candidate02Grant':'batchGrant',grant});s=await boundRead()}
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
            try{value=validateUsageEnvelope(raw,status);check(!s.reservations.some(r=>r.responseId===value.responseId),'RESPONSE_REUSED')}
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
