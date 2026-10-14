import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {publicNoticeComponents} from './public-notice-components.mjs'
import {PUBLIC_SCORER} from './public-notice-scoring.mjs'
export const ROOT='docs/recognition-optimization/candidate19-public-development',BATCH='C19-PUBLIC-DEVELOPMENT-R1',COUNT=4
export const sha=v=>createHash('sha256').update(v).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
const normalized=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n')),check=(v,c)=>{if(!v)throw Error('PUBLIC_FREEZE_'+c)}
export async function makePublicDiagnostic(){
  const x=await publicNoticeComponents(),sources=x.PUBLIC_NOTICE_SOURCES.map(s=>({sourceId:s.id,sourceVersionId:s.id+'-v1',title:s.title,sourceText:s.text,sourceSha256:sha(s.text),url:s.url,published:s.published,referenceTime:s.published+'T09:00:00+08:00',timezone:'Asia/Shanghai',role:'PUBLIC_OPERATIONAL_EXCERPT_DEVELOPMENT_NOT_HOLDOUT'}))
  const references=x.PUBLIC_NOTICE_SOURCES.map(s=>({sourceId:s.id,sourceSha256:sha(s.text),truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',assertions:[...s.facts,'所有标题/描述、额外任务/事件/时间/材料、证据和双向图均逐事实裁决；无据新增不能抵消'].map((statement,i)=>({id:s.id+'-F'+(i+1),statement})),unresolved:s.unresolved,adjudication:'Source-grounded provisional fact decisions with output pointers, per model-first/display-before-human/human-final; absent/ambiguous -> UNKNOWN'}))
  const requests=[]
  for(const [i,s]of sources.entries()){
    const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},req=await x.buildCandidate19Request(context),body={...req.body,model:'deepseek-flash'}
    check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
    check(body.temperature===0&&body.reasoning.effort==='none'&&body.stream===false&&body.max_output_tokens===8192,'PARAMETERS')
    const identity={batch:BATCH,ordinal:i+1,sourceId:s.sourceId,sourceSha256:s.sourceSha256,arm:'SINGLE',candidate:'Candidate19',requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json({references})),model:'deepseek-flash',scorer:PUBLIC_SCORER,commonLayer:'CHANNEL_GROUNDING_1_3_PUBLIC_CURRENT'}
    requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})
  }
  const artifacts={'SOURCES.json':{sources},'REFERENCES.json':{version:PUBLIC_SCORER,references},'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,design:'CURRENT_C19_SINGLE_ARM_DIAGNOSTIC_NOT_IMPROVEMENT_COMPARISON',sources:COUNT,requests:COUNT,denominator:'All four frozen excerpts; not entire webpages, failures/disputes/missing remain',candidate:'Candidate19 original prompt/schema bytes unchanged',scorer:PUBLIC_SCORER,referenceTruth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',layers:['modelFirstFacts','displayBeforeHuman','humanFinal'],decision:'Report correct/incorrect/UNKNOWN per layer; no relative winner, no generalization/human-saving inference',prose:'Final required assertion includes all title/description/extras/graph; unadjudicated cannot be whole-correct',legalViews:'Order/synonyms/lossless task merge or material views accepted only if all source obligations, objects, values, precision, evidence and edges preserved; wrong owner/value/type, omission, contradiction or unsupported obligation rejected',extras:{retry:0,repair:0,verifier:0,extraSamples:0},dispatchAuthorized:false}}
  const graph=await build({entryPoints:['scripts/prepare-public-notice-diagnostic.mjs','scripts/public-notice-execution-host.mjs','scripts/public-notice-scoring.mjs','src/experiments/candidate19Recorded/publicNotices.ts','src/experiments/realInput01/candidate19.ts','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,packages:'external',write:false,metafile:true,outdir:'memory',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
  const paths=[...new Set([...Object.keys(graph.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json'])].sort()
  artifacts['MANIFEST.json']={version:'public-c19-freeze-1',batch:BATCH,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,componentHashMode:'SHA256_UTF8_CRLF_TO_LF_NO_OTHER_NORMALIZATION',components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:[...Object.entries(artifacts).map(([path,value])=>({path,sha256:sha(json(value))})),...['PROVENANCE.json','OVERLAP_CHECK.json'].map(path=>({path,sha256:sha(readFileSync(join(ROOT,path)))}))]}
  return artifacts
}
export function verifyPublicDiagnostic(){
  const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))
  check(m.batch===BATCH&&m.count===COUNT&&m.status==='NOT_RUN'&&m.dispatchAuthorized===false,'SCOPE')
  for(const f of m.components){check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path);check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path)}
  for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
  check(ids.requests.length===COUNT&&ids.status==='NOT_RUN'&&ids.dispatchAuthorized===false,'COUNT')
  for(const [i,u]of ids.requests.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u;check(i+1===u.ordinal&&status==='NOT_RUN'&&dispatchAuthorized===false&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY')}
  return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]==='--write'){check(!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'CLEAN_COMMITTED_CODE_REQUIRED');const artifacts=await makePublicDiagnostic();mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(artifacts)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}const p=verifyPublicDiagnostic();console.log(json({status:'FROZEN_NOT_RUN',snapshot:p.snapshot,count:p.units.length,...p.binding}))}
  else if(process.argv[2]==='--verify'){const p=verifyPublicDiagnostic();console.log(json({status:'FROZEN_NOT_RUN',snapshot:p.snapshot,count:p.units.length,...p.binding}))}
  else throw Error('PUBLIC_MODE_REQUIRED')
}
