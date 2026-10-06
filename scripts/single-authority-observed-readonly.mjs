// Replay only independently verified SETTLED units. A sealed incomplete batch
// stays sealed, retains all eight denominator entries, and cannot dispatch here.
import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {join,resolve} from 'node:path'
import {ROOT,BATCH,COUNT,sha} from './single-authority-comparison.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
import {auditUnitMetadata} from './scoped-execution-core.mjs'
const check=(v,c)=>{if(!v)throw Error('AUTHORITY_OBSERVED_'+c)},read=p=>JSON.parse(readFileSync(p,'utf8'))
export function authorityOriginalPacket(root=ROOT,execution=resolve('.data/single-authority/execution')){
 const mBytes=readFileSync(join(root,'MANIFEST.json')),iBytes=readFileSync(join(root,'PREPARED_REQUEST_IDENTITIES.json')),m=JSON.parse(mBytes),units=JSON.parse(iBytes).requests,state=read(join(execution,'STATE.json'))
 check(m.batch===BATCH&&m.count===COUNT&&units.length===COUNT&&state.batch===BATCH,'BATCH')
 check(sha(execFileSync('git',['show',state.committedHead+':'+ROOT+'/MANIFEST.json']))===sha(mBytes),'ORIGINAL_MANIFEST')
 const bytes=execFileSync('git',['cat-file','--batch'],{input:m.components.map(f=>m.generationCommit+':'+f.path).join('\n')+'\n',maxBuffer:32*1024*1024});let offset=0
 for(const f of m.components){const end=bytes.indexOf(10,offset),match=/^[a-f0-9]+ blob (\d+)$/u.exec(bytes.subarray(offset,end).toString());check(match,'GIT_BLOB');const size=+match[1],body=bytes.subarray(end+1,end+1+size);check(sha(body.toString('utf8').replace(/\r\n/gu,'\n'))===f.sha256,'FROZEN_COMPONENT');offset=end+1+size+1}
 for(const f of m.artifacts)check(sha(readFileSync(join(root,f.path)))===f.sha256,'ARTIFACT')
 for(const [i,u]of units.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u;check(u.ordinal===i+1&&u.batch===BATCH&&status==='NOT_RUN'&&!dispatchAuthorized&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY')}
 return {units,snapshot:m.generationCommit,binding:{manifestSha256:sha(mBytes),identitiesSha256:sha(iBytes)}}
}
export function inspectAuthorityObservedSite(execution,pack,ledgerPath){
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
export function authorityObservedScene(){
 const root=resolve('.data/single-authority/execution'),pack=authorityOriginalPacket(ROOT,root),site=inspectAuthorityObservedSite(root,pack,AUTHORITATIVE_LEDGER),sources=read(join(ROOT,'SOURCES.json')).sources
 const recordings=site.known.map(({u,raw})=>{const s=sources.find(v=>v.sourceId===u.sourceId);check(s&&sha(s.sourceText)===u.sourceSha256,'SOURCE');return {ordinal:u.ordinal,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,candidate:u.candidate,...(u.candidate==='SingleAuthority'?{generationContract:'single-authority-source-contract-5.0.0'}:{}),sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:raw.requestSha256,frozenOutcome:'KNOWN_SETTLED_SEALED_INCOMPLETE_BATCH_POST_COMPARISON_PROGRAM'}})
 return {pack,scene:site.scene,sources,recordings}
}
