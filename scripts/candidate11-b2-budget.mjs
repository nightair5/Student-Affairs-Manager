import {createHash,randomUUID} from 'node:crypto'
import {open,readFile,mkdir,readdir,lstat,realpath,unlink,rmdir} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {CANDIDATE11_B2_POLICY,CANDIDATE11_B2_UNIT_POLICY,validateUsageEnvelope} from './real-input-budget.mjs'

const fail=code=>{throw Error('CANDIDATE11_B2_BUDGET_'+code)}
const check=(value,code)=>{if(!value)fail(code)}
const sha=value=>createHash('sha256').update(value).digest('hex')
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value)
const copy=value=>JSON.parse(JSON.stringify(value))
const same=(a,b,code)=>check(isDeepStrictEqual(a,b),code)
const exact=(value,keys)=>check(value&&typeof value==='object'&&!Array.isArray(value)
  &&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort()),'FIELDS')

async function directory(path){const s=await lstat(path);check(s.isDirectory()&&!s.isSymbolicLink()&&await realpath(path)===path,'DIRECTORY_BINDING')}
async function writeNew(path,text){const f=await open(path,'wx',0o600);try{await f.writeFile(text);await f.sync()}finally{await f.close()}}
async function locked(root,fn){
  await directory(root)
  const lock=join(root,'ledger.lock'),owner=randomUUID()
  try{await mkdir(lock)}catch{fail('BUSY_OR_ABANDONED_LOCK')}
  try{await writeNew(join(lock,'owner'),owner);return await fn()}
  finally{if(await readFile(join(lock,'owner'),'utf8').catch(()=>null)===owner){await unlink(join(lock,'owner'));await rmdir(lock)}}
}

function validateChain(bytes){
  const text=bytes.toString('utf8');check(text.endsWith('\n'),'LEDGER_TERMINATOR')
  const rows=text.trimEnd().split('\n').map(line=>JSON.parse(line));let prior='0'.repeat(64)
  for(const [sequence,row] of rows.entries()){
    exact(row,['sequence','previous','event','hash'])
    check(row.sequence===sequence&&row.previous===prior&&row.hash===sha(JSON.stringify({sequence,previous:prior,event:row.event})),'LEDGER_CHAIN')
    prior=row.hash
  }
  return {rows,tail:prior}
}

function validateTarget(unit){
  exact(unit,['unitId','ordinal','sourceId','sourceVersionId','variant','position','sourceSha','referenceSha','identitySha','requestSha','inputSha','promptSha','exampleSha','schemaSha','scorerSha','adapterVersion','candidateSha','requestBytes'])
  check(/^C11-B1-D0[1-6]-V(?:00|10|01|11)$/.test(unit.unitId)&&Number.isInteger(unit.ordinal)&&unit.ordinal>=1&&unit.ordinal<=24
    &&['V00','V10','V01','V11'].includes(unit.variant)&&Number.isInteger(unit.position)&&unit.position>=1&&unit.position<=4
    &&['sourceSha','referenceSha','identitySha','requestSha','inputSha','promptSha','exampleSha','schemaSha','scorerSha','candidateSha'].every(key=>digest(unit[key]))
    &&unit.adapterVersion==='real-input-model-wire-1'&&Number.isInteger(unit.requestBytes)&&unit.requestBytes>0&&unit.requestBytes<=65536,'TARGET')
}

export function validateCandidate11B2Grant(input){
  const grant=copy(input)
  exact(grant,['version','grantId','parentTail','parentSequence','ledgerPrefixBytes','ledgerPrefixSha','legacyManifestSha','b1ManifestSha','bindingSha','head','sourcesSha','reviewSha','targets','billingEvidence','route','lockRoot','maxBatchRequests','maxTotalRequests','maxBatchBudgetMicroCny','policy','repair','verifier','retry'])
  check(grant.version==='candidate11-b2-grant-1'&&uuid(grant.grantId)&&digest(grant.parentTail)&&grant.parentSequence===644
    &&Number.isInteger(grant.ledgerPrefixBytes)&&grant.ledgerPrefixBytes===519152
    &&['ledgerPrefixSha','legacyManifestSha','b1ManifestSha','bindingSha','sourcesSha','reviewSha'].every(key=>digest(grant[key]))
    &&/^[a-f0-9]{40}$/.test(grant.head)&&resolve(grant.lockRoot)===grant.lockRoot,'GRANT_IDENTITY')
  check(grant.ledgerPrefixSha==='dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597'
    &&grant.b1ManifestSha==='af1f1d2427eec1795691e1d4a62056a614bac72f0254103667632b341794744e'
    &&grant.parentTail==='37ffce66d2e92d036481308f84b08a24c70d42c313cdaf7aaa8ad505f3f2822e','GRANT_BASELINE')
  check(Array.isArray(grant.targets)&&grant.targets.length===24&&grant.targets.every((unit,index)=>{validateTarget(unit);return unit.ordinal===index+1}), 'GRANT_TARGETS')
  check(new Set(grant.targets.map(unit=>unit.unitId)).size===24&&grant.maxBatchRequests===24&&grant.maxTotalRequests===338
    &&grant.maxBatchBudgetMicroCny===51904512&&grant.repair===0&&grant.verifier===0&&grant.retry===0,'GRANT_LIMITS')
  same(grant.policy,CANDIDATE11_B2_POLICY,'POLICY')
  exact(grant.billingEvidence,['checkedAt','validUntil','evidenceSha','documents'])
  check(Number.isFinite(Date.parse(grant.billingEvidence.checkedAt))&&Number.isFinite(Date.parse(grant.billingEvidence.validUntil))
    &&Date.parse(grant.billingEvidence.validUntil)>Date.parse(grant.billingEvidence.checkedAt)
    &&Date.parse(grant.billingEvidence.validUntil)-Date.parse(grant.billingEvidence.checkedAt)<=86400000
    &&digest(grant.billingEvidence.evidenceSha)&&Array.isArray(grant.billingEvidence.documents)
    &&grant.billingEvidence.documents.length>=1&&grant.billingEvidence.documents.every(item=>item.url?.startsWith('https://api-docs.deepseek.com/')),'BILLING_EVIDENCE')
  exact(grant.route,['endpoint','model','temperature','reasoning','maxOutputTokens'])
  check(grant.route.endpoint==='https://api.deepseek.com/responses'&&grant.route.model==='deepseek-flash'&&grant.route.temperature===0
    &&grant.route.reasoning==='none'&&grant.route.maxOutputTokens===8192,'ROUTE')
  return grant
}

function replayB2(rows,grant){
  const state={grant:null,reservations:[],stopped:false,haltCode:null,tail:rows.at(-1).hash,nextSequence:rows.length}
  for(const row of rows.slice(grant.parentSequence)){
    const event=row.event
    if(event.kind==='candidate11Grant'){
      exact(event,['kind','grant']);check(!state.grant&&row.sequence===grant.parentSequence&&row.previous===grant.parentTail,'GRANT_PARENT')
      same(event.grant,grant,'GRANT_DRIFT');state.grant=event.grant
    }else if(event.kind==='candidate11Reserve'){
      exact(event,['kind','unitId','requestSha','candidateSha','nonce','reservedMicroCny'])
      const target=grant.targets[state.reservations.length]
      check(state.grant&&!state.stopped&&state.reservations.every(item=>item.status==='settled')&&target?.unitId===event.unitId
        &&target.requestSha===event.requestSha&&target.candidateSha===event.candidateSha&&uuid(event.nonce)
        &&event.reservedMicroCny===CANDIDATE11_B2_POLICY.reservationMicroCny,'RESERVE_ORDER')
      check((state.reservations.length+1)*event.reservedMicroCny<=grant.maxBatchBudgetMicroCny,'RESERVE_LIMIT')
      state.reservations.push({...event,status:'pending',costUpperMicroCny:event.reservedMicroCny})
    }else if(event.kind==='candidate11Settle'){
      exact(event,['kind','unitId','nonce','requestSha','responseSha','responseId','usage','costUpperMicroCny'])
      const current=state.reservations.at(-1)
      check(!state.stopped&&current?.status==='pending'&&current.unitId===event.unitId&&current.nonce===event.nonce
        &&current.requestSha===event.requestSha&&digest(event.responseSha)&&typeof event.responseId==='string'
        &&!state.reservations.slice(0,-1).some(item=>item.responseId===event.responseId),'SETTLE_BINDING')
      const envelope=JSON.stringify({object:'response',status:'completed',model:CANDIDATE11_B2_UNIT_POLICY.model,id:event.responseId,usage:event.usage,
        output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'ledger usage validation only'}]}]})
      const checked=validateUsageEnvelope(envelope,200,CANDIDATE11_B2_UNIT_POLICY)
      check(event.costUpperMicroCny===checked.costUpperMicroCny,'SETTLE_AMOUNT')
      Object.assign(current,event,{status:'settled'})
    }else if(event.kind==='candidate11Uncertain'){
      exact(event,['kind','unitId','nonce','requestSha','code'])
      const current=state.reservations.at(-1)
      check(!state.stopped&&current?.status==='pending'&&current.unitId===event.unitId&&current.nonce===event.nonce
        &&current.requestSha===event.requestSha&&/^[A-Z_]{1,80}$/.test(event.code),'UNCERTAIN_BINDING')
      Object.assign(current,event,{status:'uncertain'});state.stopped=true;state.haltCode=event.code
    }else if(event.kind==='candidate11Halt'){
      exact(event,['kind','code']);check(!state.stopped&&/^[A-Z_]{1,80}$/.test(event.code),'HALT')
      state.stopped=true;state.haltCode=event.code
    }else fail('UNEXPECTED_LEDGER_EVENT')
    state.tail=row.hash;state.nextSequence=row.sequence+1
  }
  return state
}

async function readBound(ledgerPath,root,grant){
  const bytes=await readFile(ledgerPath)
  check(bytes.length>=grant.ledgerPrefixBytes&&sha(bytes.subarray(0,grant.ledgerPrefixBytes))===grant.ledgerPrefixSha,'LEDGER_PREFIX')
  const {rows}=validateChain(bytes)
  check(rows.length>=grant.parentSequence&&rows[grant.parentSequence-1]?.hash===grant.parentTail,'LEDGER_PARENT')
  const state=replayB2(rows,grant)
  const names=(await readdir(join(root,'records'))).sort()
  const expected=rows.slice(grant.parentSequence).map(row=>String(row.sequence).padStart(9,'0')+'.json')
  check(isDeepStrictEqual(names,expected),'RECEIPT_SET')
  for(const name of names){const row=rows[Number(name.slice(0,9))];check(sha(await readFile(join(root,'records',name)))===sha(JSON.stringify(row)+'\n'),'RECEIPT_DRIFT')}
  return {...state,units:copy(grant.targets),rows,ledger:{rows:rows.length,bytes:bytes.length,sha256:sha(bytes),tail:rows.at(-1).hash,nextSequence:rows.length}}
}

async function append(ledgerPath,root,state,event){
  const row={sequence:state.nextSequence,previous:state.tail,event}
  row.hash=sha(JSON.stringify(row));const text=JSON.stringify(row)+'\n'
  const receipt=join(root,'records',String(row.sequence).padStart(9,'0')+'.json')
  await writeNew(receipt,text)
  let handle
  try{handle=await open(ledgerPath,'a',0o600);await handle.writeFile(text);await handle.sync()}
  catch{fail('LEDGER_APPEND_UNCERTAIN')}
  finally{if(handle)await handle.close()}
  return row
}

export async function openCandidate11B2Budget({ledgerPath,lockRoot,grant:input}){
  const grant=validateCandidate11B2Grant(input)
  check(resolve(ledgerPath)===ledgerPath&&resolve(lockRoot)===lockRoot&&lockRoot===grant.lockRoot,'ABSOLUTE_PATH')
  await mkdir(dirname(lockRoot),{recursive:true})
  try{await mkdir(lockRoot)}catch(error){if(error?.code!=='EEXIST')throw error}
  await directory(lockRoot)
  try{await mkdir(join(lockRoot,'records'))}catch(error){if(error?.code!=='EEXIST')throw error}
  await directory(join(lockRoot,'records'))
  const binding=JSON.stringify({version:'candidate11-b2-lock-binding-1',grantSha:sha(JSON.stringify(grant)),ledgerPath},null,2)+'\n'
  const bindingPath=join(lockRoot,'ROOT_BINDING.json')
  try{await writeNew(bindingPath,binding)}catch(error){check(error?.code==='EEXIST'&&await readFile(bindingPath,'utf8')===binding,'LOCK_BINDING')}
  const boundRead=()=>readBound(ledgerPath,lockRoot,grant)
  await locked(lockRoot,boundRead)
  return Object.freeze({
    snapshot:()=>locked(lockRoot,boundRead),
    halt:code=>locked(lockRoot,async()=>{const state=await boundRead();check(!state.stopped&&/^[A-Z_]{1,80}$/.test(code),'HALT_CODE');await append(ledgerPath,lockRoot,state,{kind:'candidate11Halt',code})}),
    async reserve(unitId,requestText,policy=CANDIDATE11_B2_UNIT_POLICY,now=new Date().toISOString()){
      const reservation=await locked(lockRoot,async()=>{
        let state=await boundRead();check(!state.stopped&&state.reservations.every(item=>item.status==='settled'),'STOPPED_OR_PENDING')
        same(policy,CANDIDATE11_B2_UNIT_POLICY,'POLICY_CHANGED')
        check(Number.isFinite(Date.parse(now))&&Date.parse(now)>=Date.parse(grant.billingEvidence.checkedAt)
          &&Date.parse(now)<=Date.parse(grant.billingEvidence.validUntil),'PRICE_EXPIRED')
        const target=grant.targets[state.reservations.length]
        check(target?.unitId===unitId&&typeof requestText==='string'&&sha(requestText)===target.requestSha
          &&Buffer.byteLength(requestText)===target.requestBytes,'REQUEST_OR_ORDER')
        check(state.reservations.length<grant.maxBatchRequests
          &&(state.reservations.length+1)*CANDIDATE11_B2_POLICY.reservationMicroCny<=grant.maxBatchBudgetMicroCny,'LIMIT')
        if(!state.grant){await append(ledgerPath,lockRoot,state,{kind:'candidate11Grant',grant});state=await boundRead()}
        const event={kind:'candidate11Reserve',unitId,requestSha:target.requestSha,candidateSha:target.candidateSha,nonce:randomUUID(),
          reservedMicroCny:CANDIDATE11_B2_POLICY.reservationMicroCny}
        await append(ledgerPath,lockRoot,state,event);return event
      })
      let finalized=false
      const validateLease=state=>{const current=state.reservations.at(-1);check(!state.stopped&&current?.status==='pending'&&current.nonce===reservation.nonce,'LEASE_BINDING')}
      return Object.freeze({unitId,requestSha:reservation.requestSha,
        async complete(raw,status=200){
          check(!finalized,'LEASE_FINALIZED');finalized=true
          return locked(lockRoot,async()=>{const state=await boundRead();validateLease(state);let value
            try{value=validateUsageEnvelope(raw,status,CANDIDATE11_B2_UNIT_POLICY);check(!state.reservations.some(item=>item.responseId===value.responseId),'RESPONSE_REUSED')}
            catch{await append(ledgerPath,lockRoot,state,{kind:'candidate11Halt',code:'RESPONSE_OR_USAGE_INVALID'});fail('RESPONSE_OR_USAGE_INVALID')}
            await append(ledgerPath,lockRoot,state,{kind:'candidate11Settle',unitId,nonce:reservation.nonce,requestSha:reservation.requestSha,...value});return value})
        },
        async uncertain(){
          check(!finalized,'LEASE_FINALIZED');finalized=true
          return locked(lockRoot,async()=>{const state=await boundRead();validateLease(state)
            await append(ledgerPath,lockRoot,state,{kind:'candidate11Uncertain',unitId,nonce:reservation.nonce,requestSha:reservation.requestSha,code:'TRANSPORT_OR_CRASH_UNKNOWN'})})
        }
      })
    }
  })
}

export const __test={validateChain,replayB2,sha}
