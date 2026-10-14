// Forensic replay of verified SETTLED records in a sealed batch. No dispatch,
// lock recovery, authorization preparation, ledger append or state writer exists here.
import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {verifyPublicDiagnostic,BATCH,COUNT,ROOT,sha} from './prepare-public-notice-diagnostic.mjs'
import {readCandidate19Package} from './candidate19-execution-host.mjs'
import {candidate19Recordings} from './candidate19-recorded-data.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
import {auditUnitMetadata} from './scoped-execution-core.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const check=(ok,code)=>{if(!ok)throw Error('READ_ONLY_RECORDING_'+code)}
function packetAt(snapshot,readPacket,root){
  const active=process.cwd();let pack,manifest
  try{process.chdir(snapshot);pack=readPacket();manifest=read(join(root,'MANIFEST.json'))}finally{process.chdir(active)}
  check(sha(readFileSync(join(root,'MANIFEST.json')))===pack.binding.manifestSha256&&sha(readFileSync(join(root,'PREPARED_REQUEST_IDENTITIES.json')))===pack.binding.identitiesSha256,'ACTIVE_FROZEN_IDENTITIES')
  for(const f of manifest.artifacts)check(sha(readFileSync(join(root,f.path)))===f.sha256,'FROZEN_ARTIFACT_'+f.path)
  return pack
}
function inspectSite(root,pack,batch,count){
  const stateBytes=readFileSync(join(root,'STATE.json')),state=JSON.parse(stateBytes),authBytes=readFileSync(join(root,'AUTHORIZATION.json')),auth=JSON.parse(authBytes)
  const bytes=readFileSync(AUTHORITATIVE_LEDGER),chain=validateChain(bytes)
  check(sha(bytes.subarray(0,auth.ledgerBaselineBytes))===auth.ledgerBaselineSha256&&chain.rows.length>=auth.ledgerBaselineRows,'LEDGER_PREFIX')
  check(sha(readFileSync(join(root,'USER_AUTHORIZATION.txt')))===auth.userMessageSha256&&sha(readFileSync(join(root,'PRICE_EVIDENCE.json')))===auth.priceEvidenceSha256,'LOCAL_AUTH_EVIDENCE')
  check(state.authorized&&state.batch===batch&&state.units.length===count&&state.snapshotCommit===pack.snapshot&&state.committedHead===auth.committedHead&&state.hostAuthorizationSha256===sha(authBytes)&&state.grantId===auth.grantId,'STATE_AUTH')
  check(state.manifestSha256===pack.binding.manifestSha256&&state.identitiesSha256===pack.binding.identitiesSha256&&auth.manifestSha256===pack.binding.manifestSha256&&auth.identitiesSha256===pack.binding.identitiesSha256,'STATE_PACKET')
  const rows=chain.rows.slice(auth.ledgerBaselineRows).filter(r=>r.event.batchId===batch||r.event.grantId===auth.grantId)
  check(rows.every(r=>r.event.batchId===batch&&r.event.grantId===auth.grantId)&&rows.filter(r=>r.event.kind==='scopedGrant').length===1,'UNIQUE_GRANT')
  const grant=rows[0]?.event
  check(grant?.kind==='scopedGrant'&&grant.authorizationSha256===sha(authBytes)&&grant.head===state.committedHead&&grant.snapshotCommit===pack.snapshot&&grant.manifestSha256===pack.binding.manifestSha256&&grant.identitiesSha256===pack.binding.identitiesSha256&&grant.hardLimitMicroUsd===auth.hardLimitMicroUsd,'GRANT')
  for(const row of rows)check(readFileSync(join(root,'receipts',String(row.sequence).padStart(9,'0')+'.json'),'utf8')===JSON.stringify(row)+'\n','RECEIPT')
  check(readdirSync(join(root,'receipts')).length===rows.length,'EXTRA_RECEIPT')
  const known=[]
  for(const [i,row]of state.units.entries()){
    const unit=pack.units[i],rawPath=join(root,'raw',String(i+1).padStart(2,'0')+'.json'),unitRows=rows.filter(r=>r.event.ordinal===i+1),reserve=unitRows.filter(r=>r.event.kind==='scopedReserve'),settle=unitRows.filter(r=>r.event.kind==='scopedSettle')
    check(row.ordinal===i+1&&row.unitIdentitySha256===unit.unitIdentitySha256&&row.requestSha256===unit.requestSha256&&auth.units[i]===unit.unitIdentitySha256&&auth.requestSha256s[i]===unit.requestSha256,'UNIT_IDENTITY')
    check(reserve.length<=1&&settle.length<=1&&unitRows.every(r=>r.event.unitIdentitySha256===undefined||r.event.unitIdentitySha256===unit.unitIdentitySha256),'DUPLICATE_UNIT')
    if(row.status==='SETTLED'){
      check(reserve.length===1&&settle.length===1&&reserve[0].event.requestSha256===unit.requestSha256&&existsSync(rawPath),'SETTLED_RECEIPTS')
      const raw=read(rawPath)
      check(raw.ordinal===i+1&&raw.unitIdentitySha256===unit.unitIdentitySha256&&raw.requestSha256===unit.requestSha256&&sha(raw.rawHttpText)===raw.responseSha256&&raw.responseSha256===row.responseSha256&&settle[0].event.responseSha256===row.responseSha256,'RAW_HASH')
      auditUnitMetadata(raw,row,settle[0].event,auth.pricing)
      known.push({unit,row,raw})
    }else if(row.status==='NOT_SENT')check(unitRows.length===0&&!existsSync(rawPath),'NOT_SENT_HAS_EVIDENCE')
    else check(row.status==='UNCERTAIN','UNSUPPORTED_STATE')
  }
  check(readdirSync(join(root,'raw')).length===known.length,'UNEXPECTED_RAW')
  return {state,known,scene:{role:'SEALED_BATCH_FORENSIC_READ_ONLY',batch,denominator:count,status:state.units.every(r=>r.status==='SETTLED')?'COMPLETE_READ_ONLY':'HALTED_READ_ONLY',units:state.units.map(r=>({ordinal:r.ordinal,status:r.status,haltReason:r.haltReason??null})),verifiedSettled:known.length,lockExists:existsSync(join(root,'lock')),halt:existsSync(join(root,'HALT.json'))?read(join(root,'HALT.json')):null,localIntegrity:{stateSha256:sha(stateBytes),authorizationSha256:sha(authBytes),priceEvidenceSha256:auth.priceEvidenceSha256,userAuthorizationSha256:auth.userMessageSha256},ledger:{rows:chain.rows.length,sha256:sha(bytes),tail:chain.tail,batchRows:rows.length},modelRequests:0,ledgerWrites:0,dispatch:'DISABLED_NO_MUTATION_API'}}
}
export function publicNoticeRecordedScene(snapshot='C:/Users/Winner/.codex/worktrees/student-affairs-public-frozen/比赛'){
  const pack=packetAt(snapshot,verifyPublicDiagnostic,ROOT),root=resolve('.data/public-notice-development/execution'),site=inspectSite(root,pack,BATCH,COUNT),sources=read(join(ROOT,'SOURCES.json')).sources
  check(site.scene.lockExists&&site.scene.halt?.code==='UNIT_SEND_RAW_OR_SETTLEMENT_UNCERTAIN','SEALED_SITE_REQUIRED')
  const recordings=site.known.map(({unit,raw})=>{
    const source=sources.find(s=>s.sourceId===unit.sourceId)
    check(source&&sha(source.sourceText)===source.sourceSha256,'SOURCE')
    return {ordinal:unit.ordinal,sourceId:source.sourceId,sourceVersionId:source.sourceVersionId,candidate:unit.candidate,sourceText:source.sourceText,referenceTime:source.referenceTime,timezone:source.timezone,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:raw.requestSha256,frozenOutcome:'KNOWN_SETTLED_IN_SEALED_INCOMPLETE_BATCH'}
  })
  return {pack,...site,recordings,sources}
}
export function historicalCandidate19Controls(snapshot='C:/Users/Winner/.codex/worktrees/student-affairs-c19-frozen/比赛'){
  const root='docs/recognition-optimization/candidate19-development',pack=packetAt(snapshot,readCandidate19Package,root),site=inspectSite(resolve('.data/candidate19/execution'),pack,'C19-C17-C19-DEVELOPMENT-R1',12)
  check(site.known.length===12&&!site.scene.lockExists&&!site.scene.halt,'HISTORICAL_SETTLED')
  const recordings=candidate19Recordings({units:pack.units,sources:read(join(root,'SOURCES.json')).sources,state:site.state,rawRoot:'.data/candidate19/execution/raw'})
  // Distinct ordinals and explicit historical labels prevent batch-denominator mixing.
  return recordings.map(r=>({...r,ordinal:r.ordinal+200,frozenOutcome:'HISTORICAL_REGRESSION_NOT_CURRENT_FOUR'}))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){console.log(JSON.stringify(publicNoticeRecordedScene().scene,null,2))}
