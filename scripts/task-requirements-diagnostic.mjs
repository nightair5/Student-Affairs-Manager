// One falsifiable mechanism: conditional form fields stay owned requirements;
// independently completed pickup/equipment obligations remain separate tasks.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {ROOT as CURRENT_ROOT,sha,json} from './current-role-diagnostic.mjs'
export {sha,json}
export const ROOT=CURRENT_ROOT+'/task-requirements-comparison',BATCH='V7-TASK-REQUIREMENTS-DEVELOPMENT-20261009-R1',COUNT=4
const check=(v,c)=>{if(!v)throw Error('REQUIREMENTS_'+c)}
const normalized=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n'))
export async function requirementsComponents(){
 const b=await build({stdin:{contents:`export * from './src/recognition/taskRequirementsContract';export * from './src/recognition/sourceContractV7';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
export async function makeRequirementsPacket(){
 const x=await requirementsComponents(),sources=[
 {sourceId:'REQ-01',sourceText:'请在2026年11月20日16:00前完成仪器借用登记。登记时须填写设备编号和联系电话；跨校使用者还须填写接收单位。同一登记不需要另填第二份表。登记提交后，请于2026年11月21日09:00到器材室领取借用卡。',minimumFacts:{tasks:['完成仪器借用登记','领取借用卡'],requirements:['登记设备编号和联系电话','跨校使用者填写接收单位'],time:['登记截止2026-11-20T16:00','领取时间2026-11-21T09:00，不改成登记截止'],location:'领取器材室',prerequisite:'登记提交后领取，未提供完成状态不得true',events:0}},
 {sourceId:'REQ-02',sourceText:'摄影工作坊于2026年11月25日14:00开始，16:00结束，地点为艺文楼C204。有意参加者可在2026年11月22日18:00前通过报名二维码报名摄影工作坊。报名时须填写年级；需借用器材者还须注明器材型号。获得录取后需自行准备相机；是否录取尚未通知。报名成功以收到确认邮件为准。',minimumFacts:{tasks:['可选报名摄影工作坊','录取后准备相机'],requirements:['报名填写年级','需借用器材者注明器材型号'],event:'摄影工作坊，艺文楼C204，2026-11-25T14:00至16:00',deadline:'报名2026-11-22T18:00',channel:'报名二维码，不猜链接或文件',completion:'收到确认邮件',qualification:'准备相机的录取资格unknown，不编成已完成前置'}}
 ].map(s=>({...s,sourceVersionId:s.sourceId+'-v1',sourceSha256:sha(s.sourceText),referenceTime:'2026-10-09T09:00:00+08:00',timezone:'Asia/Shanghai',role:'AUTHOR_ANONYMOUS_DEVELOPMENT_NOT_HOLDOUT',disputes:[]}))
 const references={version:'task-requirements-fact-adjudication-1.0.0',truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',sources:sources.map(s=>({sourceId:s.sourceId,minimumFacts:s.minimumFacts,disputes:s.disputes})),rule:'Whole provisional correctness requires all minimum facts, no extra independent duty, supported values/types/owners/relations, and reviewed titles/free prose. Incorrect required fact wins over score. Disputes/failed/no-output/unreviewed facts retain UNKNOWN in denominator. User corrections never first correct. Equivalent literal spans/format/order allowed, wrong object/date/relationship forbidden.'}
 const requests=[]
 for(const [i,s]of sources.entries())for(const candidate of i===0?['RoleAuthority','TaskRequirements']:['TaskRequirements','RoleAuthority']){
  const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},r=await (candidate==='RoleAuthority'?x.buildRoleAuthorityRequest(context):x.buildTaskRequirementsRequest(context)),body={...r.body,model:'deepseek-flash'}
  const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,candidate,candidateVersion:r.candidateVersion,promptVersion:r.promptVersion,generationContract:candidate==='RoleAuthority'?x.ROLE_AUTHORITY_VERSION:x.TASK_REQUIREMENTS_VERSION,requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(references)),model:'deepseek-flash',scorer:references.version,referenceTime:s.referenceTime,timezone:s.timezone}
  check(!/\bexpected\b/iu.test(JSON.stringify(body)),'EXPECTED_LEAK')
  requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,status:'NOT_RUN',dispatchAuthorized:false})
 }
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':references,'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,count:COUNT,purpose:'Test first-class conditional form requirements versus current V7 on two author Development sources',hypothesis:'A typed owned requirement can reduce duplicated form tasks without swallowing independent pickup/equipment duties',denominatorPerArm:2,order:'AB/BA',commonRules:'Same committed public converter, source-fact reference and first ordinary page. Only input contract/structural field instructions differ; not Prompt-only causal claim.',positiveControl:'Independent pickup and admitted equipment must remain separate tasks; local field condition must not become whole-task qualification.',provisional:true,notHoldout:true,conclusions:['WHOLE_NET_GAIN_NO_NEW_CRITICAL_RISK','TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN','MIXED_PROGRESS','NO_BENEFIT','EVIDENCE_INCOMPLETE'],extras:{retry:0,repair:0,verifier:0,extraSamples:0}}}
 const g=await build({entryPoints:['scripts/task-requirements-diagnostic.mjs','scripts/task-requirements-host.mjs','scripts/serve-candidate19-recorded.mjs','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(g.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json','cloudflare/recognition-contract.generated.mjs'])].sort()
 artifacts['MANIFEST.json']={version:'task-requirements-paired-freeze-1',batch:BATCH,count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
 return artifacts
}
export function verifyRequirements({observedReadOnly=false}={}){
 const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&!m.dispatchAuthorized&&ids.status==='NOT_RUN'&&!ids.dispatchAuthorized,'SCOPE')
 for(const f of m.components){check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path);if(!observedReadOnly)check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 check(ids.requests.length===COUNT&&sources.length===2,'COUNT')
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
  const a=await makeRequirementsPacket();mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(a)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}
 }else check(mode==='--verify','MODE')
 const p=verifyRequirements();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))
}
