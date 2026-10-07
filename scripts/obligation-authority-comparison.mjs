// New input hypothesis only. No transport, environment/Secret or ledger mutation.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {scorePublicNotice} from './public-notice-scoring.mjs'
export const ROOT='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/obligation-authority/comparison'
export const BATCH='V5-OBLIGATION-AUTHORITY-DEVELOPMENT-R1',COUNT=8,SCORER='obligation-authority-paired-source-facts-1.0.0'
export const sha=v=>createHash('sha256').update(v).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
const normalized=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n')),check=(v,c)=>{if(!v)throw Error('OBLIGATION_FREEZE_'+c)}
// Source-first minimum facts, deliberately separate from engineer-authored wire fixtures.
export const NOTICE_ROWS=[
 ['OA-01','若已取得声景训练营录取资格，需先检查麦克风。检查完成后安装声景训练营会议客户端。声景训练营于2026年12月7日09:20开始，结束时间尚未公布。',[
  ['obligations','检查麦克风、安装声景训练营会议客户端两个义务，不吞成附注；录取资格unknown，不写已取得'],
  ['prerequisite','安装前置检查完成，原文未说明个人完成状态；等待而非直接可开始，不把资格当完成'],
  ['events','1独立声景训练营；两个义务与该活动的真实关系按原文依据裁决，不猜额外活动'],
  ['time','活动开始2026-12-07T09:20 exact；结束null，certainty=unannounced，现行canonical precision=vague；保留结束时间尚未公布；任务没有deadline'],
  ['graph','所有present有真实事实/owner/关联；未知资格与前置完成分别保留'],
  ['prose','全部标题、描述、属性、额外实体、覆盖和关系逐项暂定裁决；未决或无据新增不满分']]],
 ['OA-02','请在2026年12月1日08:30至12月3日16:45的开放时段创建图书馆预约账号并验证校园邮箱。两项操作均在该开放时段办理。本通知未设截止时间。',[
  ['obligations','创建图书馆预约账号、验证校园邮箱两个义务；无显式依赖，不创造先后'],
  ['time','两项办理窗口开始2026-12-01T08:30、结束2026-12-03T16:45 exact；不是deadline或planned_start'],
  ['graph','两个动作均有窗口owner；可用共享或无损同值独立时间表示，不得遗漏其中一个owner'],
  ['events','0独立事件，不把开放窗口冒充活动；明确无deadline保留'],
  ['prose','全部动作对象、标题、描述、覆盖和额外字段暂定裁决；不猜具体办理计划']]],
 ['OA-03','请于2026年12月4日12:10前报名摄影交流会。摄影交流会于2026年12月6日14:30开始，16:00结束。另有器材服务周六晚维护，维护结束尚未公布。维护仅供了解，不要求登记。',[
  ['obligations','只有报名摄影交流会1个义务；维护不是登记待办'],
  ['events','摄影交流会与器材服务维护两个独立事件，名称、属性不混'],
  ['time','报名deadline 2026-12-04T12:10；交流会开始2026-12-06T14:30结束16:00 exact；维护开始周六晚null vague、结束尚未公布null，certainty=unannounced，现行canonical precision=vague'],
  ['graph','报名关联摄影交流会，不接维护；各事件起止owner一致，不能因同来源自动相连'],
  ['prose','维护信息、无登记、所有标题描述及额外事实逐项暂定裁决；模糊null不是遗漏']]],
 ['OA-04','请于2026年12月8日15:40前将器材借用申请提交至资料接收室。申请需为PDF，文件名使用班级和姓名。收到受理编号才算提交办结。这份通知未安排活动。',[
  ['obligations','提交器材借用申请1任务；收到受理编号是完成标准，不造第二动作'],
  ['materials','申请材料PDF、文件名班级和姓名、明确目的地资料接收室、办结标准受理编号完整保留；陌生目的地有据不清空'],
  ['time','任务deadline 2026-12-08T15:40 exact；不与个人安排混淆'],
  ['graph','材料和截止owner为提交申请；无独立活动，不能制造event present'],
  ['prose','所有标题、描述、对象、附注和额外事实逐项暂定裁决；未知和争议不满分']]],
]
export async function obligationComponents(){
 const b=await build({stdin:{contents:`export * from './src/recognition/sourceContractV5';export * from './src/recognition/sourceContractV6';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
export async function makeObligationComparison(){
 const x=await obligationComponents(),sources=NOTICE_ROWS.map(([id,sourceText])=>({sourceId:'obligation-development-'+id,sourceVersionId:'obligation-development-'+id+'-v1',sourceText,sourceSha256:sha(sourceText),referenceTime:'2026-10-07T09:00:00+08:00',timezone:'Asia/Shanghai',provenance:'SINGLE_AUTHOR_ANONYMOUS_DEVELOPMENT_NOT_REAL_NOTICE_NOT_HOLDOUT'}))
 const references=NOTICE_ROWS.map(([id,,assertions])=>({sourceId:'obligation-development-'+id,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',assertions:assertions.map(([id,description])=>({id,description,critical:id!=='prose'})),disputes:['标题/自由描述/教学泄漏未独立裁决NOT_ADJUDICATED；原文全义务、所有额外实体及描述必须逐项核，不能仅检查结构','明确未公布null可正确；日前边界/完整条件拆分未决不填满分；命名/顺序及无损格式同义允许，错对象/日期/类型/依据/关系拒绝']}))
 const ref={version:SCORER,references},requests=[]
 for(const [i,s]of sources.entries()){
  const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},order=i%2?['ObligationAuthority','SingleAuthority']:['SingleAuthority','ObligationAuthority']
  for(const candidate of order){const req=await(candidate==='SingleAuthority'?x.buildSingleAuthorityRequest(context):x.buildObligationAuthorityRequest(context)),body={...req.body,model:'deepseek-flash'}
   check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
   const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,arm:candidate==='SingleAuthority'?'BASELINE':'NEW',candidate,candidateVersion:candidate==='SingleAuthority'?x.SINGLE_AUTHORITY_CANDIDATE_VERSION:x.OBLIGATION_CANDIDATE_VERSION,promptVersion:candidate==='SingleAuthority'?x.SINGLE_AUTHORITY_PROMPT_VERSION:x.OBLIGATION_PROMPT_VERSION,generationContract:candidate==='SingleAuthority'?x.SINGLE_AUTHORITY_VERSION:x.OBLIGATION_AUTHORITY_VERSION,requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(ref)),model:'deepseek-flash',scorer:SCORER,commonLayer:'SAME_CURRENT_PUBLIC_CONVERSION_FIRST_DISPLAY_EVENT_TASK_RELATION_AND_ORDINARY_COMMIT',referenceTime:s.referenceTime,timezone:s.timezone}
   requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})
  }
 }
 const old=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/SOURCES.json')).sources
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':ref,'SELECTION.json':{sourceCount:4,requestCount:COUNT,order:'2AB/2BA',cells:['independent equipment obligation + qualification + predecessor','two actions shared window owners','registration link + separate no-task maintenance','ordinary material destination/completion/deadline control'],rationale:'One source per three required generation-risk cells plus one ordinary regression control. All old four already-seen official excerpts remain regression only; no third arm or larger template set.',exactOverlapOldSources:sources.filter(s=>old.some(o=>o.sourceText===s.sourceText)).map(s=>s.sourceId),teachingExamples:'New wording/objects/dates; conceptual overlap deliberate. These authored Development notices are not official actual notices, independent Holdout or evidence of generalization.'},'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,version:SCORER,hypothesis:'Obligations-first action/object/applicability/predecessor plus one authoritative task.eventLinks declaration reduces actions swallowed by event attributes and present without owners/links, without critical omissions or unsupported additions.',changedComponents:['ordered V6 schema and field descriptions','generation instructions','V6 strict shape and explicit link inversion; original V5 untouched'],commonComponents:'Both arms use same frozen support/context/endpoint/attribute/time/channel/eligibility/nonaction/first-display rules and ordinary event-task commit. V6->V5 inverse is generation bundle; do not attribute whole-bundle effects only to prompt.',denominator:'4 sources per arm, all 8 identity outcomes retained including failures/unknown/disputes',layers:['modelFirstFacts','displayBeforeHuman','humanFinal'],truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',adjudication:'Use source-first assertions, verdict/reason/outputPointer per layer; any real factual error makes whole incorrect. Incomplete/disputed/unadjudicated prose remains UNKNOWN. Compiler refusal is first-display failure, not proof raw had no facts. No user correction counted as first correct.',criticalRisks:['key obligation/event/endpoint omission','unsupported task','wrong time/value/type/owner','false qualification/completion','bad dependency/activity/revision relation'],conclusions:['WHOLE_NET_GAIN_NO_NEW_CRITICAL_RISK','TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN','MIXED_PROGRESS','NO_BENEFIT','EVIDENCE_INCOMPLETE'],selection:'Definite execution + consistent ledger before comparison; all registered fact layers accounted. Net whole counts and target errors separate; new critical risk cannot be cancelled by score; no net+2 or 100% gate. Incomplete/uncertain means no winner.',dispatchAuthorized:false,extras:{retry:0,repair:0,verifier:0,extraSamples:0}}}
 const g=await build({entryPoints:['scripts/obligation-authority-comparison.mjs','scripts/obligation-authority-execution-host.mjs','scripts/obligation-authority-recorded-readonly.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(g.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json','cloudflare/recognition-contract.generated.mjs'])].sort()
 artifacts['MANIFEST.json']={version:'obligation-authority-comparison-freeze-1',batch:BATCH,count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
 return artifacts
}
export function verifyObligationComparison({observedReadOnly=false}={}){
 const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&m.status==='NOT_RUN'&&!m.dispatchAuthorized&&ids.status==='NOT_RUN'&&!ids.dispatchAuthorized,'SCOPE')
 for(const f of m.components){check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path);if(!observedReadOnly)check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 check(ids.requests.length===COUNT&&sources.length===4,'COUNT')
 for(const [i,u]of ids.requests.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u,s=sources.find(s=>s.sourceId===u.sourceId);check(i+1===u.ordinal&&u.batch===BATCH&&s&&sha(s.sourceText)===u.sourceSha256&&!dispatchAuthorized&&status==='NOT_RUN'&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY');check(body.model==='deepseek-flash'&&body.temperature===0&&body.reasoning.effort==='none'&&!body.stream&&body.max_output_tokens===8192&&!/\bexpected\b/iu.test(JSON.stringify(body)),'PARAMETERS');check(u.referenceSha256===sha(readFileSync(join(ROOT,'REFERENCES.json')))&&u.referenceTime===s.referenceTime&&u.timezone===s.timezone,'REFERENCE')}
 check(new Set(ids.requests.map(u=>u.unitIdentitySha256)).size===COUNT,'UNIQUE')
 return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
}
export function reportObligationFacts(references,records=[]){
 const cases=['SingleAuthority','ObligationAuthority'].flatMap(candidate=>references.map(ref=>{const r=records.filter(r=>r.sourceId===ref.sourceId&&r.candidate===candidate);return {candidate,sourceId:ref.sourceId,...scorePublicNotice(ref,r.length===1?r[0]:undefined)}}))
 return {version:SCORER,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',cases,summary:Object.fromEntries(['SingleAuthority','ObligationAuthority'].map(c=>[c,Object.fromEntries(['modelFirstFacts','displayBeforeHuman','humanFinal'].map(l=>[l,{correct:cases.filter(r=>r.candidate===c&&r.stages[l].complete===true).length,incorrect:cases.filter(r=>r.candidate===c&&r.stages[l].complete===false).length,unknown:cases.filter(r=>r.candidate===c&&r.stages[l].complete==='UNKNOWN').length,denominator:references.length}]))])),selection:'EVIDENCE_INCOMPLETE_UNLESS_EXECUTION_AND_ALL_ADJUDICATION_DEFINITE'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,...extra]=process.argv.slice(2);check(!extra.length,'EXTRA_ARGUMENTS')
 if(mode==='--write'){
  check(execFileSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim().split(/\r?\n/u).filter(Boolean).every(l=>l==='?? CODEX_DESKTOP_HANDOVER.md'),'COMMITTED_CODE_REQUIRED')
  const a=await makeObligationComparison();mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(a)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}
  const p=verifyObligationComparison();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))
 }else if(mode==='--verify'){const p=verifyObligationComparison();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))}
 else if(mode==='--report'){verifyObligationComparison({observedReadOnly:true});const refs=JSON.parse(readFileSync(join(ROOT,'REFERENCES.json'))).references,p=resolve('.data/obligation-authority/execution/ADJUDICATION.json');console.log(json(reportObligationFacts(refs,existsSync(p)?JSON.parse(readFileSync(p)).records:[])))}
 else throw Error('OBLIGATION_FREEZE_MODE_REQUIRED')
}
