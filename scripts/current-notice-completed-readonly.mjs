// Post-comparison replay only. The paid host still checks active frozen code.
// This reader verifies original Git blobs, exact artifacts and the existing
// once-send host's ledger/raw receipts; it exposes no paid or recovery method.
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {join} from 'node:path'
import {ROOT,BATCH,COUNT,sha} from './prepare-current-notice-diagnostic.mjs'
import {EXECUTION_ROOT} from './current-notice-execution-host.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
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
 const pack=completedCurrentNoticePackage(),scope={batch:BATCH,count:COUNT,snapshot:pack.snapshot}
 const scene=await createScopedHost(scope,{root:EXECUTION_ROOT,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope),packageRead:completedCurrentNoticePackage,role:'COMPLETED_RECORDING_READ_ONLY_NOT_DISPATCH',append:()=>{throw Error('READ_ONLY')},transport:{sendOnce:()=>{throw Error('READ_ONLY')}}}).resumeReadOnly()
 check(scene.audit==='CONSISTENT'&&!scene.halt&&!scene.lockExists&&!scene.uncertainty,'INCONSISTENT_SITE')
 const sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 const recordings=scene.state.units.map(row=>{const u=pack.units[row.ordinal-1],s=sources.find(s=>s.sourceId===u.sourceId),raw=JSON.parse(readFileSync(join(EXECUTION_ROOT,'raw',String(row.ordinal).padStart(2,'0')+'.json')));check(s&&sha(raw.rawHttpText)===row.responseSha256&&raw.requestSha256===u.requestSha256,'RAW_DRIFT');return {ordinal:row.ordinal,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,candidate:u.candidate,sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:u.requestSha256,frozenOutcome:'CURRENT_SINGLE_ARM_SETTLED_RECORDING'}})
 return {pack,scene:{...scene,batch:BATCH,denominator:COUNT},sources,recordings}
}
