// Current V7, single-arm official excerpts. Uses the existing scoped executor.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
export const ROOT='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/qualification-association-followup'
export const BATCH='V7-CURRENT-QUALIFICATION-PUBLIC-DEVELOPMENT-20261008-R1',COUNT=4
export const sha=v=>createHash('sha256').update(v).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
const normalized=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n'))
const check=(v,c)=>{if(!v)throw Error('CURRENT_ROLE_'+c)}
export const SOURCE_SELECTION=['FRESH-02','FRESH-04','FRESH-05','FRESH-06']
export async function currentRoleComponents(){
 const b=await build({stdin:{contents:`export * from './src/recognition/sourceContractV7';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
export async function makeCurrentRolePacket(){
 const all=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-mainline/SOURCES.json')).sources,x=await currentRoleComponents()
 const sources=SOURCE_SELECTION.map(id=>{const s=all.find(s=>s.id===id);check(s&&sha(s.sourceText)===s.sourceSha256,'SOURCE');return {...s,sourceId:'current-role-public-'+id,sourceVersionId:'current-role-public-'+id+'-v1',role:'OFFICIAL_EXCERPT_SEEN_DEVELOPMENT_NOT_HOLDOUT',seenStatus:'USED_IN_LOCAL_DEVELOPMENT_AND_OLD_V6_NOT_CURRENT_V7',modelOutput:'NOT_RUN'}})
 const references={version:'current-role-source-facts-1.0.0',truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',sources:sources.map(s=>({sourceId:s.sourceId,minimumFacts:s.facts,disputes:s.disputes,checks:['all obligations and non-task events','time values/precision/owner and reference-time','material/format/naming/destination/completion','qualification versus prerequisite, no unsupported personal true','explicit task-event association or documented ambiguity','all titles/free prose and extra facts source-supported'],rule:'Any definite critical fact error => INCORRECT. Disputed or unadjudicated necessary facts/prose => UNKNOWN. Only complete source-supported facts => PROVISIONAL_CORRECT. User fixes excluded.'}))}
 const requests=[]
 for(const s of sources){const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},r=await x.buildRoleAuthorityRequest(context),body={...r.body,model:'deepseek-flash'}
  const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,candidate:'RoleAuthority',candidateVersion:x.ROLE_CANDIDATE_VERSION,promptVersion:x.ROLE_PROMPT_VERSION,generationContract:x.ROLE_AUTHORITY_VERSION,requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(references)),model:'deepseek-flash',scorer:references.version,referenceTime:s.referenceTime,timezone:s.timezone}
  check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
  requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,status:'NOT_RUN',dispatchAuthorized:false})
 }
 const sealed=['.data/obligation-authority/execution/STATE.json','.data/single-authority/execution/STATE.json','.data/public-notice/execution/STATE.json','.data/afternoon-mainline-20261008/execution/STATE.json'].filter(existsSync).flatMap(p=>JSON.parse(readFileSync(p)).units??[]).filter(u=>u.status==='UNCERTAIN')
 check(requests.every(u=>sealed.every(o=>u.requestSha256!==o.requestSha256&&u.unitIdentitySha256!==o.unitIdentitySha256)),'SEALED_REUSE')
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':references,'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,count:COUNT,purpose:'Measure current V7 first facts and first ordinary display on four already acquired official excerpts, before any new generation hypothesis.',singleArm:true,selection:SOURCE_SELECTION,rationale:'Qualification/window, ordinary core duty with conditional detail, equipment/activity preparation, optional open lecture with exact time: four different fact structures; no new templates, old uncertain source not resent.',commonRules:'Current committed public conversion and ordinary first display; model raw / program display / human final separate.',denominator:4,provisional:true,notHoldout:true,comparisonWinner:'NOT_APPLICABLE_SINGLE_ARM',conclusions:['WHOLE_NET_GAIN_NO_NEW_CRITICAL_RISK','TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN','MIXED_PROGRESS','NO_BENEFIT','EVIDENCE_INCOMPLETE'],frozenUnknowns:'日前边界 and full condition splitting preserve disputes; unadjudicated prose/leakage not full credit.',extras:{retry:0,repair:0,verifier:0,extraSamples:0}}}
 const g=await build({entryPoints:['scripts/current-role-diagnostic.mjs','scripts/current-role-host.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(g.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json','cloudflare/recognition-contract.generated.mjs'])].sort()
 artifacts['MANIFEST.json']={version:'current-role-single-arm-freeze-1',batch:BATCH,count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
 return artifacts
}
export function verifyCurrentRole({observedReadOnly=false}={}){
 const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&!m.dispatchAuthorized&&ids.status==='NOT_RUN'&&!ids.dispatchAuthorized,'SCOPE')
 for(const f of m.components){check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path);if(!observedReadOnly)check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 check(ids.requests.length===COUNT&&sources.length===COUNT,'COUNT')
 for(const [i,u]of ids.requests.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u,s=sources.find(s=>s.sourceId===u.sourceId);check(i+1===u.ordinal&&u.batch===BATCH&&s&&sha(s.sourceText)===u.sourceSha256&&!dispatchAuthorized&&status==='NOT_RUN'&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY');check(body.model==='deepseek-flash'&&body.temperature===0&&body.reasoning.effort==='none'&&!body.stream&&body.max_output_tokens===8192,'PARAMETERS');check(u.referenceSha256===sha(readFileSync(join(ROOT,'REFERENCES.json')))&&u.referenceTime===s.referenceTime&&u.timezone===s.timezone,'REFERENCE')}
 check(new Set(ids.requests.map(u=>u.unitIdentitySha256)).size===COUNT,'UNIQUE')
 return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,...rest]=process.argv.slice(2);check(!rest.length,'ARGS')
 if(mode==='--write'){check(execFileSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim().split(/\r?\n/u).filter(Boolean).every(l=>l==='?? CODEX_DESKTOP_HANDOVER.md'),'COMMITTED_CODE_REQUIRED');const a=await makeCurrentRolePacket();mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(a)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}}
 else check(mode==='--verify','MODE')
 const p=verifyCurrentRole();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))
}
