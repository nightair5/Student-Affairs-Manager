// Thin batch binding; the existing once-send engine and ordinary product remain authoritative.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {ROOT as PARENT,sha,json} from './current-role-diagnostic.mjs'
export {sha,json}
export const ROOT=PARENT+'/real-notice-fact-role',BATCH='FACT-ROLE-CURRENT-REAL-NOTICE-DEVELOPMENT-20261009-R1',COUNT=4
export const PACKAGE_ROOT=resolve('.data/autonomous-real-notice-20261009-1805'),EXECUTION_ROOT=resolve(PACKAGE_ROOT,'execution-real-notice')
const check=(v,c)=>{if(!v)throw Error('FACT_ROLE_PACKET_'+c)}
const normalized=b=>sha(b.toString('utf8').replace(/\r\n/gu,'\n'))
export async function factRoleComponents(){
 const b=await build({stdin:{contents:`export * from './src/recognition/factRoleContract';export * from './src/recognition/taskRequirementsContract';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
export async function makeFactRolePacket(){
 const x=await factRoleComponents(),sources=JSON.parse(readFileSync(join(PACKAGE_ROOT,'SOURCE_SPECIFICATIONS.json')))
 const references={version:'real-notice-fact-role-adjudication-1.0.0',truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',sources:sources.map(s=>({sourceId:s.sourceId,minimumFacts:s.minimumFacts,disputes:s.disputes})),rule:'Source-first complete minimum obligations. Equivalent closed naming, order and lossless date spans allowed; wrong value/type/owner/relationship, material role, omission or unsupported added obligation fail. Raw facts and frozen common first-display separate. Explicit unknown may be correct. Titles/free prose/leakage unreviewed NOT_ADJUDICATED. Failure/unknown remains the single-arm denominator4; complete source-supported minimum facts and whole prose reported separately. No user correction credited.'}
 const requests=[]
 for(const s of sources)for(const candidate of ['FactRoleAuthority']){
  const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},r=await(candidate==='TaskRequirements'?x.buildTaskRequirementsRequest(context):x.buildFactRoleRequest(context)),body={...r.body,model:'deepseek-flash'}
  const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,candidate,candidateVersion:r.candidateVersion,promptVersion:r.promptVersion,generationContract:r.componentVersion,requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(references)),model:'deepseek-flash',scorer:references.version,referenceTime:s.referenceTime,timezone:s.timezone}
  check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
  requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,status:'NOT_RUN',dispatchAuthorized:false})
 }
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':references,'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,count:COUNT,purpose:'Diagnose current FactRoleAuthority on four official excerpts without prior model outputs; no candidate comparison',hypothesis:'Current entity-owned facts should retain actual duties, date windows, applicable conditions, receipts and no-task maintenance events without unsupported tasks or fabricated clocks.',denominator:4,order:'RN-01/RN-02/RN-03/RN-04',commonRules:'Same committed public converter, source references and ordinary first display. Only current generator; no paired winner or generation improvement claim.',seen:'Official public excerpts, chosen before any output, engineering references established before output; Development, not Holdout or independent human truth.',conclusions:['WHOLE_NET_GAIN_NO_NEW_CRITICAL_RISK','TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN','MIXED_PROGRESS','NO_BENEFIT','EVIDENCE_INCOMPLETE'],extras:{retry:0,repair:0,verifier:0,extraSamples:0}}}
 const g=await build({entryPoints:['scripts/real-notice-fact-role-diagnostic.mjs','scripts/real-notice-fact-role-host.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(g.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json','cloudflare/recognition-contract.generated.mjs'])].sort()
 artifacts['MANIFEST.json']={version:'real-notice-fact-role-single-arm-freeze-1',batch:BATCH,count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
 return artifacts
}
export function verifyFactRole({observedReadOnly=false}={}){
 const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&!m.dispatchAuthorized&&ids.status==='NOT_RUN'&&!ids.dispatchAuthorized,'SCOPE')
 for(const f of m.components){check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path);if(!observedReadOnly)check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 check(ids.requests.length===COUNT&&sources.length===4,'COUNT')
 for(const [i,u]of ids.requests.entries()){
  const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u,s=sources.find(s=>s.sourceId===u.sourceId)
  check(i+1===u.ordinal&&u.batch===BATCH&&s&&sha(s.sourceText)===u.sourceSha256&&!dispatchAuthorized&&status==='NOT_RUN'&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY')
  check(body.model==='deepseek-flash'&&body.temperature===0&&body.reasoning.effort==='none'&&!body.stream&&body.max_output_tokens===8192,'PARAMETERS')
  check(u.referenceSha256===sha(readFileSync(join(ROOT,'REFERENCES.json')))&&u.referenceTime===s.referenceTime&&u.timezone===s.timezone,'REFERENCE')
 }
 check(new Set(ids.requests.map(u=>u.unitIdentitySha256)).size===COUNT,'UNIQUE')
 return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,...rest]=process.argv.slice(2);check(!rest.length,'ARGS')
 if(mode==='--write'){
  check(execFileSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim().split(/\r?\n/u).filter(Boolean).every(l=>l==='?? CODEX_DESKTOP_HANDOVER.md'),'COMMITTED_CODE_REQUIRED')
  const a=await makeFactRolePacket();mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(a)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}
 }else check(mode==='--verify','MODE')
 const p=verifyFactRole();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))
}
