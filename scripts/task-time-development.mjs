// Thin Development packet binding. All sending stays in the existing scoped engine.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
export const ROOT='docs/recognition-optimization/p1-first-pass-convergence'
export const PACKAGE_ROOT=resolve('.data/p1-time-provider-20261013')
export const EXECUTION_ROOT=join(PACKAGE_ROOT,'execution-time')
export const BATCH='TASK-TIME-AUTHORITY-DEVELOPMENT-20261013-R1',COUNT=6
export const sha=v=>createHash('sha256').update(v).digest('hex')
const json=v=>JSON.stringify(v,null,2)+'\n',check=(v,c)=>{if(!v)throw Error('TASK_TIME_PACKET_'+c)}
const normalized=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n'))
const git=a=>execFileSync('git',a,{encoding:'utf8',maxBuffer:32*1024*1024}).trim()
export async function taskTimeComponents(){
 const r=await build({stdin:{contents:"export * from './src/recognition/taskTimeAuthorityContract';export * from './src/recognition/factRoleContract';export * from './src/recognition/currentFactRoleProduct';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';export {assembleCurrentFirstSuggestion} from './src/recognition/materialChannelGrounding';export {sourceWindowsFromSidecar} from './src/recognition/sourceWindowGrounding';export {sourceActionTimesFromSidecar} from './src/recognition/sourceActionTime';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'))
}
const sources=[
 {sourceId:'TT-01',sourceVersionId:'TT-01-v1',sourceText:'请向学业系统提交课程报告PDF，电子提交截止时间为2026年11月5日18:20。纸质课程报告的办理时间为2026年11月9-10日，每天上午9:00-11:30、下午14:30-17:30；请在上述时间内到学习中心B305窗口提交纸质课程报告。电子和纸质报告均需提交，不另设报名。',minimumFacts:{tasks:['向学业系统提交课程报告PDF','提交纸质课程报告'],deadline:{object:'课程报告PDF',role:'submission_deadline',raw:'2026年11月5日18:20',value:'2026-11-05T18:20',precision:'exact'},window:{object:'纸质课程报告',dates:['2026-11-09','2026-11-10'],sessions:[['09:00','11:30'],['14:30','17:30']],intervalCount:4},materials:['课程报告PDF','纸质课程报告'],events:[],eligibility:'not_applicable',forbidden:['报名待办','跨夜连续办理','纸质办理截止替代电子提交截止']}},
 {sourceId:'TT-02',sourceVersionId:'TT-02-v1',sourceText:'校园插画展报名截止为2026年11月6日，有意参展的同学可提交报名表。已报名者须通过作品系统上传插画PDF，提交截止时间为2026年11月12日17:40。报名表与插画是两种对象；报名者个人状态未提供。现场办理插画纸质版的窗口为2026年11月13日9:15-10:45和15:10-16:40，请在这些时段提交插画纸质版。',minimumFacts:{tasks:['提交报名表','上传插画PDF','提交插画纸质版'],deadlines:[{object:'报名表',role:'registration_deadline',date:'2026-11-06'},{object:'插画PDF',role:'submission_deadline',value:'2026-11-12T17:40'}],window:{object:'插画纸质版',dates:['2026-11-13'],sessions:[['09:15','10:45'],['15:10','16:40']],intervalCount:2},materials:['报名表','插画PDF','插画纸质版'],events:[],condition:'已报名者资格unknown，不声明已完成报名',forbidden:['两对象deadline混挂','资格unknown改true','将两时段并成连续窗口']}},
 {sourceId:'TT-03',sourceVersionId:'TT-03-v1',sourceText:'图书查询系统将在2026年11月8日14:00至15:00维护。已借图书记录不受影响，无需重新登记，也不要提交材料。本通知仅供了解。',minimumFacts:{tasks:[],event:'图书查询系统维护',start:'2026-11-08T14:00',end:'2026-11-08T15:00',materials:[],information:['已借图书记录不受影响'],forbidden:['重新登记待办','提交材料待办','维护变任务截止']}},
].map(s=>({...s,sourceSha256:sha(s.sourceText),referenceTime:'2026-10-13T15:00:00+08:00',timezone:'Asia/Shanghai',role:'AUTHOR_ANONYMOUS_DEVELOPMENT_NOT_HOLDOUT',seen:'New authored wording before first model output; mechanism examples checked separately'}))
export async function writeTaskTimePacket(){
 const api=await taskTimeComponents(),references={version:'task-time-minimum-facts-provisional-1',truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',sources:sources.map(s=>({sourceId:s.sourceId,minimumFacts:s.minimumFacts})),rules:'Source-first minimal obligations and user-visible facts. Equivalent closed wording/order and supported split/merge allowed. Wrong values/type/object/owner, omissions and unsupported additions fail. Explicit unknown may be correct; before-day boundary and any unresolved obligation remain unknown. Review raw facts, common first display and free prose separately. All three sources per arm remain denominator; no repair/retry/verifier.'}
 const refSha=sha(json(references)),requests=[],indexedSources=new Map()
 for(const [i,s]of sources.entries())for(const candidate of (i%2?['TaskTimeAuthority','FactRoleAuthority']:['FactRoleAuthority','TaskTimeAuthority'])){
  const context={index:await api.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone}
  indexedSources.set(s.sourceId,{...s,scopes:context.index.scopes})
  const r=await(candidate==='FactRoleAuthority'?api.buildFactRoleRequest(context):api.buildTaskTimeAuthorityRequest(context)),body={...r.body,model:'deepseek-flash'}
  const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,candidate,candidateVersion:r.candidateVersion,promptVersion:r.promptVersion,generationContract:r.componentVersion,requestSha256:sha(JSON.stringify(body)),referenceSha256:refSha,model:'deepseek-flash',scorer:references.version,referenceTime:s.referenceTime,timezone:s.timezone}
  check(!/\bexpected\b/iu.test(JSON.stringify(body)),'REFERENCE_LEAK')
  requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,status:'NOT_RUN',dispatchAuthorized:false})
 }
 const artifacts={'TIME_SOURCES.json':{sources:[...indexedSources.values()]},'TIME_REFERENCES.json':references,'TIME_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'TIME_PRE_REGISTRATION.json':{batch:BATCH,count:COUNT,denominatorPerArm:3,purpose:'Task-owned time roles and explicit discrete windows, Development not Holdout',hypothesis:'Grouping time facts under their actual task owner and declaring availability dates/sessions once reduces role/owner mistakes and lost discrete windows without inventing user eligibility or facts.',order:'AB/BA/AB',commonRules:'Same current declared-support converter, time policy, first-page assembler and source-first provisional review. New typed time declaration expansion is part of the tested generation/compilation mechanism, not Prompt-only attribution.',conclusions:['WHOLE_NET_GAIN_NO_NEW_CRITICAL_RISK','TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN','MIXED_PROGRESS','NO_BENEFIT','EVIDENCE_INCOMPLETE'],retry:0,repair:0,verifier:0}}
 const graph=await build({entryPoints:['scripts/task-time-development.mjs','scripts/task-time-development-host.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(graph.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json'])].sort()
 artifacts['TIME_MANIFEST.json']={version:'task-time-development-freeze-1',batch:BATCH,count:COUNT,generationCommit:git(['rev-parse','HEAD']),components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
 for(const[path,v]of Object.entries(artifacts)){check(!existsSync(join(ROOT,path)),'ALREADY_FROZEN');writeFileSync(join(ROOT,path),json(v),{flag:'wx'})}
 return verifyTaskTimePacket()
}
export function verifyTaskTimePacket({observedReadOnly=false}={}){
 const m=JSON.parse(readFileSync(join(ROOT,'TIME_MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'TIME_IDENTITIES.json'))),ss=JSON.parse(readFileSync(join(ROOT,'TIME_SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&ids.status==='NOT_RUN'&&!ids.dispatchAuthorized&&ids.requests.length===COUNT,'SCOPE')
 for(const f of m.components){check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path);if(!observedReadOnly)check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 const ref=sha(readFileSync(join(ROOT,'TIME_REFERENCES.json')))
 check(ss.length===3&&ss.every((s,i)=>s.sourceId===sources[i].sourceId&&s.sourceText===sources[i].sourceText&&s.sourceSha256===sha(s.sourceText)),'SOURCE_SET')
 check(ss.every(s=>ids.requests.filter(u=>u.sourceId===s.sourceId).map(u=>u.candidate).sort().join(',')==='FactRoleAuthority,TaskTimeAuthority'),'PAIRED_ARMS')
 for(const[i,u]of ids.requests.entries()){const{body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u,s=ss.find(s=>s.sourceId===u.sourceId)
 check(i+1===u.ordinal&&s&&sha(s.sourceText)===u.sourceSha256&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256&&status==='NOT_RUN'&&!dispatchAuthorized&&u.referenceSha256===ref,'IDENTITY')
 check(body.model==='deepseek-flash'&&body.temperature===0&&body.reasoning.effort==='none'&&!body.stream&&body.max_output_tokens===8192,'PARAMETERS')
 const input=JSON.parse(body.input[1].content[0].text)
 check(u.sourceVersionId===s.sourceVersionId&&u.referenceTime===s.referenceTime&&u.timezone===s.timezone&&input.source===s.sourceText&&input.referenceTime===s.referenceTime&&input.timezone===s.timezone&&Array.isArray(s.scopes)&&new Set(s.scopes.map(q=>q.id)).size===s.scopes.length&&JSON.stringify(input.scopes)===JSON.stringify(s.scopes.map(q=>({id:q.id,text:q.text})))&&s.scopes.every(q=>q.sourceId===s.sourceId&&q.sourceVersionId===s.sourceVersionId&&q.text===s.sourceText.slice(q.start,q.end)),'INPUT_BINDING')}
 return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'TIME_MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'TIME_IDENTITIES.json')))}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const mode=process.argv[2];if(mode==='--write')await writeTaskTimePacket();else check(mode==='--verify','MODE');const p=verifyTaskTimePacket();console.log(json({batch:BATCH,count:p.units.length,snapshot:p.snapshot,...p.binding}))}
