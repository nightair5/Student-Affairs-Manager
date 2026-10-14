// Thin batch binding; the existing once-send engine and ordinary product remain authoritative.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {ROOT as PARENT,sha,json} from './current-role-diagnostic.mjs'
export {sha,json}
export const ROOT=PARENT+'/fact-role-comparison',BATCH='TASK-REQUIREMENTS-FACT-ROLE-DEVELOPMENT-20261009-R1',COUNT=8
export const PACKAGE_ROOT=resolve('.data/autonomous-fact-role-20261009'),EXECUTION_ROOT=resolve(PACKAGE_ROOT,'execution-fact-role')
const check=(v,c)=>{if(!v)throw Error('FACT_ROLE_PACKET_'+c)}
const normalized=b=>sha(b.toString('utf8').replace(/\r\n/gu,'\n'))
export async function factRoleComponents(){
 const b=await build({stdin:{contents:`export * from './src/recognition/factRoleContract';export * from './src/recognition/taskRequirementsContract';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
export const sourceSpecifications=[
 {sourceId:'FR-01',sourceText:'请在2026年12月3日15:00前完成实验仪器借用登记。登记时须填写学号和联系电话；校外使用者还须填写接收实验室。登记提交后，请于2026年12月4日10:00到器材室领取借用卡。',minimumFacts:{tasks:['完成实验仪器借用登记','领取借用卡'],requirements:['登记填写学号和联系电话','校外使用者填写接收实验室'],time:[{owner:'实验仪器借用登记',role:'task_deadline',value:'2026-12-03T15:00'},{owner:'借用卡',role:'task_action_time',value:'2026-12-04T10:00'}],materials:[],events:[],prerequisite:'领取须等待登记提交，未说明完成状态保持unknown',location:'器材室'}},
 {sourceId:'FR-02',sourceText:'请于2026年12月8日14:30到行政楼B105领取预约单。领取后，请在2026年12月9日17:00前提交实习证明。实习证明须为PDF，文件名为学号-姓名。',minimumFacts:{tasks:['领取预约单','提交实习证明'],requirements:['PDF','文件名学号-姓名'],time:[{owner:'预约单',role:'task_action_time',value:'2026-12-08T14:30'},{owner:'实习证明',role:'submission_deadline',value:'2026-12-09T17:00'}],materials:[{name:'实习证明',owner:'提交实习证明',format:'PDF',filename:'学号-姓名'}],events:[],prerequisite:'提交等待领取，未说明完成状态unknown',location:'行政楼B105'}},
 {sourceId:'FR-03',sourceText:'本次写作工作坊将在周六上午举行，结束时刻尚未公布，地点为人文楼A201。有意参加者可在2026年12月10日18:00前通过报名二维码报名写作工作坊。报名时须填写年级；需要借用设备者还须填写设备型号。获得录取后需准备笔记本电脑，是否录取尚未通知。',minimumFacts:{tasks:['可选报名写作工作坊','录取后准备笔记本电脑'],requirements:['报名填写年级','需要借用设备者填写设备型号'],time:[{owner:'写作工作坊',role:'event_start',raw:'周六上午',value:null,precision:'vague'},{owner:'写作工作坊',role:'event_end',raw:'结束时刻尚未公布',value:null},{owner:'报名写作工作坊',role:'registration_deadline',value:'2026-12-10T18:00'}],events:[{title:'写作工作坊',location:'人文楼A201'}],materials:[{name:'笔记本电脑',owner:'准备笔记本电脑'}],qualification:'准备设备的录取资格unknown，不当报名完成状态',channel:'报名二维码'}},
 {sourceId:'FR-04',sourceText:'请在2026年12月15日16:00前将课程报告提交至教学邮箱。课程报告须为PDF，文件名为班级-学号；收到确认邮件才算提交完成。',minimumFacts:{tasks:['提交课程报告'],time:[{owner:'课程报告',role:'submission_deadline',value:'2026-12-15T16:00'}],materials:[{name:'课程报告',owner:'提交课程报告',format:'PDF',filename:'班级-学号',channel:'教学邮箱'}],requirements:['收到确认邮件才算提交完成'],events:[]}},
]
export async function makeFactRolePacket(){
 const x=await factRoleComponents(),sources=sourceSpecifications.map(s=>({...s,sourceVersionId:s.sourceId+'-v1',sourceSha256:sha(s.sourceText),referenceTime:'2026-12-01T09:00:00+08:00',timezone:'Asia/Shanghai',role:'AUTHOR_ANONYMOUS_DEVELOPMENT_NOT_HOLDOUT',disputes:[]}))
 const references={version:'source-fact-role-adjudication-1.0.0',truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',sources:sources.map(s=>({sourceId:s.sourceId,minimumFacts:s.minimumFacts,disputes:s.disputes})),rule:'Source-first complete minimum obligations. Equivalent closed naming, order and lossless date spans allowed; wrong value/type/owner/relationship, material role, omission or unsupported added obligation fail. Raw facts and frozen common first-display separate. Explicit unknown may be correct. Titles/free prose/leakage unreviewed NOT_ADJUDICATED. Failure/unknown remains each-arm denominator4. No user correction credited.'}
 const requests=[]
 for(const [i,s]of sources.entries())for(const candidate of i%2===0?['TaskRequirements','FactRoleAuthority']:['FactRoleAuthority','TaskRequirements']){
  const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},r=await(candidate==='TaskRequirements'?x.buildTaskRequirementsRequest(context):x.buildFactRoleRequest(context)),body={...r.body,model:'deepseek-flash'}
  const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,candidate,candidateVersion:r.candidateVersion,promptVersion:r.promptVersion,generationContract:r.componentVersion,requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(references)),model:'deepseek-flash',scorer:references.version,referenceTime:s.referenceTime,timezone:s.timezone}
  check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
  requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,status:'NOT_RUN',dispatchAuthorized:false})
 }
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':references,'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,count:COUNT,purpose:'Test entity-owned presence and explicit source appointment roles versus the latest TaskRequirements input',hypothesis:'One entity/owner authority reduces duplicate presence contradictions and appointment-as-deadline errors without losing actual materials, independent duties or unknown endpoints.',denominatorPerArm:4,order:'AB/BA/AB/BA',commonRules:'Same committed public converter, source references and ordinary first display. Generator schema/field instructions differ as one package; no Prompt-only causal attribution.',seen:'Author anonymous Development; new outputs unavailable at freeze, same broad scenarios intentionally developed. Neither Holdout nor independent human truth.',conclusions:['WHOLE_NET_GAIN_NO_NEW_CRITICAL_RISK','TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN','MIXED_PROGRESS','NO_BENEFIT','EVIDENCE_INCOMPLETE'],extras:{retry:0,repair:0,verifier:0,extraSamples:0}}}
 const g=await build({entryPoints:['scripts/fact-role-diagnostic.mjs','scripts/fact-role-host.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(g.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json','cloudflare/recognition-contract.generated.mjs'])].sort()
 artifacts['MANIFEST.json']={version:'fact-role-paired-freeze-1',batch:BATCH,count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
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
