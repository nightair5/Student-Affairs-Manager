// Post-comparison replay only. The paid host still checks active frozen code.
// This reader verifies original Git blobs, exact artifacts and the existing
// once-send host's ledger/raw receipts; it exposes no paid or recovery method.
import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import {join} from 'node:path'
import {ROOT,BATCH,COUNT,sha} from './prepare-current-notice-diagnostic.mjs'
import {EXECUTION_ROOT} from './current-notice-execution-host.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
import {auditUnitMetadata,conservativeUpperMicroUsd} from './scoped-execution-core.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
const check=(v,c)=>{if(!v)throw Error('CURRENT_COMPLETED_'+c)}
export function completedCurrentNoticePackage(){
 const manifestBytes=readFileSync(join(ROOT,'MANIFEST.json')),identityBytes=readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))
 const m=JSON.parse(manifestBytes),units=JSON.parse(identityBytes).requests
 const state=JSON.parse(readFileSync(join(EXECUTION_ROOT,'STATE.json')))
 check(state.batch===BATCH&&state.units.length===COUNT&&state.units.every(u=>u.status==='SETTLED'),'DETERMINATE_BATCH_REQUIRED')
 check(sha(execFileSync('git',['show',state.committedHead+':'+ROOT+'/MANIFEST.json']))===sha(manifestBytes),'ORIGINAL_MANIFEST')
 const paths=m.components.map(f=>m.generationCommit+':'+f.path)
 const bytes=execFileSync('git',['cat-file','--batch'],{input:paths.join('\n')+'\n',maxBuffer:32*1024*1024});let offset=0
 for(const f of m.components){const end=bytes.indexOf(10,offset),header=bytes.subarray(offset,end).toString(),match=/^[a-f0-9]+ blob (\d+)$/u.exec(header);check(match,'GIT_BLOB');const size=+match[1],body=bytes.subarray(end+1,end+1+size);check(sha(body.toString('utf8').replace(/\r\n/gu,'\n'))===f.sha256,'FROZEN_COMPONENT');offset=end+1+size+1}
 for(const a of m.artifacts)check(sha(readFileSync(join(ROOT,a.path)))===a.sha256,'FROZEN_ARTIFACT')
 for(const [i,u]of units.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u;check(i+1===u.ordinal&&u.batch===BATCH&&status==='NOT_RUN'&&!dispatchAuthorized&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY')}
 return {units,snapshot:m.generationCommit,binding:{manifestSha256:sha(manifestBytes),identitiesSha256:sha(identityBytes)}}
}
export async function completedCurrentNoticeScene(){
 const pack=completedCurrentNoticePackage(),scene=inspectCompletedCurrentNoticeSite(EXECUTION_ROOT,pack,AUTHORITATIVE_LEDGER)
 const sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 const recordings=scene.state.units.map(row=>{const u=pack.units[row.ordinal-1],s=sources.find(s=>s.sourceId===u.sourceId),raw=JSON.parse(readFileSync(join(EXECUTION_ROOT,'raw',String(row.ordinal).padStart(2,'0')+'.json')));check(s&&sha(raw.rawHttpText)===row.responseSha256&&raw.requestSha256===u.requestSha256,'RAW_DRIFT');return {ordinal:row.ordinal,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,candidate:u.candidate,sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:u.requestSha256,frozenOutcome:'CURRENT_SINGLE_ARM_SETTLED_RECORDING'}})
 return {pack,scene:{...scene,batch:BATCH,denominator:COUNT},sources,recordings}
}

/** A completed batch remains replayable after other batches legally append.
 * Verify the full chain, immutable baseline and exactly this batch's receipts.
 * This reader has no dispatch/append/recovery API; the paid host stays strict. */
export function inspectCompletedCurrentNoticeSite(root,pack,ledgerPath){
 const read=p=>JSON.parse(readFileSync(join(root,p),'utf8'))
 const authBytes=readFileSync(join(root,'AUTHORIZATION.json')),auth=JSON.parse(authBytes),state=read('STATE.json')
 const bytes=readFileSync(ledgerPath),chain=validateChain(bytes),{units,snapshot,binding}=pack
 check(!existsSync(join(root,'lock'))&&!existsSync(join(root,'HALT.json'))&&!existsSync(join(root,'STATE.json.new')),'UNSEALED_COMPLETED_REQUIRED')
 check(state.version==='scoped-execution-state-2'&&state.batch===BATCH&&state.model==='deepseek-flash'&&state.authorized===true
  &&state.units.length===COUNT&&state.units.every(u=>u.status==='SETTLED'),'DETERMINATE_BATCH_REQUIRED')
 check(auth.authorized===true&&auth.batch===BATCH&&auth.count===COUNT&&state.grantId===auth.grantId
  &&state.committedHead===auth.committedHead&&state.snapshotCommit===snapshot&&auth.snapshotCommit===snapshot
  &&state.hostAuthorizationSha256===sha(authBytes),'STATE_AUTH')
 check(state.manifestSha256===binding.manifestSha256&&state.identitiesSha256===binding.identitiesSha256
  &&auth.manifestSha256===binding.manifestSha256&&auth.identitiesSha256===binding.identitiesSha256,'PACKET')
 check(sha(readFileSync(join(root,'USER_AUTHORIZATION.txt')))===auth.userMessageSha256
  &&sha(readFileSync(join(root,'PRICE_EVIDENCE.json')))===auth.priceEvidenceSha256
  &&isDeepStrictEqual(read('PRICE_EVIDENCE.json').pricing,auth.pricing),'LOCAL_AUTH_BINDING')
 check(Number.isSafeInteger(auth.ledgerBaselineRows)&&auth.ledgerBaselineRows>0
  &&Number.isSafeInteger(auth.ledgerBaselineBytes)&&auth.ledgerBaselineBytes>0
  &&chain.rows.length>=auth.ledgerBaselineRows
  &&validateChain(bytes.subarray(0,auth.ledgerBaselineBytes)).rows.length===auth.ledgerBaselineRows
  &&sha(bytes.subarray(0,auth.ledgerBaselineBytes))===auth.ledgerBaselineSha256,'LEDGER_PREFIX')
 check(!chain.rows.slice(0,auth.ledgerBaselineRows).some(r=>r.event.batchId===BATCH||r.event.batch===BATCH||r.event.grantId===auth.grantId),'PREVIOUS_BATCH_OR_GRANT')
 const later=chain.rows.slice(auth.ledgerBaselineRows),rows=later.filter(r=>r.event.batchId===BATCH||r.event.batch===BATCH||r.event.grantId===auth.grantId)
 check(rows.length===1+2*COUNT&&rows.every(r=>r.event.batchId===BATCH&&r.event.grantId===auth.grantId),'BATCH_ROWS')
 const grant=rows[0].event
 check(grant.kind==='scopedGrant'&&grant.head===auth.committedHead&&grant.snapshotCommit===snapshot
  &&grant.authorizationSha256===sha(authBytes)&&grant.manifestSha256===binding.manifestSha256
  &&grant.identitiesSha256===binding.identitiesSha256&&grant.hardLimitMicroUsd===auth.hardLimitMicroUsd,'GRANT')
 const upper=conservativeUpperMicroUsd(auth.pricing.maxInputTokens,8192,auth.pricing)
 for(const [i,u]of units.entries()){
  const row=state.units[i],reserve=rows[1+2*i].event,settle=rows[2+2*i].event,raw=read('raw/'+String(i+1).padStart(2,'0')+'.json')
  check(row.ordinal===i+1&&row.unitIdentitySha256===u.unitIdentitySha256&&row.requestSha256===u.requestSha256
   &&auth.units[i]===u.unitIdentitySha256&&auth.requestSha256s[i]===u.requestSha256,'IDENTITY')
  check(reserve.kind==='scopedReserve'&&settle.kind==='scopedSettle'&&reserve.ordinal===i+1&&settle.ordinal===i+1
   &&reserve.unitIdentitySha256===u.unitIdentitySha256&&reserve.requestSha256===u.requestSha256&&reserve.upperMicroUsd===upper,'UNIT_ROWS')
  check(raw.ordinal===i+1&&raw.unitIdentitySha256===u.unitIdentitySha256&&raw.requestSha256===u.requestSha256
   &&sha(raw.rawHttpText)===row.responseSha256&&raw.responseSha256===row.responseSha256
   &&settle.responseSha256===row.responseSha256&&settle.costUpperMicroUsd===row.costUpperMicroUsd,'RAW')
  auditUnitMetadata(raw,row,settle,auth.pricing)
  check(row.usage!=='NOT_OBSERVABLE','USAGE_UNKNOWN')
 }
 check(readdirSync(join(root,'raw')).length===COUNT&&readdirSync(join(root,'receipts')).length===rows.length,'EXTRA_LOCAL_FILES')
 for(const row of rows)check(readFileSync(join(root,'receipts',String(row.sequence).padStart(9,'0')+'.json'),'utf8')===JSON.stringify(row)+'\n','RECEIPT')
 return {status:'READ_ONLY',role:'COMPLETED_RECORDING_READ_ONLY_NOT_DISPATCH',state,audit:'CONSISTENT',uncertainty:null,lockExists:false,halt:null,
  dispatch:'DISABLED_NO_MUTATION_API',ledgerWrites:0,modelRequests:0,batch:BATCH,denominator:COUNT,
  ledger:{rows:chain.rows.length,sha256:sha(bytes),tail:chain.tail,batchRows:rows.length,otherLaterRows:later.length-rows.length}}
}
