import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {resolve,basename} from 'node:path'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {candidate19RecordedScene} from './candidate19-recorded-readonly.mjs'
import {candidate19Recordings} from './candidate19-recorded-data.mjs'
import {publicNoticeRecordedScene,historicalCandidate19Controls} from './public-notice-recorded-readonly.mjs'
import {currentNoticeRecordedScene} from './current-notice-recorded-readonly.mjs'
import {completedCurrentNoticeScene} from './current-notice-completed-readonly.mjs'
import {authorityRecordedScene} from './single-authority-recorded-readonly.mjs'
import {authorityObservedScene} from './single-authority-observed-readonly.mjs'
import {v5CurrentNoticeRecordedScene} from './v5-current-notice-recorded-readonly.mjs'
import {obligationRecordedScene} from './obligation-authority-recorded-readonly.mjs'
import {autonomousV6RecordedScene} from './autonomous-v6-readonly.mjs'
import {afternoonRoleScene} from './afternoon-role-readonly.mjs'
import {observedSettledBatch} from './settled-batch-observed-readonly.mjs'
import {verifyV5NoticeDiagnostic,ROOT as V5ROOT,BATCH as V5BATCH,COUNT as V5COUNT} from './prepare-v5-current-notice.mjs'
const [port,instance,fixtureMode]=process.argv.slice(2)
if(process.argv.length>5||fixtureMode&&!['--channel-role-fixtures','--channel-polarity-fixtures','--eligibility-fixtures','--public-notice-fixtures','--public-paid-recordings','--sealed-followup-fixtures','--current-notice-fixtures','--current-notice-batch','--current-notice-completed','--single-authority-fixtures','--single-authority-comparison','--single-authority-observed','--current-mechanism-fixtures','--v5-current-real-recordings','--v5-current-real-fixtures','--obligation-authority-fixtures','--obligation-authority-comparison','--autonomous-v6-recordings','--afternoon-role-fixtures','--afternoon-role-recordings'].includes(fixtureMode))throw Error('C19_UNKNOWN_REPLAY_MODE')
if(!/^\d{4,5}$/.test(port??'')||+port<6814||+port>65535||!/^[a-z0-9-]{2,32}$/.test(instance??''))throw Error('C19_NEW_LOOPBACK_INSTANCE_REQUIRED')
const publicPaid=['--public-paid-recordings','--sealed-followup-fixtures','--current-notice-fixtures'].includes(fixtureMode)
const currentBatch=['--current-notice-batch','--current-notice-completed','--single-authority-fixtures','--single-authority-comparison','--single-authority-observed','--current-mechanism-fixtures','--v5-current-real-recordings','--v5-current-real-fixtures','--obligation-authority-fixtures','--obligation-authority-comparison','--autonomous-v6-recordings','--afternoon-role-fixtures','--afternoon-role-recordings'].includes(fixtureMode)
let scene,recordings,batchLabel,plannedRequests,knownSettled,initialOrdinal,currentSources
if(fixtureMode==='--afternoon-role-fixtures'){
  scene={role:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT',modelRequests:0};recordings=[];currentSources=[];plannedRequests=8;knownSettled=0;initialOrdinal=101;batchLabel='V7角色分离仅工程夹具；新比较未发送，不是模型成绩'
}else if(fixtureMode==='--afternoon-role-recordings'){
  const verified=afternoonRoleScene(),historical=await autonomousV6RecordedScene();scene=verified.scene;recordings=[...verified.recordings,...historical.recordings.map(r=>({...r,ordinal:r.ordinal+50}))];currentSources=[...verified.sources,...historical.sources];plannedRequests=8;knownSettled=verified.recordings.length;initialOrdinal=recordings[0]?.ordinal??101;batchLabel='下午V6/V7角色分离4作者Development通知两臂；'+knownSettled+'份确定录制；另4份上午官方节选回归，分母和结果分开，不是Holdout'
}else if(fixtureMode==='--autonomous-v6-recordings'){
  const verified=await autonomousV6RecordedScene(),historical=observedSettledBatch({root:V5ROOT,execution:resolve('.data/v5-current-notice/execution'),batch:V5BATCH,count:V5COUNT,verifyPacket:verifyV5NoticeDiagnostic});scene=verified.scene;recordings=[...verified.recordings,...historical.recordings.map(r=>({...r,ordinal:r.ordinal+50}))];currentSources=[...verified.sources,...historical.sources]
  plannedRequests=4;knownSettled=verified.recordings.length;initialOrdinal=recordings[0]?.ordinal??101
  batchLabel='本次V6单臂4官方已见节选：'+knownSettled+'份确定录制；另4份旧V5只读回归，不混入新分母，不是配对胜负或Holdout'
}else if(fixtureMode==='--obligation-authority-comparison'){
  const verified=await obligationRecordedScene();scene=verified.scene;recordings=verified.recordings;currentSources=verified.sources
  plannedRequests=8;knownSettled=recordings.length;initialOrdinal=recordings[0]?.ordinal??1
  batchLabel='V5与义务先行单一关联机制4作者Development来源两臂；'+knownSettled+'份确定录制；未知与失败保留各臂4分母，不是官方真实通知或Holdout'
}else if(['--v5-current-real-recordings','--v5-current-real-fixtures','--obligation-authority-fixtures'].includes(fixtureMode)){
  const verified=await v5CurrentNoticeRecordedScene();scene=verified.scene;recordings=verified.recordings;currentSources=verified.sources
  plannedRequests=4;knownSettled=recordings.length;initialOrdinal=1
  batchLabel='当前V5单臂4份官方已见节选诊断；'+knownSettled+'份确定录制；不是原封存批替代、不判候选赢家；未知保留分母'
}else if(fixtureMode==='--single-authority-observed'){
  const verified=authorityObservedScene();scene=verified.scene;recordings=verified.recordings;currentSources=verified.sources
  plannedRequests=8;knownSettled=recordings.length;initialOrdinal=1
  batchLabel=`原冻结8身份：${knownSettled}份确定录制、${scene.units.filter(u=>u.status==='UNCERTAIN').length}份传输不确定、${scene.units.filter(u=>u.status==='NOT_SENT').length}份未发送；原付费现场只读。本页只回放独立核验的SETTLED记录，未运行及未决留在分母，不能判赢家`
}else if(fixtureMode==='--single-authority-comparison'){
  const verified=await authorityRecordedScene();scene=verified.scene;recordings=verified.recordings;currentSources=verified.sources
  plannedRequests=8;knownSettled=recordings.length;initialOrdinal=1
  batchLabel='C19与单一权威生成机制4来源两臂8录制；匿名Development、暂定参照；未裁决保持UNKNOWN，不是独立Holdout或真人结果'
}else if(currentBatch){
  const verified=await (fixtureMode==='--current-notice-batch'?currentNoticeRecordedScene():completedCurrentNoticeScene());scene=verified.scene;recordings=verified.recordings;currentSources=verified.sources
  plannedRequests=4;knownSettled=recordings.length;initialOrdinal=1
  batchLabel='当前Candidate19单臂4份大学通知诊断；'+knownSettled+'份确定录制；未运行或未裁决保持UNKNOWN；不是候选比较或真人结果'
}else if(publicPaid){
  const verified=publicNoticeRecordedScene();scene=verified.scene
  recordings=[...verified.recordings,...historicalCandidate19Controls()]
  plannedRequests=4;knownSettled=verified.recordings.length;initialOrdinal=1
  batchLabel='当前4来源：1份确定录制、1份发送状态不确定、2份停发；付费现场封存。另12份为历史回归，不混入当前分母'
}else{
  const verified=await candidate19RecordedScene();scene=verified.scene
  if(scene.audit!=='CONSISTENT'||!scene.state)throw Error('C19_REPLAY_UNRESOLVED_RECORDS')
  const sources=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-development/SOURCES.json')).sources
  recordings=candidate19Recordings({units:verified.pack.units,sources,state:scene.state,rawRoot:'.data/candidate19/execution/raw'})
  plannedRequests=12;knownSettled=recordings.length;initialOrdinal=2
  batchLabel='原批12/12确定结算；冻结首屏结构化通过C17 2/6、C19 1/6，MIXED_PROGRESS'
}
if(!recordings.length&&!currentBatch)throw Error('C19_NO_SETTLED_RECORDINGS')
const sha=v=>createHash('sha256').update(v).digest('hex'),dir=resolve('.data/candidate19/recorded-'+instance)
mkdirSync(dir,{recursive:true});if(readdirSync(dir).length)throw Error('C19_REPLAY_INSTANCE_ALREADY_BUILT')
let fixtureCount=0
if(['--afternoon-role-fixtures','--afternoon-role-recordings'].includes(fixtureMode)){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {createRoleFixture} from './src/experiments/candidate19Recorded/roleFixtures';export {ROLE_AUTHORITY_VERSION} from './src/recognition/sourceContractV7';export {createAuthorityFixture} from './src/experiments/candidate19Recorded/singleAuthorityFixtures';export {SINGLE_AUTHORITY_VERSION} from './src/recognition/sourceContractV5';export {createObligationFixture} from './src/experiments/candidate19Recorded/obligationFixtures';export {OBLIGATION_AUTHORITY_VERSION} from './src/recognition/sourceContractV6'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const x=await import(pathToFileURL(fixtureFile)),fixtures=[await x.createRoleFixture(),await x.createAuthorityFixture('bad-owner'),await x.createAuthorityFixture('dependency'),await x.createObligationFixture('shared-window'),await x.createObligationFixture('equipment'),await x.createObligationFixture('no-task')]
  fixtureCount=fixtures.length;batchLabel+='；另6份工程夹具独立标记，不计模型样本'
  for(const [i,f] of fixtures.entries())recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',generationContract:i===0?x.ROLE_AUTHORITY_VERSION:i<3?x.SINGLE_AUTHORITY_VERSION:x.OBLIGATION_AUTHORITY_VERSION,sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
}else if(['--obligation-authority-fixtures','--autonomous-v6-recordings'].includes(fixtureMode)){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {OBLIGATION_CASES,createObligationFixture} from './src/experiments/candidate19Recorded/obligationFixtures';export {OBLIGATION_AUTHORITY_VERSION} from './src/recognition/sourceContractV6';export {createAuthorityFixture} from './src/experiments/candidate19Recorded/singleAuthorityFixtures';export {SINGLE_AUTHORITY_VERSION} from './src/recognition/sourceContractV5'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {OBLIGATION_CASES,createObligationFixture,OBLIGATION_AUTHORITY_VERSION,createAuthorityFixture,SINGLE_AUTHORITY_VERSION}=await import(pathToFileURL(fixtureFile))
  const fixtures=[...await Promise.all(OBLIGATION_CASES.map(createObligationFixture)),await createAuthorityFixture('bad-owner'),await createAuthorityFixture('dependency')]
  fixtureCount=fixtures.length;if(fixtureMode!=='--autonomous-v6-recordings')initialOrdinal=101;batchLabel+='；另6份义务先行及2份坏owner/前置等待工程控制，不计模型样本'
  for(const [i,f] of fixtures.entries())recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',generationContract:i<6?OBLIGATION_AUTHORITY_VERSION:SINGLE_AUTHORITY_VERSION,sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
}else if(fixtureMode==='--v5-current-real-fixtures'){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {createCompositionFixture} from './src/experiments/candidate19Recorded/authorityCompositionFixtures';export {createAuthorityFixture} from './src/experiments/candidate19Recorded/singleAuthorityFixtures';export {SINGLE_AUTHORITY_VERSION} from './src/recognition/sourceContractV5'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {createCompositionFixture,createAuthorityFixture,SINGLE_AUTHORITY_VERSION}=await import(pathToFileURL(fixtureFile))
  const a=await createCompositionFixture(),b=await createAuthorityFixture('bad-owner')
  const fixtures=[{...a,rawHttpText:a.envelope()},b]
  fixtureCount=2;batchLabel+='；另2份同事件日期/时段和坏归属匿名控制，仅工程夹具，不计模型4分母'
  for(const [i,f] of fixtures.entries())recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',generationContract:SINGLE_AUTHORITY_VERSION,sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
}else if(fixtureMode==='--current-mechanism-fixtures'){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {CURRENT_MECHANISM_CASES,createCurrentMechanismFixture} from './src/experiments/candidate19Recorded/currentMechanismFixtures';export {createAuthorityFixture} from './src/experiments/candidate19Recorded/singleAuthorityFixtures';export {SINGLE_AUTHORITY_VERSION} from './src/recognition/sourceContractV5'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {CURRENT_MECHANISM_CASES,createCurrentMechanismFixture,createAuthorityFixture,SINGLE_AUTHORITY_VERSION}=await import(pathToFileURL(fixtureFile))
  const fixtures=[...await Promise.all(CURRENT_MECHANISM_CASES.map(kind=>createCurrentMechanismFixture(kind))),...await Promise.all(['mixed','bad-owner'].map(kind=>createAuthorityFixture(kind)))]
  fixtureCount=fixtures.length;initialOrdinal=2;batchLabel+='；3份本轮标题/窗口定向夹具和2份已有部分确认/坏关系控制，均非模型输出'
  for(const [i,f] of fixtures.entries())recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',generationContract:SINGLE_AUTHORITY_VERSION,sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
}else if(fixtureMode==='--single-authority-fixtures'){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {AUTHORITY_CASES,createAuthorityFixture} from './src/experiments/candidate19Recorded/singleAuthorityFixtures';export {SINGLE_AUTHORITY_VERSION} from './src/recognition/sourceContractV5'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {AUTHORITY_CASES,createAuthorityFixture,SINGLE_AUTHORITY_VERSION}=await import(pathToFileURL(fixtureFile))
  fixtureCount=AUTHORITY_CASES.length;initialOrdinal=101;batchLabel+='；单一权威关系生成机制工程夹具，不是新模型回答或准确率'
  for(const [i,kind] of AUTHORITY_CASES.entries()){const f=await createAuthorityFixture(kind);recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',generationContract:SINGLE_AUTHORITY_VERSION,sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})}
}else if(fixtureMode==='--current-notice-fixtures'){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {CURRENT_NOTICE_CASES,createCurrentNoticeFixture} from './src/experiments/candidate19Recorded/currentNoticeFixtures'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {CURRENT_NOTICE_CASES,createCurrentNoticeFixture}=await import(pathToFileURL(fixtureFile))
  fixtureCount=CURRENT_NOTICE_CASES.length
  initialOrdinal=101
  batchLabel+='；另2份公开摘录的手写合法契约，仅证明程序时间转换，非模型输出'
  for(const [i,row] of CURRENT_NOTICE_CASES.entries()){
    const f=await createCurrentNoticeFixture(row.id)
    recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
  }
}else if(fixtureMode==='--sealed-followup-fixtures'){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {EVENT_LABEL_CASES,createEventLabelFixture} from './src/experiments/candidate19Recorded/eventLabelFixtures'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {EVENT_LABEL_CASES,createEventLabelFixture}=await import(pathToFileURL(fixtureFile))
  fixtureCount=EVENT_LABEL_CASES.length
  for(const [i,row] of EVENT_LABEL_CASES.entries()){
    const f=await createEventLabelFixture(row.id)
    recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
  }
}else if(fixtureMode==='--public-notice-fixtures'){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {createPublicNoticeFixture} from './src/experiments/candidate19Recorded/publicNotices'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {createPublicNoticeFixture}=await import(pathToFileURL(fixtureFile))
  fixtureCount=2
  for(const [i,id] of ['PUB-C19-01','PUB-C19-02'].entries()){
    const f=await createPublicNoticeFixture(id)
    recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
  }
}else if(fixtureMode==='--eligibility-fixtures'){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {ELIGIBILITY_CASES,createEligibilityFixture} from './src/experiments/candidate19Recorded/eligibilityFixtures'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {ELIGIBILITY_CASES,createEligibilityFixture}=await import(pathToFileURL(fixtureFile))
  fixtureCount=ELIGIBILITY_CASES.length
  for(const [i,row] of ELIGIBILITY_CASES.entries()){
    const f=await createEligibilityFixture(row.id)
    recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
  }
}else if(fixtureMode&&!publicPaid&&!currentBatch){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {CHANNEL_ROLE_CASES,CHANNEL_POLARITY_CASES,createChannelRoleFixture} from './src/experiments/candidate19Recorded/materialChannelFixtures'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {CHANNEL_ROLE_CASES,CHANNEL_POLARITY_CASES,createChannelRoleFixture}=await import(pathToFileURL(fixtureFile))
  const examples=fixtureMode==='--channel-polarity-fixtures'?CHANNEL_POLARITY_CASES:CHANNEL_ROLE_CASES
  fixtureCount=examples.length
  for(const [i,row] of examples.entries()){
    const f=await createChannelRoleFixture(row.id)
    recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
  }
}
const hash=createHash('sha256');for(const f of execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src','scripts/serve-candidate19-recorded.mjs','scripts/candidate19-recorded-data.mjs','scripts/public-notice-recorded-readonly.mjs'],{encoding:'utf8'}).trim().split('\n').sort())hash.update(f).update(readFileSync(f))
const buildIdentity=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim().slice(0,12)+' / source '+hash.digest('hex').slice(0,12),origin='http://127.0.0.1:'+port,database='rco-mainline-01-02-i1-d27-plan-recorded-'+instance
const pending=currentBatch&&!recordings.length
const result=pending?{outputFiles:[]}:await build({entryPoints:['src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__C19_RECORDED_CONFIG__:JSON.stringify({origin,database,build:buildIdentity,explicitContract:true,fixtureCount,batchLabel,initialOrdinal})}})
const files=result.outputFiles.map(f=>{const name=basename(f.path),content=f.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'');writeFileSync(resolve(dir,name),content);return {name,sha256:sha(content)}})
writeFileSync(resolve(dir,'recordings.json'),JSON.stringify(recordings))
const escape=v=>String(v).replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const obligationPending=fixtureMode==='--obligation-authority-comparison'
const pendingMechanism=obligationPending
  ?'V5与义务先行V6两臂；4份作者匿名Development，8个请求NOT_RUN；不是官方真实通知或Holdout。'
  :fixtureMode==='--v5-current-real-recordings'
  ?'当前V5单一权威生成契约5.0.0；公共首次组装1.3.0、窗口端点1.0.0；独立单臂诊断，不替代原封存请求。'
  :'Candidate19原生成契约；公共时间2.1.0、首次组装1.1.0。'
const pendingHeading=obligationPending?'4份匿名开发通知的两臂比较，等待本批模型授权':'4份真实通知，等待本批模型授权'
const pendingHtml='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · 首次输出待授权</title><style>body{font:18px/1.7 system-ui;max-width:900px;margin:40px auto;padding:24px;background:#f5f8fa;color:#183957}li{margin:24px 0}code{overflow-wrap:anywhere}</style><h1>'+pendingHeading+'</h1><p>这是工程状态页，尚无模型首答。0份录制，'+plannedRequests+'份NOT_RUN，整份正确率UNKNOWN。此页面不创建任务，也不打开工作区数据库。</p><p>'+pendingMechanism+'ENGINEERING_REPLAY，非真人试用。浏览器不发送模型请求。</p><p>构建：'+escape(buildIdentity)+'<br>预留全新隔离库：<code>'+escape(database)+'</code></p><ol>'+currentSources?.map(s=>'<li><strong>'+escape(s.title??s.sourceId)+'</strong> · NOT_RUN<br>原文时基：'+escape(s.referenceTime)+(s.url?'<br><a href="'+escape(s.url)+'">官方出处</a>':'<br>作者匿名Development；没有官方出处')+'</li>').join('')+'</ol><p>获得本批许可并确定结算后，同一回放模式载入真实raw，接现有普通App→ReviewSession→DomainCommitPlan→Repository；不以手写wire替代模型回答。</p></html>'
writeFileSync(resolve(dir,'index.html'),pending?pendingHtml:'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · C19真实录制产品修复</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script type="module" src="/browser.js"></script></body></html>')
writeFileSync(resolve(dir,'manifest.json'),JSON.stringify({origin,database,build:buildIdentity,role:'ENGINEERING_REPLAY',mode:pending?'PENDING_AUTHORIZATION_NO_MODEL_RESPONSE':'ORDINARY_APP_FIXED_RECORDING',databaseOpenedByPage:!pending,batch:currentBatch||publicPaid?scene.batch:scene.state.batch,batchLabel,knownSettledRecordings:knownSettled,historicalControls:publicPaid?12:0,anonymousFixtures:fixtureCount,plannedRequests,batchComplete:publicPaid?false:scene.state?.units.every(u=>u.status==='SETTLED')??false,files,recordingsSha256:sha(JSON.stringify(recordings)),modelCallsByBrowser:0},null,2))
createServer((req,res)=>{const p=new URL(req.url,origin).pathname;if(req.method!=='GET'||!['/','/browser.js','/browser.css','/recordings.json','/manifest.json'].includes(p)){res.writeHead(403);res.end('C19_MODEL_AND_EXTERNAL_ROUTES_DISABLED');return}const file=resolve(dir,p==='/'?'index.html':p.slice(1));if(!readdirSync(dir).includes(basename(file))){res.writeHead(404);res.end('NO_MODEL_RECORDING_BUNDLE');return}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':p.endsWith('.json')?'application/json':'text/html; charset=utf-8');res.end(readFileSync(file))}).listen(+port,'127.0.0.1',()=>console.log(JSON.stringify({origin,database,build:buildIdentity,mode:pending?'PENDING_AUTHORIZATION_NO_MODEL_RESPONSE':'ORDINARY_APP_FIXED_RECORDING',recordings:recordings.length,modelCallsByBrowser:0})))
