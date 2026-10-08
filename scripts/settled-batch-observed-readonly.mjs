// Read-only replay of independently verified SETTLED units. Validate the entire
// chain and this batch's immutable prefix/receipts; unrelated legal append rows
// do not turn a settled response into missing data. No mutation or dispatch API.
import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const sha=v=>createHash('sha256').update(v).digest('hex')
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
import {auditUnitMetadata} from './scoped-execution-core.mjs'
const check=(v,c)=>{if(!v)throw Error('AUTHORITY_OBSERVED_'+c)},read=p=>JSON.parse(readFileSync(p,'utf8'))
function inspectObservedSite(execution,pack,ledgerPath,BATCH,COUNT){
 const authBytes=readFileSync(join(execution,'AUTHORIZATION.json')),auth=JSON.parse(authBytes),stateBytes=readFileSync(join(execution,'STATE.json')),state=JSON.parse(stateBytes),bytes=readFileSync(ledgerPath),chain=validateChain(bytes)
 check(state.authorized&&state.batch===BATCH&&state.units.length===COUNT&&state.snapshotCommit===pack.snapshot&&state.grantId===auth.grantId&&state.committedHead===auth.committedHead&&state.hostAuthorizationSha256===sha(authBytes),'STATE_AUTH')
 check(state.manifestSha256===pack.binding.manifestSha256&&state.identitiesSha256===pack.binding.identitiesSha256&&auth.manifestSha256===pack.binding.manifestSha256&&auth.identitiesSha256===pack.binding.identitiesSha256,'PACKET')
 check(sha(readFileSync(join(execution,'USER_AUTHORIZATION.txt')))===auth.userMessageSha256&&sha(readFileSync(join(execution,'PRICE_EVIDENCE.json')))===auth.priceEvidenceSha256,'LOCAL_AUTH_BINDING')
 check(chain.rows.length>=auth.ledgerBaselineRows&&sha(bytes.subarray(0,auth.ledgerBaselineBytes))===auth.ledgerBaselineSha256,'LEDGER_PREFIX')
 const rows=chain.rows.slice(auth.ledgerBaselineRows).filter(r=>r.event.batchId===BATCH||r.event.grantId===auth.grantId),grant=rows[0]?.event
 check(rows.every(r=>r.event.batchId===BATCH&&r.event.grantId===auth.grantId)&&rows.filter(r=>r.event.kind==='scopedGrant').length===1&&grant?.kind==='scopedGrant'&&grant.head===auth.committedHead&&grant.snapshotCommit===pack.snapshot&&grant.authorizationSha256===sha(authBytes)&&grant.manifestSha256===pack.binding.manifestSha256&&grant.identitiesSha256===pack.binding.identitiesSha256&&grant.hardLimitMicroUsd===auth.hardLimitMicroUsd,'GRANT')
 check(rows.slice(1).every(r=>['scopedReserve','scopedSettle'].includes(r.event.kind)&&Number.isInteger(r.event.ordinal)&&r.event.ordinal>=1&&r.event.ordinal<=COUNT),'LEDGER_UNIT_SCOPE')
 for(const row of rows)check(readFileSync(join(execution,'receipts',String(row.sequence).padStart(9,'0')+'.json'),'utf8')===JSON.stringify(row)+'\n','RECEIPT')
 check(readdirSync(join(execution,'receipts')).length===rows.length,'EXTRA_RECEIPT')
 const known=[]
 for(const [i,row]of state.units.entries()){
  const u=pack.units[i],p=join(execution,'raw',String(i+1).padStart(2,'0')+'.json'),events=rows.filter(r=>r.event.ordinal===i+1),reserve=events.filter(r=>r.event.kind==='scopedReserve'),settle=events.filter(r=>r.event.kind==='scopedSettle')
  check(row.ordinal===i+1&&row.unitIdentitySha256===u.unitIdentitySha256&&row.requestSha256===u.requestSha256&&auth.units[i]===u.unitIdentitySha256&&auth.requestSha256s[i]===u.requestSha256,'UNIT')
  check(reserve.length<=1&&settle.length<=1,'DUPLICATE')
  check(reserve.every(r=>r.event.requestSha256===u.requestSha256&&r.event.unitIdentitySha256===u.unitIdentitySha256),'RESERVE_IDENTITY')
  if(row.status==='SETTLED'){
   check(reserve.length===1&&settle.length===1&&reserve[0].event.requestSha256===u.requestSha256&&reserve[0].event.unitIdentitySha256===u.unitIdentitySha256&&existsSync(p),'SETTLED_RECEIPTS')
   const raw=read(p);check(raw.ordinal===i+1&&raw.requestSha256===u.requestSha256&&raw.unitIdentitySha256===u.unitIdentitySha256&&sha(raw.rawHttpText)===row.responseSha256&&raw.responseSha256===row.responseSha256&&settle[0].event.responseSha256===row.responseSha256,'RAW')
   auditUnitMetadata(raw,row,settle[0].event,auth.pricing);check(row.usage!=='NOT_OBSERVABLE','USAGE_UNKNOWN');known.push({u,raw})
  }else if(row.status==='NOT_SENT')check(!events.length&&!existsSync(p),'NOT_SENT_EVIDENCE')
  else check(row.status==='UNCERTAIN'&&reserve.length===1&&settle.length===0&&!existsSync(p),'UNCERTAIN_EVIDENCE')
 }
 check(readdirSync(join(execution,'raw')).length===known.length,'EXTRA_RAW')
 check(!state.units.some(r=>r.status==='UNCERTAIN')||(existsSync(join(execution,'lock'))&&existsSync(join(execution,'HALT.json'))),'SEALED_SITE_REQUIRED')
 return {known,scene:{role:'SEALED_BATCH_KNOWN_SETTLED_READ_ONLY',batch:BATCH,denominator:COUNT,verifiedSettled:known.length,units:state.units.map(r=>({ordinal:r.ordinal,status:r.status})),lockExists:existsSync(join(execution,'lock')),haltExists:existsSync(join(execution,'HALT.json')),winner:'EVIDENCE_INCOMPLETE',modelRequests:0,ledgerWrites:0,dispatch:'DISABLED_NO_MUTATION_API',ledger:{rows:chain.rows.length,sha256:sha(bytes),tail:chain.tail,batchRows:rows.length}}}
}
export function observedSettledBatch({root,execution,batch,count,verifyPacket}){
 const pack=verifyPacket({observedReadOnly:true}),site=inspectObservedSite(execution,pack,AUTHORITATIVE_LEDGER,batch,count),sources=read(join(root,'SOURCES.json')).sources
 const recordings=site.known.map(({u,raw})=>{const s=sources.find(v=>v.sourceId===u.sourceId);check(s&&sha(s.sourceText)===u.sourceSha256,'SOURCE');return {ordinal:u.ordinal,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,candidate:u.candidate,generationContract:u.generationContract,sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:raw.requestSha256,frozenOutcome:'KNOWN_SETTLED_READ_ONLY_NOT_NEW_MODEL_SCORE'}})
 return {pack,scene:site.scene,sources,recordings}
}
