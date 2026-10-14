// New input comparison only. No transport, credential access or ledger mutation.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {scorePublicNotice} from './public-notice-scoring.mjs'
export const ROOT='docs/recognition-optimization/candidate19-public-development/single-authority-followup/comparison'
export const BATCH='C19-SINGLE-AUTHORITY-DEVELOPMENT-R1',COUNT=8,SCORER='single-authority-paired-facts-1.0.0'
export const sha=v=>createHash('sha256').update(v).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
const normalized=v=>sha(v.toString('utf8').replace(/\r\n/g,'\n')),check=(v,c)=>{if(!v)throw Error('AUTHORITY_FREEZE_'+c)}
export async function authorityComponents(){
 const b=await build({stdin:{contents:`export {buildCandidate19Request} from './src/experiments/realInput01/candidate19';export * from './src/recognition/sourceContractV5';export {decodeCurrentSourceRecording} from './src/recognition/conditionalNonActionProduct';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
// Four independent coverage cells: one activity, multiple/shared activities,
// task/material/endpoint graph, and zero-entity control. New wording, not Holdout.
export const NOTICE_ROWS=[
 ['SA-01','2026年12月3日13:30开展影像叙事工作坊，结束时间暂未公布。全程在线，安排作品讨论，完成学习后提供学习证明。本消息仅告知活动，无需报名。',[
  ['entities','0任务、1独立工作坊；在线形式、作品讨论及学习证明保留为该活动信息，不另造事件'],['time','工作坊开始2026-12-03T13:30 exact；结束null unknown，保留结束时间暂未公布及依据'],['graph','起止引用同一工作坊；不因未公布而漏结束事实'],['prose','所有标题、描述、附注、额外实体及依据逐项暂定裁决；无未决或无据新增']]],
 ['SA-02','2026年12月4日10:00，东区资料研讨与西区资料研讨同时开始，各由所在区组织。两场均于11:30结束。另于12月5日09:00在交流室举行成果介绍会。没有报名要求。',[
  ['entities','0任务、3独立活动：东区研讨、西区研讨、成果介绍会；名称相近不能合并'],['time','两场研讨开始2026-12-04T10:00、结束2026-12-04T11:30；介绍会开始2026-12-05T09:00 exact'],['graph','共享开始/结束须有双方owner；无损同值独立时间表示也合法；介绍会不接研讨时间'],['prose','交流室属于介绍会；各区对象、全部描述和额外实体逐项裁决，介绍会结束原文未说明不猜']]],
 ['SA-03','先填写展品借用表，填完后递交展品借用表。递交窗口为2026年12月1日09:00至12月2日16:00，借用表须为PDF，文件名为展品编号-经办人，交到展品收件页面，以页面显示接收成功为完成。借用资格尚未公布，只有符合资格者才能领取展柜钥匙。',[
  ['entities','填写与递交借用表两个真实义务；领取钥匙资格unknown，不当成已符合；材料PDF/命名/收件页面/完成回执保留'],['time','递交窗口开始2026-12-01T09:00、结束2026-12-02T16:00；不是deadline或个人计划'],['graph','递交依赖填写，前置完成状态不写true；材料和窗口owner为递交，钥匙资格与前置完成分开'],['prose','没有独立活动；所有动作对象、字段与描述逐项裁决；已完成/资格或无据时间新增为关键风险']]],
 ['SA-04','资料目录采用双栏排版，学习证明仍沿用原名称。这只是版式与名称说明，不要求填写、递交或报名，也未安排活动。',[
  ['entities','0任务、0事件、0时间，不把资料/证明名称、否定动作或版式变成义务'],['time','没有时间，不能生成截止、日程或默认时刻'],['graph','纯信息原文完整核对，不伪造业务实体或空项目'],['prose','全部信息保留且不无据新增；自由描述、标题及覆盖暂定裁决']]],
]
export async function makeAuthorityComparison(){
 const x=await authorityComponents(),sources=NOTICE_ROWS.map(([id,sourceText])=>({sourceId:'authority-development-'+id,sourceVersionId:'authority-development-'+id+'-v1',sourceText,sourceSha256:sha(sourceText),referenceTime:'2026-10-06T09:00:00+08:00',timezone:'Asia/Shanghai',provenance:'SINGLE_AUTHOR_ANONYMOUS_DEVELOPMENT_NOT_REAL_NOTICE_NOT_HOLDOUT'}))
 const references=NOTICE_ROWS.map(([id,,assertions])=>({sourceId:'authority-development-'+id,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',assertions:assertions.map(([id,description])=>({id,description,critical:id!=='prose'})),disputes:['标题、自由描述、未决或缺依据不满分；未公布null可正确，未说明不等于unknown；同值时间的无损合法表示允许']}))
 const referenceArtifact={version:SCORER,references},requests=[]
 for(const [i,s]of sources.entries()){
  const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},order=i%2?['SingleAuthority','Candidate19']:['Candidate19','SingleAuthority']
  for(const candidate of order){const req=await(candidate==='Candidate19'?x.buildCandidate19Request(context):x.buildSingleAuthorityRequest(context)),body={...req.body,model:'deepseek-flash'}
   check(!/\bexpected\b/i.test(JSON.stringify(body)),'EXPECTED_LEAK')
   const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceVersionId:s.sourceVersionId,sourceSha256:s.sourceSha256,arm:candidate==='Candidate19'?'BASELINE':'NEW',candidate,requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(referenceArtifact)),model:'deepseek-flash',scorer:SCORER,commonLayer:'SAME_CURRENT_PUBLIC_TIME_CHANNEL_FIRST_ASSEMBLY_AND_ORDINARY_COMMIT',referenceTime:s.referenceTime,timezone:s.timezone}
   requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})
  }
 }
 const oldSources=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/SOURCES.json')).sources
 const artifacts={'SOURCES.json':{sources},'REFERENCES.json':referenceArtifact,'SELECTION.json':{sourceCount:4,requestCount:8,rationale:'One source per essential coverage cell; 2 AB/2 BA; no third arm. More examples would not resolve the present mechanism hypothesis.',exactOverlapOldSources:sources.filter(s=>oldSources.some(o=>o.sourceText===s.sourceText)).map(s=>s.sourceId),teachingExamples:'New wording/objects/dates, conceptual overlap intentional. Mechanism and these author-created sources are Development; no unseen-generalization claim.'},'PREPARED_REQUEST_IDENTITIES.json':{batch:BATCH,status:'NOT_RUN',dispatchAuthorized:false,requests},'PRE_REGISTRATION.json':{batch:BATCH,version:SCORER,hypothesis:'One authoritative owner plus program-derived inverse coverage/index reduces relation contradiction and ancillary activity oversplitting without critical fact loss',changedComponents:['system generation instructions','strict V5 schema','candidate-specific V5-to-source-facts compiler; C19 V4 unchanged'],commonComponents:'Same current source-time/channel/eligibility/directive/first-display/ordinary-save rules after each strict compiler. Candidate-specific compilation is part of generation bundle, not isolated prompt attribution.',denominator:'4 sources per arm; all 8 identities, failures and unknowns retained',layers:['modelFirstFacts','displayBeforeHuman','humanFinal'],truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',adjudication:'Source-first required assertions incl entire prose/extra graph; use factId/verdict/reason/outputPointer. Missing or disputed adjudication UNKNOWN, semantic incorrect dominates total. Compiler refusal is display failure, not proof raw lacked facts.',criticalRisks:['key omission','unsupported action','wrong time/value/type/owner','false qualification/completion','wrong relation'],conclusions:['WHOLE_NET_GAIN_NO_NEW_CRITICAL_RISK','TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN','MIXED_PROGRESS','NO_BENEFIT','EVIDENCE_INCOMPLETE'],selection:'All identities must have definite outcomes and ledger consistency. No winner with send/billing unknown or incomplete adjudication. Compare net whole count and target errors separately; any new critical risk prevents pure gain. No net+2 or 100% gate.',dispatchAuthorized:false,extras:{retry:0,repair:0,verifier:0,extraSamples:0}}}
 const g=await build({entryPoints:['scripts/single-authority-comparison.mjs','scripts/single-authority-execution-host.mjs','scripts/serve-candidate19-recorded.mjs','src/recognition/sourceContractV5.ts','src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
 const paths=[...new Set([...Object.keys(g.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','package.json','package-lock.json'])].sort()
 artifacts['MANIFEST.json']={version:'single-authority-comparison-freeze-1',batch:BATCH,count:COUNT,status:'NOT_RUN',dispatchAuthorized:false,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),components:paths.map(path=>({path,sha256:normalized(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
 return artifacts
}
export function verifyAuthorityComparison(){
 const m=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))),sources=JSON.parse(readFileSync(join(ROOT,'SOURCES.json'))).sources
 check(m.batch===BATCH&&m.count===COUNT&&m.status==='NOT_RUN'&&!m.dispatchAuthorized,'SCOPE')
 for(const f of m.components){check(normalized(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path);check(normalized(execFileSync('git',['show',m.generationCommit+':'+f.path],{maxBuffer:32*1024*1024}))===f.sha256,'COMMITTED_'+f.path)}
 for(const f of m.artifacts)check(sha(readFileSync(join(ROOT,f.path)))===f.sha256,'ARTIFACT_'+f.path)
 check(ids.requests.length===COUNT&&sources.length===4,'COUNT')
 for(const [i,u]of ids.requests.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u,s=sources.find(s=>s.sourceId===u.sourceId);check(i+1===u.ordinal&&u.batch===BATCH&&s&&sha(s.sourceText)===u.sourceSha256&&!dispatchAuthorized&&status==='NOT_RUN'&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY');check(body.model==='deepseek-flash'&&body.temperature===0&&body.reasoning.effort==='none'&&!body.stream&&body.max_output_tokens===8192,'PARAMETERS');check(u.referenceSha256===sha(readFileSync(join(ROOT,'REFERENCES.json')))&&u.referenceTime===s.referenceTime&&u.timezone===s.timezone,'REFERENCE')}
 check(new Set(ids.requests.map(u=>u.unitIdentitySha256)).size===COUNT,'UNIQUE')
 return {units:ids.requests,snapshot:m.generationCommit,binding:{manifestSha256:sha(readFileSync(join(ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
}
export function reportAuthorityFacts(references,records=[]){
 const cases=['Candidate19','SingleAuthority'].flatMap(candidate=>references.map(ref=>{const matches=records.filter(r=>r.sourceId===ref.sourceId&&r.candidate===candidate);return {candidate,sourceId:ref.sourceId,...scorePublicNotice(ref,matches.length===1?matches[0]:undefined)}}))
 return {version:SCORER,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',cases,summary:Object.fromEntries(['Candidate19','SingleAuthority'].map(c=>[c,Object.fromEntries(['modelFirstFacts','displayBeforeHuman','humanFinal'].map(l=>[l,{correct:cases.filter(r=>r.candidate===c&&r.stages[l].complete===true).length,incorrect:cases.filter(r=>r.candidate===c&&r.stages[l].complete===false).length,unknown:cases.filter(r=>r.candidate===c&&r.stages[l].complete==='UNKNOWN').length,denominator:references.length}]))])),selection:'EVIDENCE_INCOMPLETE_UNLESS_EXECUTION_AND_ALL_ADJUDICATION_DEFINITE'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,...extra]=process.argv.slice(2);check(!extra.length,'EXTRA_ARGUMENTS')
 if(mode==='--write'){
  // Explicitly preserve the user-owned untracked handover; every other asset must be committed.
  const status=execFileSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean)
  check(status.every(l=>l==='?? CODEX_DESKTOP_HANDOVER.md'),'COMMITTED_CODE_REQUIRED')
  const a=await makeAuthorityComparison();mkdirSync(ROOT,{recursive:true});for(const [name,v]of Object.entries(a)){check(!existsSync(join(ROOT,name)),'ALREADY_FROZEN');writeFileSync(join(ROOT,name),json(v),{flag:'wx'})}
  const p=verifyAuthorityComparison();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))
 }else if(mode==='--verify'){const p=verifyAuthorityComparison();console.log(json({status:'FROZEN_NOT_RUN',count:p.units.length,snapshot:p.snapshot,...p.binding}))}
 else if(mode==='--report'){verifyAuthorityComparison();const refs=JSON.parse(readFileSync(join(ROOT,'REFERENCES.json'))).references,p=resolve('.data/single-authority/execution/ADJUDICATION.json');console.log(json(reportAuthorityFacts(refs,existsSync(p)?JSON.parse(readFileSync(p)).records:[])))}
 else throw Error('AUTHORITY_MODE_REQUIRED')
}
