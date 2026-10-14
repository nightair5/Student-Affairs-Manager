import {createHash,randomUUID} from 'node:crypto'
import {open,readFile,mkdir,readdir,lstat,realpath,unlink,rmdir} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {CANDIDATE11_B2_UNIT_POLICY,validateUsageEnvelope} from './real-input-budget.mjs'

export const D6_UNIT_POLICY=Object.freeze({
  version:'candidate13-d6-usd-budget-1',model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',
  temperature:0,reasoningEffort:'none',outputTokenCeiling:8192,requestByteCeiling:65536,
  inputPriceMicroUsdPerMillion:300000,outputPriceMicroUsdPerMillion:1200000,
})
export const D6_BATCH_POLICY=Object.freeze({version:'candidate13-d6-usd-batch-1',maxRequests:24,
  hardLimitMicroUsd:1000000,unit:D6_UNIT_POLICY})

const fail=code=>{throw Error('CANDIDATE13_D6_BUDGET_'+code)}
const check=(value,code)=>{if(!value)fail(code)}
const sha=value=>createHash('sha256').update(value).digest('hex')
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value)
const copy=value=>JSON.parse(JSON.stringify(value))
const same=(a,b,code)=>check(isDeepStrictEqual(a,b),code)
const exact=(value,keys)=>check(value&&typeof value==='object'&&!Array.isArray(value)
  &&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort()),'FIELDS')
const ceilDiv=(number,denominator)=>Number((BigInt(number)+BigInt(denominator)-1n)/BigInt(denominator))
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,child])=>[key,canonical(child)])):value
const stable=value=>JSON.stringify(canonical(value))

export function reservationMicroUsd(requestBytes){
  check(Number.isSafeInteger(requestBytes)&&requestBytes>0&&requestBytes<=D6_UNIT_POLICY.requestByteCeiling,'REQUEST_BYTES')
  return ceilDiv(BigInt(requestBytes)*BigInt(D6_UNIT_POLICY.inputPriceMicroUsdPerMillion)
    +BigInt(D6_UNIT_POLICY.outputTokenCeiling)*BigInt(D6_UNIT_POLICY.outputPriceMicroUsdPerMillion),1000000)
}
export function usageCostUpperMicroUsd(inputTokens,outputTokens){
  check(Number.isSafeInteger(inputTokens)&&inputTokens>0&&Number.isSafeInteger(outputTokens)&&outputTokens>0
    &&outputTokens<=D6_UNIT_POLICY.outputTokenCeiling,'TOKENS')
  return ceilDiv(BigInt(inputTokens)*BigInt(D6_UNIT_POLICY.inputPriceMicroUsdPerMillion)
    +BigInt(outputTokens)*BigInt(D6_UNIT_POLICY.outputPriceMicroUsdPerMillion),1000000)
}

async function directory(path){const stat=await lstat(path);check(stat.isDirectory()&&!stat.isSymbolicLink()&&await realpath(path)===path,'DIRECTORY_BINDING')}
async function writeNew(path,text){const file=await open(path,'wx',0o600);try{await file.writeFile(text);await file.sync()}finally{await file.close()}}
async function locked(root,fn){
  await directory(root);const lock=join(root,'ledger.lock'),owner=randomUUID()
  try{await mkdir(lock)}catch{fail('BUSY_OR_ABANDONED_LOCK')}
  try{await writeNew(join(lock,'owner'),owner);return await fn()}
  finally{if(await readFile(join(lock,'owner'),'utf8').catch(()=>null)===owner){await unlink(join(lock,'owner'));await rmdir(lock)}}
}

export function validateChain(bytes){
  const text=bytes.toString('utf8');check(text.endsWith('\n'),'LEDGER_TERMINATOR')
  const rows=text.trimEnd().split('\n').map(line=>JSON.parse(line));let prior='0'.repeat(64)
  for(const [sequence,row] of rows.entries()){
    exact(row,['sequence','previous','event','hash']);check(row.sequence===sequence&&row.previous===prior
      &&row.hash===sha(JSON.stringify({sequence,previous:prior,event:row.event})),'LEDGER_CHAIN');prior=row.hash
  }
  return {rows,tail:prior}
}

const TARGET_KEYS=['unitId','ordinal','sourceId','sourceVersionId','arm','position','candidateVersion','promptVersion',
  'sourceSha256','referenceSha256','compiledReferenceSha256','identitySha256','requestSha256','promptSha256','exampleSha256',
  'schemaSha256','adapterSha256','scorerVersion','compilerVersion','requestBytes','unitIdentitySha256','candidateSha256','inputSha256','reservedMicroUsd']
function validateTarget(unit,index){
  exact(unit,TARGET_KEYS);const source=String(Math.floor(index/2)+1).padStart(2,'0'),expectedArm=(Number(source)%2?['A','B']:['B','A'])[index%2]
  check(unit.unitId===`D5R1-S${source}-${expectedArm}`&&unit.ordinal===index+1&&unit.sourceId===`C13-D5R1-S${source}`
    &&unit.sourceVersionId===`${unit.sourceId}-v1`&&unit.arm===expectedArm&&unit.position===index%2+1,'TARGET_ORDER')
  check(unit.candidateVersion===(unit.arm==='A'?'real-input-source-semantics-3':'real-input-source-semantics-13')
    &&unit.scorerVersion==='candidate13-scoring-4.1.0'&&unit.compilerVersion==='candidate13-reference-compiler-4.1.0','TARGET_VERSION')
  check(['sourceSha256','referenceSha256','compiledReferenceSha256','identitySha256','requestSha256','promptSha256','exampleSha256',
    'schemaSha256','adapterSha256','unitIdentitySha256','candidateSha256','inputSha256'].every(key=>digest(unit[key])),'TARGET_DIGEST')
  const frozenCore=Object.fromEntries(TARGET_KEYS.slice(0,TARGET_KEYS.indexOf('unitIdentitySha256')).map(key=>[key,unit[key]]))
  check(sha(stable(frozenCore))===unit.unitIdentitySha256,'TARGET_FROZEN_IDENTITY')
  check(unit.reservedMicroUsd===reservationMicroUsd(unit.requestBytes),'TARGET_RESERVATION')
}

export function validateCandidate13D6Grant(input){
  const grant=copy(input)
  exact(grant,['version','grantId','parentTail','parentSequence','ledgerPrefixBytes','ledgerPrefixSha','d5ManifestSha256',
    'bindingSha256','head','dependenciesSha256','reviewSha256','targets','billingEvidence','route','lockRoot','maxBatchRequests',
    'maxBatchBudgetMicroUsd','hardLimitMicroUsd','policy','repair','verifier','retry'])
  check(grant.version==='candidate13-d6-grant-1'&&uuid(grant.grantId)&&grant.parentSequence===742&&grant.ledgerPrefixBytes===631869
    &&grant.parentTail==='6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922'
    &&grant.ledgerPrefixSha==='df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e','GRANT_BASELINE')
  check(['parentTail','ledgerPrefixSha','d5ManifestSha256','bindingSha256','dependenciesSha256','reviewSha256'].every(key=>digest(grant[key]))
    &&/^[a-f0-9]{40}$/.test(grant.head)&&resolve(grant.lockRoot)===grant.lockRoot,'GRANT_IDENTITY')
  check(Array.isArray(grant.targets)&&grant.targets.length===24&&grant.targets.every((unit,index)=>{validateTarget(unit,index);return true})
    &&new Set(grant.targets.map(unit=>unit.unitIdentitySha256)).size===24,'GRANT_TARGETS')
  const exactWorst=grant.targets.reduce((sum,unit)=>sum+unit.reservedMicroUsd,0)
  check(grant.maxBatchRequests===24&&grant.maxBatchBudgetMicroUsd===exactWorst&&exactWorst<=grant.hardLimitMicroUsd
    &&grant.hardLimitMicroUsd===1000000&&grant.repair===0&&grant.verifier===0&&grant.retry===0,'GRANT_LIMITS')
  same(grant.policy,D6_BATCH_POLICY,'POLICY')
  exact(grant.billingEvidence,['checkedAt','validUntil','evidenceSha256','documents'])
  check(Number.isFinite(Date.parse(grant.billingEvidence.checkedAt))&&Number.isFinite(Date.parse(grant.billingEvidence.validUntil))
    &&Date.parse(grant.billingEvidence.validUntil)>Date.parse(grant.billingEvidence.checkedAt)
    &&Date.parse(grant.billingEvidence.validUntil)-Date.parse(grant.billingEvidence.checkedAt)<=86400000
    &&digest(grant.billingEvidence.evidenceSha256)&&grant.billingEvidence.documents.every(item=>item.url?.startsWith('https://api-docs.deepseek.com/')),'BILLING_EVIDENCE')
  exact(grant.route,['endpoint','model','temperature','reasoning','maxOutputTokens'])
  check(grant.route.endpoint==='https://api.deepseek.com/responses'&&grant.route.model==='deepseek-flash'&&grant.route.temperature===0
    &&grant.route.reasoning==='none'&&grant.route.maxOutputTokens===8192,'ROUTE')
  return grant
}

function validateUsdUsage(raw,status,target){
  const base=validateUsageEnvelope(raw,status,CANDIDATE11_B2_UNIT_POLICY),usage=base.usage
  check(usage.input_tokens<=target.requestBytes,'INPUT_TOKEN_BYTE_ENVELOPE')
  const costUpperMicroUsd=usageCostUpperMicroUsd(usage.input_tokens,usage.output_tokens)
  check(costUpperMicroUsd<=target.reservedMicroUsd,'RESERVATION_EXCEEDED')
  return {responseId:base.responseId,usage,responseSha256:base.responseSha,costUpperMicroUsd}
}

function replay(rows,grant){
  const state={grant:null,reservations:[],stopped:false,haltCode:null,tail:rows.at(-1).hash,nextSequence:rows.length}
  for(const row of rows.slice(grant.parentSequence)){
    const event=row.event
    if(event.kind==='candidate13D6Grant'){
      exact(event,['kind','grant']);check(!state.grant&&row.sequence===grant.parentSequence&&row.previous===grant.parentTail,'GRANT_PARENT');same(event.grant,grant,'GRANT_DRIFT');state.grant=event.grant
    }else if(event.kind==='candidate13D6Reserve'){
      exact(event,['kind','unitId','requestSha256','candidateSha256','nonce','reservedMicroUsd']);const target=grant.targets[state.reservations.length]
      check(state.grant&&!state.stopped&&state.reservations.every(item=>item.status==='settled')&&target?.unitId===event.unitId
        &&target.requestSha256===event.requestSha256&&target.candidateSha256===event.candidateSha256&&uuid(event.nonce)
        &&event.reservedMicroUsd===target.reservedMicroUsd,'RESERVE_ORDER')
      check(state.reservations.reduce((sum,item)=>sum+item.costUpperMicroUsd,0)+event.reservedMicroUsd<=grant.hardLimitMicroUsd,'RESERVE_LIMIT')
      state.reservations.push({...event,status:'pending',costUpperMicroUsd:event.reservedMicroUsd})
    }else if(event.kind==='candidate13D6Settle'){
      exact(event,['kind','unitId','nonce','requestSha256','responseSha256','responseId','usage','costUpperMicroUsd']);const current=state.reservations.at(-1),target=grant.targets[state.reservations.length-1]
      check(!state.stopped&&current?.status==='pending'&&current.unitId===event.unitId&&current.nonce===event.nonce
        &&current.requestSha256===event.requestSha256&&digest(event.responseSha256)&&typeof event.responseId==='string'
        &&!state.reservations.slice(0,-1).some(item=>item.responseId===event.responseId),'SETTLE_BINDING')
      check(event.costUpperMicroUsd===usageCostUpperMicroUsd(event.usage.input_tokens,event.usage.output_tokens)
        &&event.usage.input_tokens<=target.requestBytes,'SETTLE_AMOUNT');Object.assign(current,event,{status:'settled'})
    }else if(event.kind==='candidate13D6Uncertain'){
      exact(event,['kind','unitId','nonce','requestSha256','code']);const current=state.reservations.at(-1)
      check(!state.stopped&&current?.status==='pending'&&current.unitId===event.unitId&&current.nonce===event.nonce
        &&current.requestSha256===event.requestSha256&&/^[A-Z_]{1,80}$/.test(event.code),'UNCERTAIN_BINDING')
      Object.assign(current,event,{status:'uncertain'});state.stopped=true;state.haltCode=event.code
    }else if(event.kind==='candidate13D6Halt'){
      exact(event,['kind','code']);check(!state.stopped&&/^[A-Z_]{1,80}$/.test(event.code),'HALT');state.stopped=true;state.haltCode=event.code
    }else fail('UNEXPECTED_LEDGER_EVENT')
    state.tail=row.hash;state.nextSequence=row.sequence+1
  }
  return state
}

async function readBound(ledgerPath,root,grant){
  const bytes=await readFile(ledgerPath);check(bytes.length>=grant.ledgerPrefixBytes&&sha(bytes.subarray(0,grant.ledgerPrefixBytes))===grant.ledgerPrefixSha,'LEDGER_PREFIX')
  const {rows}=validateChain(bytes);check(rows.length>=grant.parentSequence&&rows[grant.parentSequence-1]?.hash===grant.parentTail,'LEDGER_PARENT')
  const state=replay(rows,grant),names=(await readdir(join(root,'records'))).sort(),expected=rows.slice(grant.parentSequence).map(row=>String(row.sequence).padStart(9,'0')+'.json')
  check(isDeepStrictEqual(names,expected),'RECEIPT_SET')
  for(const name of names){const row=rows[Number(name.slice(0,9))];check(sha(await readFile(join(root,'records',name)))===sha(JSON.stringify(row)+'\n'),'RECEIPT_DRIFT')}
  return {...state,units:copy(grant.targets),rows,ledger:{rows:rows.length,bytes:bytes.length,sha256:sha(bytes),tail:rows.at(-1).hash,nextSequence:rows.length}}
}
async function append(ledgerPath,root,state,event){
  const row={sequence:state.nextSequence,previous:state.tail,event};row.hash=sha(JSON.stringify(row));const text=JSON.stringify(row)+'\n',receipt=join(root,'records',String(row.sequence).padStart(9,'0')+'.json')
  await writeNew(receipt,text);let handle
  try{handle=await open(ledgerPath,'a',0o600);await handle.writeFile(text);await handle.sync()}catch{fail('LEDGER_APPEND_UNCERTAIN')}finally{if(handle)await handle.close()}
  return row
}

export async function openCandidate13D6Budget({ledgerPath,lockRoot,grant:input}){
  const grant=validateCandidate13D6Grant(input);check(resolve(ledgerPath)===ledgerPath&&resolve(lockRoot)===lockRoot&&lockRoot===grant.lockRoot,'ABSOLUTE_PATH')
  await mkdir(dirname(lockRoot),{recursive:true});try{await mkdir(lockRoot)}catch(error){if(error?.code!=='EEXIST')throw error};await directory(lockRoot)
  try{await mkdir(join(lockRoot,'records'))}catch(error){if(error?.code!=='EEXIST')throw error};await directory(join(lockRoot,'records'))
  const binding=JSON.stringify({version:'candidate13-d6-lock-binding-1',grantSha256:sha(JSON.stringify(grant)),ledgerPath},null,2)+'\n',bindingPath=join(lockRoot,'ROOT_BINDING.json')
  try{await writeNew(bindingPath,binding)}catch(error){check(error?.code==='EEXIST'&&await readFile(bindingPath,'utf8')===binding,'LOCK_BINDING')}
  const boundRead=()=>readBound(ledgerPath,lockRoot,grant);await locked(lockRoot,boundRead)
  return Object.freeze({
    snapshot:()=>locked(lockRoot,boundRead),
    reconcilePending:raw=>locked(lockRoot,async()=>{
      const state=await boundRead(),current=state.reservations.at(-1),target=grant.targets[state.reservations.length-1];check(!state.stopped&&current?.status==='pending','NO_PENDING')
      if(typeof raw!=='string'){await append(ledgerPath,lockRoot,state,{kind:'candidate13D6Uncertain',unitId:current.unitId,nonce:current.nonce,requestSha256:current.requestSha256,code:'TRANSPORT_OR_CRASH_UNKNOWN'});return {status:'uncertain',unitId:current.unitId}}
      let value;try{value=validateUsdUsage(raw,200,target);check(!state.reservations.some(item=>item.responseId===value.responseId),'RESPONSE_REUSED')}
      catch{await append(ledgerPath,lockRoot,state,{kind:'candidate13D6Halt',code:'RESPONSE_OR_USAGE_INVALID'});fail('RESPONSE_OR_USAGE_INVALID')}
      await append(ledgerPath,lockRoot,state,{kind:'candidate13D6Settle',unitId:current.unitId,nonce:current.nonce,requestSha256:current.requestSha256,...value});return {status:'settled',unitId:current.unitId,...value}
    }),
    async reserve(unitId,requestText,now=new Date().toISOString()){
      const reservation=await locked(lockRoot,async()=>{
        let state=await boundRead();check(!state.stopped&&state.reservations.every(item=>item.status==='settled'),'STOPPED_OR_PENDING')
        check(Number.isFinite(Date.parse(now))&&Date.parse(now)>=Date.parse(grant.billingEvidence.checkedAt)&&Date.parse(now)<=Date.parse(grant.billingEvidence.validUntil),'PRICE_EXPIRED')
        const target=grant.targets[state.reservations.length]
        check(target?.unitId===unitId&&typeof requestText==='string'&&sha(requestText)===target.requestSha256&&Buffer.byteLength(requestText)===target.requestBytes,'REQUEST_OR_ORDER')
        check(state.reservations.length<grant.maxBatchRequests&&state.reservations.reduce((sum,item)=>sum+item.costUpperMicroUsd,0)+target.reservedMicroUsd<=grant.hardLimitMicroUsd,'LIMIT')
        if(!state.grant){await append(ledgerPath,lockRoot,state,{kind:'candidate13D6Grant',grant});state=await boundRead()}
        const event={kind:'candidate13D6Reserve',unitId,requestSha256:target.requestSha256,candidateSha256:target.candidateSha256,nonce:randomUUID(),reservedMicroUsd:target.reservedMicroUsd}
        await append(ledgerPath,lockRoot,state,event);return event
      })
      let finalized=false
      const validateLease=state=>{const current=state.reservations.at(-1);check(!state.stopped&&current?.status==='pending'&&current.nonce===reservation.nonce,'LEASE_BINDING')}
      return Object.freeze({unitId,requestSha256:reservation.requestSha256,
        complete:async(raw,status=200)=>{check(!finalized,'LEASE_FINALIZED');finalized=true;return locked(lockRoot,async()=>{const state=await boundRead();validateLease(state);const target=grant.targets[state.reservations.length-1];let value
          try{value=validateUsdUsage(raw,status,target);check(!state.reservations.some(item=>item.responseId===value.responseId),'RESPONSE_REUSED')}
          catch{await append(ledgerPath,lockRoot,state,{kind:'candidate13D6Halt',code:'RESPONSE_OR_USAGE_INVALID'});fail('RESPONSE_OR_USAGE_INVALID')}
          await append(ledgerPath,lockRoot,state,{kind:'candidate13D6Settle',unitId,nonce:reservation.nonce,requestSha256:reservation.requestSha256,...value});return value})},
        uncertain:async()=>{check(!finalized,'LEASE_FINALIZED');finalized=true;return locked(lockRoot,async()=>{const state=await boundRead();validateLease(state);await append(ledgerPath,lockRoot,state,{kind:'candidate13D6Uncertain',unitId,nonce:reservation.nonce,requestSha256:reservation.requestSha256,code:'TRANSPORT_OR_CRASH_UNKNOWN'})})},
      })
    },
  })
}

export const __test={replay,sha,validateUsdUsage}
