import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {publicNoticeComponents} from './public-notice-components.mjs'
import {PUBLIC_SCORER} from './public-notice-scoring.mjs'
import {currentNoticeMaterialPlan} from './current-notice-reference.mjs'
export const ROOT='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic',BATCH='C19-CURRENT-REAL-NOTICE-DEVELOPMENT-R1',COUNT=4
export const sha=v=>createHash('sha256').update(v).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
const normalized=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n')),check=(v,c)=>{if(!v)throw Error('CURRENT_FREEZE_'+c)}
export async function makeCurrentNoticeDiagnostic(){
 const x=await publicNoticeComponents(),{sources,references,selection}=currentNoticeMaterialPlan(),referenceArtifact={version:PUBLIC_SCORER,references},requests=[]
 for(const [i,s]of sources.entries()){
  const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},req=await x.buildCandidate19Request(context),body={...req.body,model:'deepseek-flash'}
  check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
  check(body.temperature===0&&body.reasoning.effort==='none'&&body.stream===false&&body.max_output_tokens===8192,'PARAMETERS')
  const identity={batch:BATCH,ordinal:i+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,arm:'SINGLE',candidate:'Candidate19',requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(referenceArtifact)),model:'deepseek-flash',scorer:PUBLIC_SCORER,commonLayer:'CURRENT_C19_TIME_2_1_FIRST_1_1_PRODUCT_GRAPH',referenceTime:s.referenceTime,timezone:s.timezone}
  requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})
 }
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':referenceArtifact,'SELECTION.json':selection,'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,design:'CURRENT_C19_SINGLE_ARM_FIRST_OUTPUT_DIAGNOSTIC_NOT_COMPARISON',sourceCount:COUNT,requestCount:COUNT,denominator:'All four fixed excerpts, including transport/parse/schema/reference failures, disagreements and unknowns',candidate:'Candidate19 original prompt/schema unchanged',scorer:PUBLIC_SCORER,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',layers:['modelFirstFacts','displayBeforeHuman','humanFinal'],scope:'SEEN_DEVELOPMENT_EXCERPTS_NOT_HOLDOUT',legalRepresentation:'Equivalent order, names and lossless views/merges are allowed only if all source obligations, values, precision, evidence and owners remain; explicit unknown/unannounced may be correct, unspecified differs from unknown',disputes:'Date-window representation and 日前 boundary are source-first; date_only with preserved raw does not invent end-of-day. Unknown personal interest/qualification is not an extraction failure. Unread QR/pictures and old replacement endpoints are not guessed.',prose:'All user-facing title/description/extras must be explicitly provisionally adjudicated; otherwise whole UNKNOWN',decision:'Report correct/incorrect/UNKNOWN at each layer and source; no winner/improvement claim; at most 2 evidence roots/1 later input hypothesis',extras:{retry:0,repair:0,verifier:0,extraSamples:0},dispatchAuthorized:false}}
 const graph=await build({entryPoints:['scripts/prepare-current-notice-diagnostic.mjs','scripts/current-notice-execution-host.mjs','scripts/current-notice-recorded-readonly.mjs','scripts/report-current-notice-diagnostic.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/realInput01/candidate19.ts','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,packages:'external',write:false,metafile:true,outdir:'memory',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(graph.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json'])].sort()
 artifacts['MANIFEST.json']={version:'current-real-notice-freeze-1',batch:BATCH,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,componentHashMode:'SHA256_UTF8_CRLF_TO_LF_NO_OTHER_NORMALIZATION',components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,value])=>({path,sha256:sha(json(value))})),upstreamMaterials:{sourcePath:'docs/recognition-optimization/candidate19-public-development/current-notice-mainline/SOURCES.json',sourceSha256:selection.materialSha256,provenancePath:'docs/recognition-optimization/candidate19-public-development/current-notice-mainline/PROVENANCE.json',provenanceSha256:selection.provenanceSha256}}
 return artifacts
}
export function verifyCurrentNoticeDiagnostic(){
 const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&m.status==='NOT_RUN'&&m.dispatchAuthorized===false,'SCOPE')
 for(const f of m.components){check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path);check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 const u=m.upstreamMaterials;check(sha(readFileSync(u.sourcePath))===u.sourceSha256&&sha(readFileSync(u.provenancePath))===u.provenanceSha256,'MATERIAL_PROVENANCE')
 check(ids.requests.length===COUNT&&sources.length===COUNT&&new Set(sources.map(s=>s.sourceId)).size===COUNT&&ids.status==='NOT_RUN'&&ids.dispatchAuthorized===false,'COUNT')
 for(const [i,u]of ids.requests.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u,s=sources[i];check(i+1===u.ordinal&&u.batch===BATCH&&u.sourceId===s.sourceId&&u.sourceSha256===sha(s.sourceText)&&status==='NOT_RUN'&&dispatchAuthorized===false&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY');check(u.referenceSha256===sha(readFileSync(join(ROOT,'REFERENCES.json')))&&u.referenceTime===s.referenceTime&&u.timezone===s.timezone,'SOURCE_REFERENCE');check(body.model==='deepseek-flash'&&body.temperature===0&&body.reasoning.effort==='none'&&body.stream===false&&body.max_output_tokens===8192,'PARAMETERS')}
 check(new Set(ids.requests.map(u=>u.requestSha256)).size===COUNT&&new Set(ids.requests.map(u=>u.unitIdentitySha256)).size===COUNT,'UNIQUE')
 return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 check(process.argv.length===3,'MODE_OR_EXTRA_ARGUMENTS')
 if(process.argv[2]==='--write'){check(!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'CLEAN_COMMITTED_CODE_REQUIRED');const a=await makeCurrentNoticeDiagnostic();mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(a)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}const p=verifyCurrentNoticeDiagnostic();console.log(json({status:'FROZEN_NOT_RUN',snapshot:p.snapshot,count:p.units.length,...p.binding}))}
 else if(process.argv[2]==='--verify'){const p=verifyCurrentNoticeDiagnostic();console.log(json({status:'FROZEN_NOT_RUN',snapshot:p.snapshot,count:p.units.length,...p.binding}))}
 else throw Error('CURRENT_MODE_REQUIRED')
}
