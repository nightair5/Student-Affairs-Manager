// New input hypothesis only. No transport, environment/Secret or ledger mutation.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {scorePublicNotice} from './public-notice-scoring.mjs'
export const ROOT='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/afternoon-role-comparison'
export const BATCH='V6-ROLE-AUTHORITY-DEVELOPMENT-20261008-R1',COUNT=8,SCORER='role-authority-paired-source-facts-1.0.0'
export const sha=v=>createHash('sha256').update(v).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
const normalized=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n')),check=(v,c)=>{if(!v)throw Error('OBLIGATION_FREEZE_'+c)}
// Source-first minimum facts, deliberately separate from engineer-authored wire fixtures.
export const NOTICE_ROWS=[
 ['RA-01','图像解读交流会面向在读本科生。有意参加者可通过预约二维码报名图像解读交流会，报名截止为2026年12月14日16:20。图像解读交流会于2026年12月16日10:10开始，结束时间尚未公布。',[
  ['action','报名图像解读交流会是optional，二维码是办理方式不是报名对象或必备材料；不得自动默认选中；个人在读本科资格unknown'],
  ['event','一个图像解读交流会，报名关联它，不能另造二维码事件'],
  ['time','报名截止2026-12-14T16:20 exact；活动开始2026-12-16T10:10 exact；结束尚未公布null，精度vague且certainty unannounced，不猜日期'],
  ['graph','真实owner/关联/覆盖完整；兴趣不是资格，报名不是录取'],
  ['prose','全部标题描述与额外事实逐项暂定裁决，未决不满分']]],
 ['RA-02','取得音像研习班录取资格的学员需先测试耳机。测试完成后安装音像研习班会议软件。音像研习班于2026年12月18日13:25开始，14:55结束。原文未说明任何人的录取或测试完成情况。',[
  ['action','测试耳机、安装音像研习班会议软件两个required条件义务；录取资格unknown，不造报名/取得录取动作'],
  ['prerequisite','安装依赖测试耳机完成，完成状态unknown；录取资格不能冒充前置动作完成'],
  ['event','一个音像研习班，义务与活动关联按真实依据；不吞测试为附注'],
  ['time','活动开始2026-12-18T13:25结束2026-12-18T14:55 exact，无任务deadline'],
  ['graph','present实体与单一关联一致，未知不写true或false'],
  ['prose','所有对象、说明、属性与额外事实暂定裁决；未决留分母']]],
 ['RA-03','校园借用系统办理窗口如下：2026年12月20—23日。请在指定时间内激活借用账号并填写借用登记。两项操作均在该办理窗口内完成，不设具体截止时刻，也未要求两项操作按先后顺序。',[
  ['action','激活借用账号、填写借用登记两个required任务，不创造先后依赖'],
  ['time','两任务共用窗口起2026-12-20止2026-12-23 date_only，不是deadline/planned_start；不补时刻'],
  ['event','无独立活动，办理窗口不冒充事件'],
  ['graph','两个真实owner都保留窗口；无个人计划，无伪前置完成'],
  ['prose','全部标题、描述、覆盖、额外字段暂定裁决，合法拆分与顺序允许']]],
 ['RA-04','请于2026年12月22日15:15前将实验室借用说明交到北馆受理台。说明须为PDF，文件名使用学号和姓名。取得受理编号才算提交完成。本通知没有安排活动。',[
  ['action','只有提交实验室借用说明一个required任务；取得编号是办结标准，不独立造动作'],
  ['material','实验室借用说明、PDF、学号和姓名命名、北馆受理台渠道、受理编号办结完整保留，有依据陌生目的地不清空'],
  ['time','任务截止2026-12-22T15:15 exact，与材料/任务owner一致'],
  ['event','明确无活动，不制造event present'],
  ['graph','无额外动作/假owner/个人安排'],
  ['prose','标题/自由描述/额外字段逐项暂定裁决；未决不满分']]],
]
export async function roleComponents(){
 const b=await build({stdin:{contents:`export * from './src/recognition/sourceContractV7';export * from './src/recognition/sourceContractV6';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
export async function makeRoleComparison(){
 const x=await roleComponents(),sources=NOTICE_ROWS.map(([id,sourceText])=>({sourceId:'role-development-'+id,sourceVersionId:'role-development-'+id+'-v1',sourceText,sourceSha256:sha(sourceText),referenceTime:'2026-10-08T16:30:00+08:00',timezone:'Asia/Shanghai',provenance:'SINGLE_AUTHOR_ANONYMOUS_DEVELOPMENT_NOT_REAL_NOTICE_NOT_HOLDOUT'}))
 const references=NOTICE_ROWS.map(([id,,assertions])=>({sourceId:'role-development-'+id,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',assertions:assertions.map(([id,description])=>({id,description,critical:id!=='prose'})),disputes:['标题/自由描述/教学泄漏未独立裁决NOT_ADJUDICATED；原文全义务、所有额外实体及描述必须逐项核，不能仅检查结构','明确未公布null可正确；日前边界/完整条件拆分未决不填满分；命名/顺序及无损格式同义允许，错对象/日期/类型/依据/关系拒绝']}))
 const ref={version:SCORER,references},requests=[]
 for(const [i,s]of sources.entries()){
  const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},order=i%2?['RoleAuthority','ObligationAuthority']:['ObligationAuthority','RoleAuthority']
  for(const candidate of order){const req=await(candidate==='ObligationAuthority'?x.buildObligationAuthorityRequest(context):x.buildRoleAuthorityRequest(context)),body={...req.body,model:'deepseek-flash'}
   check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
   const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,arm:candidate==='ObligationAuthority'?'BASELINE':'NEW',candidate,candidateVersion:candidate==='ObligationAuthority'?x.OBLIGATION_CANDIDATE_VERSION:x.ROLE_CANDIDATE_VERSION,promptVersion:candidate==='ObligationAuthority'?x.OBLIGATION_PROMPT_VERSION:x.ROLE_PROMPT_VERSION,generationContract:candidate==='ObligationAuthority'?x.OBLIGATION_AUTHORITY_VERSION:x.ROLE_AUTHORITY_VERSION,requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(ref)),model:'deepseek-flash',scorer:SCORER,commonLayer:'SAME_CURRENT_PUBLIC_CONVERSION_FIRST_DISPLAY_EVENT_TASK_RELATION_AND_ORDINARY_COMMIT',referenceTime:s.referenceTime,timezone:s.timezone}
   requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})
  }
 }
 const sealed=['.data/obligation-authority/execution/STATE.json','.data/single-authority/execution/STATE.json','.data/public-notice/execution/STATE.json'].filter(existsSync).flatMap(p=>JSON.parse(readFileSync(p)).units??[]).filter(u=>u.status==='UNCERTAIN');check(requests.every(u=>sealed.every(o=>u.requestSha256!==o.requestSha256&&u.unitIdentitySha256!==o.unitIdentitySha256)),'SEALED_REUSE');
 const old=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/SOURCES.json')).sources
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':ref,'SELECTION.json':{sourceCount:4,requestCount:COUNT,order:'2AB/2BA',cells:['optional participation + real target + channel','qualification vs prerequisite completion','shared window separate citations','ordinary material destination/completion/deadline control'],rationale:'One source per three required generation-risk cells plus one ordinary regression control. All old four already-seen official excerpts remain regression only; no third arm or larger template set.',exactOverlapOldSources:sources.filter(s=>old.some(o=>o.sourceText===s.sourceText)).map(s=>s.sourceId),teachingExamples:'New wording/objects/dates; conceptual overlap deliberate. These authored Development notices are not official actual notices, independent Holdout or evidence of generalization.'},'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,version:SCORER,hypothesis:'Separate participation authority, qualification, prerequisite and execution channel reduces QR-as-target and interest/admission-as-prerequisite errors without losing obligations, events, time or materials.',changedComponents:['V7 participation authority replaces duplicated modality','literal optional executionChannel separated from business object','V7 shape/bridge with original V6 input unchanged'],commonComponents:'Both arms use same frozen support/context/endpoint/attribute/time/channel/eligibility/nonaction/first-display rules and ordinary event-task commit. V7->V6 role bridge is generation bundle; do not attribute whole-bundle effects only to prompt.',denominator:'4 sources per arm, all 8 identity outcomes retained including failures/unknown/disputes',layers:['modelFirstFacts','displayBeforeHuman','humanFinal'],truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',adjudication:'Use source-first assertions, verdict/reason/outputPointer per layer; any real factual error makes whole incorrect. Incomplete/disputed/unadjudicated prose remains UNKNOWN. Compiler refusal is first-display failure, not proof raw had no facts. No user correction counted as first correct.',criticalRisks:['key obligation/event/endpoint omission','unsupported task','wrong time/value/type/owner','false qualification/completion','bad dependency/activity/revision relation'],conclusions:['WHOLE_NET_GAIN_NO_NEW_CRITICAL_RISK','TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN','MIXED_PROGRESS','NO_BENEFIT','EVIDENCE_INCOMPLETE'],selection:'Definite execution + consistent ledger before comparison; all registered fact layers accounted. Net whole counts and target errors separate; new critical risk cannot be cancelled by score; no net+2 or 100% gate. Incomplete/uncertain means no winner.',dispatchAuthorized:false,extras:{retry:0,repair:0,verifier:0,extraSamples:0}}}
 const g=await build({entryPoints:['scripts/afternoon-role-comparison.mjs','scripts/afternoon-role-host.mjs','scripts/afternoon-role-readonly.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(g.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json','cloudflare/recognition-contract.generated.mjs'])].sort()
 artifacts['MANIFEST.json']={version:'obligation-authority-comparison-freeze-1',batch:BATCH,count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
 return artifacts
}
export function verifyRoleComparison({observedReadOnly=false}={}){
 const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&m.status==='NOT_RUN'&&!m.dispatchAuthorized&&ids.status==='NOT_RUN'&&!ids.dispatchAuthorized,'SCOPE')
 for(const f of m.components){check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path);if(!observedReadOnly)check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 check(ids.requests.length===COUNT&&sources.length===4,'COUNT')
 for(const [i,u]of ids.requests.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u,s=sources.find(s=>s.sourceId===u.sourceId);check(i+1===u.ordinal&&u.batch===BATCH&&s&&sha(s.sourceText)===u.sourceSha256&&!dispatchAuthorized&&status==='NOT_RUN'&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY');check(body.model==='deepseek-flash'&&body.temperature===0&&body.reasoning.effort==='none'&&!body.stream&&body.max_output_tokens===8192&&!/\bexpected\b/iu.test(JSON.stringify(body)),'PARAMETERS');check(u.referenceSha256===sha(readFileSync(join(ROOT,'REFERENCES.json')))&&u.referenceTime===s.referenceTime&&u.timezone===s.timezone,'REFERENCE')}
 check(new Set(ids.requests.map(u=>u.unitIdentitySha256)).size===COUNT,'UNIQUE')
 return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
}
export function reportRoleFacts(references,records=[]){
 const cases=['ObligationAuthority','RoleAuthority'].flatMap(candidate=>references.map(ref=>{const r=records.filter(r=>r.sourceId===ref.sourceId&&r.candidate===candidate);return {candidate,sourceId:ref.sourceId,...scorePublicNotice(ref,r.length===1?r[0]:undefined)}}))
 return {version:SCORER,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',cases,summary:Object.fromEntries(['ObligationAuthority','RoleAuthority'].map(c=>[c,Object.fromEntries(['modelFirstFacts','displayBeforeHuman','humanFinal'].map(l=>[l,{correct:cases.filter(r=>r.candidate===c&&r.stages[l].complete===true).length,incorrect:cases.filter(r=>r.candidate===c&&r.stages[l].complete===false).length,unknown:cases.filter(r=>r.candidate===c&&r.stages[l].complete==='UNKNOWN').length,denominator:references.length}]))])),selection:'EVIDENCE_INCOMPLETE_UNLESS_EXECUTION_AND_ALL_ADJUDICATION_DEFINITE'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,...extra]=process.argv.slice(2);check(!extra.length,'EXTRA_ARGUMENTS')
 if(mode==='--write'){
  check(execFileSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim().split(/\r?\n/u).filter(Boolean).every(l=>l==='?? CODEX_DESKTOP_HANDOVER.md'),'COMMITTED_CODE_REQUIRED')
  const a=await makeRoleComparison();mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(a)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}
  const p=verifyRoleComparison();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))
 }else if(mode==='--verify'){const p=verifyRoleComparison();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))}
 else if(mode==='--report'){verifyRoleComparison({observedReadOnly:true});const refs=JSON.parse(readFileSync(join(ROOT,'REFERENCES.json'))).references,p=resolve('.data/afternoon-mainline-20261008/execution/ADJUDICATION.json');console.log(json(reportRoleFacts(refs,existsSync(p)?JSON.parse(readFileSync(p)).records:[])))}
 else throw Error('OBLIGATION_FREEZE_MODE_REQUIRED')
}
