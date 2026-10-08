// One independent real-notice Development diagnosis, reusing the existing executor.
import {build} from 'esbuild'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
export const ROOT='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/autonomous-v6'
export const BATCH='V6-CURRENT-REAL-NOTICE-DEVELOPMENT-20261008-R1',COUNT=4
export const sha=v=>createHash('sha256').update(v).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
const origin='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic',check=(v,c)=>{if(!v)throw Error('AUTONOMOUS_V6_'+c)}
const norm=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n'))
export async function freezeV6Notices(){
 check(execFileSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim().split(/\r?\n/u).filter(Boolean).every(l=>l==='?? CODEX_DESKTOP_HANDOVER.md'),'COMMITTED_CODE_REQUIRED')
 const upstreamSources=readFileSync(join(origin,'SOURCES.json')),upstreamRefs=readFileSync(join(origin,'REFERENCES.json'))
 const prior=JSON.parse(upstreamSources).sources,refs=JSON.parse(upstreamRefs).references
 check(prior.length===COUNT&&refs.length===COUNT,'COUNT')
 const bundle=await build({stdin:{contents:`export {buildObligationAuthorityRequest} from './src/recognition/sourceContractV6';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 const x=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
 const sources=prior.map((s,i)=>({...s,sourceId:'V6-REAL-20261008-'+String(i+1).padStart(2,'0'),sourceVersionId:'V6-REAL-20261008-'+String(i+1).padStart(2,'0')+'-v1',originalSourceId:s.sourceId,seenStatus:'SEEN_DEVELOPMENT_C19_AND_V5_AVAILABLE_V6_NOT_RUN',role:'OFFICIAL_EXCERPT_DEVELOPMENT_NOT_HOLDOUT'}))
 const references={version:'v6-real-notice-provisional-1',truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',upstreamSha256:sha(upstreamRefs),references:refs.map((r,i)=>({...r,sourceId:sources[i].sourceId,originalSourceId:r.sourceId}))}
 const requests=[]
 for(const [i,s]of sources.entries()){
  const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},r=await x.buildObligationAuthorityRequest(context),body=r.body
  check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
  const identity={batch:BATCH,ordinal:i+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,arm:'SINGLE',candidate:'ObligationAuthority',candidateVersion:r.candidateVersion,promptVersion:r.promptVersion,generationContract:r.componentVersion,requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(references)),model:'deepseek-flash',scorer:'v6-real-notice-provisional-1',commonLayer:'LOCAL_COVERAGE_1_SHARED_ATTRIBUTE_1_1_CURRENT_COMMON_PRODUCT',referenceTime:s.referenceTime,timezone:s.timezone}
  requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})
 }
 // A new generation contract, never a disguised resend of an uncertain request.
 const sealed=['.data/obligation-authority/execution/STATE.json','.data/single-authority/execution/STATE.json','.data/public-notice/execution/STATE.json'].filter(existsSync).flatMap(p=>JSON.parse(readFileSync(p)).units??[]).filter(u=>u.status==='UNCERTAIN')
 check(requests.every(u=>sealed.every(old=>u.requestSha256!==old.requestSha256&&u.unitIdentitySha256!==old.unitIdentitySha256)),'SEALED_REQUEST_REUSE')
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':references,'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{
  batch:BATCH,design:'CURRENT_V6_SINGLE_ARM_REAL_NOTICE_DIAGNOSIS',count:COUNT,inputMechanismChanged:false,
  hypothesis:'Existing V6 obligations-first and authoritative task.eventLinks should represent device preparation, shared windows and registration links. This is a test of already delivered input, not a proposed V7.',
  selection:'All four previously acquired official full excerpts: shared registration window, ordinary registration control, equipment preparation/admission/activity, split exact activity clock and separate registration deadline. No answer-dependent selection.',
  denominator:'All four fixed identities; failure, unknown, dispute and unadjudicated prose remain. Original raw facts, current first display and human final separate.',
  truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',historicalComparison:'Earlier V5 outputs only descriptive regression; model version/time may differ, no paired causal winner.',
  criticalRisks:['missing obligation','unsupported action','wrong time/value/type/owner','false eligibility or completion','wrong dependency/revision'],
  legalRepresentation:'Lossless decomposition/naming and explicit unannounced null accepted. No guessed owner, QR destination, clock, old endpoint or personal status.',
  selectionRule:['net whole-source gain without new critical risk','target error reduced without whole-source gain','improvement with regression','no benefit','insufficient evidence'],
  noNewOutputWhen:'No justified additional hypothesis. Max two evidence roots and three package iterations.',retry:0,repair:0,verifier:0,dispatchAuthorized:false}}
 const graph=await build({entryPoints:['scripts/autonomous-v6-notice.mjs','scripts/autonomous-v6-host.mjs','scripts/autonomous-v6-readonly.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(graph.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json'])].sort()
 artifacts['MANIFEST.json']={version:'autonomous-v6-real-freeze-1',batch:BATCH,count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),components:paths.map(path=>({path,sha256:norm(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))})),upstream:{sourcePath:join(origin,'SOURCES.json'),sourceSha256:sha(upstreamSources),referencePath:join(origin,'REFERENCES.json'),referenceSha256:sha(upstreamRefs)}}
 mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(artifacts)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}
}
export function verifyV6Notices({observedReadOnly=false}={}){
 const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&!m.dispatchAuthorized&&!ids.dispatchAuthorized&&ids.status==='NOT_RUN','SCOPE')
 for(const f of m.components){check(norm(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'GIT_COMPONENT_'+f.path);if(!observedReadOnly)check(norm(readFileSync(f.path))===f.sha256,'ACTIVE_COMPONENT_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 check(sha(readFileSync(m.upstream.sourcePath))===m.upstream.sourceSha256&&sha(readFileSync(m.upstream.referencePath))===m.upstream.referenceSha256,'UPSTREAM')
 check(ids.requests.length===COUNT&&sources.length===COUNT,'COUNT')
 for(const [i,u]of ids.requests.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u,s=sources[i];check(u.ordinal===i+1&&u.batch===BATCH&&u.sourceId===s.sourceId&&u.sourceVersionId===s.sourceVersionId&&sha(s.sourceText)===u.sourceSha256&&!dispatchAuthorized&&status==='NOT_RUN'&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY');check(body.model==='deepseek-flash'&&body.temperature===0&&body.reasoning.effort==='none'&&!body.stream&&body.max_output_tokens===8192&&u.referenceSha256===sha(readFileSync(join(ROOT,'REFERENCES.json')))&&u.referenceTime===s.referenceTime&&u.timezone===s.timezone,'PARAMETERS')}
 check(new Set(ids.requests.map(u=>u.requestSha256)).size===COUNT&&new Set(ids.requests.map(u=>u.unitIdentitySha256)).size===COUNT,'UNIQUE')
 return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [mode,...extra]=process.argv.slice(2);check(!extra.length,'ARGS');if(mode==='--freeze')await freezeV6Notices();else check(mode==='--verify','MODE');const p=verifyV6Notices();console.log(json({status:'FROZEN_NOT_RUN',count:COUNT,snapshot:p.snapshot,...p.binding}))}
