import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { resolve, dirname, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { inspectProtection, verifyReviewBinding, CANDIDATE02_DIRECTORY, CANDIDATE03_DIRECTORY, PAIRED04_DIRECTORY, PAIRED05_DIRECTORY, PAIRED06_DIRECTORY } from './check-mainline-real-input-01.mjs'
import { inspectRequest, createModelGateway, createPinnedProxyFetch, createRawRecorder } from './real-input-model-gateway.mjs'
import { BILLING_POLICY, FLASH41_POLICY, FLASH41_PAIRED06_POLICY, RECOVERY_ROUTE, initializeBudget, openBudget } from './real-input-budget.mjs'

const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const check=(ok,code)=>{if(!ok)throw Error('REAL_INPUT_RUNNER_'+code)}
export function verifyPreparedUnitIdentity({item,source,read,id,carrier,caseName,notice}) {
  check(read.workspace?.workspace?.id===read.name,'ACTUAL_DATABASE_ID')
  check(source.workspaceId===read.name&&source.legacyData?.captureOperationId==='engineering-'+id
    &&item.reading.inputReceipt.inputId===id&&item.reading.sendSnapshot.inputId===id,'UNIT_SOURCE_IDENTITY')
  const bId='B0'+(Number(id.slice(1)))
  check(carrier.unitId===bId&&carrier.caseName===caseName&&carrier.sourceText===notice
    &&carrier.sourceSha256===hash(notice),'CARRIER_CASE_IDENTITY')
  if(id.startsWith('B'))check(isDeepStrictEqual(item.reading.inputReceipt.file,
    {name:carrier.fileName,mime:carrier.mime,bytes:carrier.bytes,sha256:carrier.sha256}),'ACTUAL_CARRIER_IDENTITY')
}
const runDirectory=resolve('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a')
/** Binding mode never reads .env, constructs a gateway, or sends a request. */
export async function bindPreparedInputs(preparationFile,repositoryReadFile,outputFile,carrierManifestFile) {
  const protection=inspectProtection()
  const preparationPath=realpathSync(preparationFile),repositoryPath=realpathSync(repositoryReadFile)
  const preparationBytes=readFileSync(preparationPath),repositoryBytes=readFileSync(repositoryPath)
  check(preparationBytes.length<=4*1024*1024&&repositoryBytes.length<=10*1024*1024,'LOCAL_ARTIFACT_LIMIT')
  const preparation=JSON.parse(preparationBytes),read=JSON.parse(repositoryBytes)
  const carrierPath=realpathSync(carrierManifestFile),carrierBytes=readFileSync(carrierPath),carriers=JSON.parse(carrierBytes)
  check(carriers.version==='real-input-engineering-carriers-1'&&carriers.records?.length===8,'CARRIERS')
  check(hash(readFileSync(carriers.fixturePath))===carriers.fixtureSha,'CARRIER_FIXTURE_DRIFT')
  for(const carrier of carriers.records){const path=realpathSync(carrier.path),bytes=readFileSync(path)
    check(dirname(path)===dirname(carrierPath)&&bytes.length===carrier.bytes&&hash(bytes)===carrier.sha256,'CARRIER_BYTES')}
  check(preparation.version==='real-input-local-preparation-1'&&preparation.preparations?.length===16,'PREPARATION_SHAPE')
  check(read.source==='new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()'
    &&read.name===preparation.name&&read.origin===preparation.origin&&/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(read.origin)
    &&/^rco-mainline-01-02-i1-real-input-[a-z0-9-]{10,100}$/.test(read.name)
    &&hash(JSON.stringify(read.workspace))===read.sha256,'INDEPENDENT_READ_BINDING')
  const compiled=await build({stdin:{contents:[
    "export {validateSemanticWorkspace,readingOf} from './src/experiments/mainline05/semanticState.ts'",
    "export {buildModelRequest} from './src/experiments/realInput01/modelWire.ts'",
    "export {validateSendSnapshot} from './src/experiments/realInput01/inputReceipt.ts'",
    "export {scoreSeenResponse} from './src/experiments/realInput01/evaluation.ts'",
    "export {cases,notices,seenWire} from './src/experiments/realInput01/seenInputs.ts'",
  ].join(';'),resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,metafile:true,platform:'node',format:'esm',target:'node24'})
  const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
  await api.validateSemanticWorkspace(read.workspace,'real-input-01')
  check(read.workspace.tasks.length===0&&read.workspace.reminderRecords.length===0,'PREPARATION_NOT_EMPTY_TASKS')
  const dependencies=Object.keys(compiled.metafile.inputs).filter(path=>path!=='<stdin>').sort()
    .map(path=>({path,sha256:hash(readFileSync(path))}))
  const scorerSha=hash(JSON.stringify(dependencies)),units=[],requests={},seenHandles=new Set(),seenRequests=new Set()
  for(let i=0;i<16;i++){
    const item=preparation.preparations[i],id=(i<8?'A':'B')+'0'+(i%8+1),handle=item.handle
    check(item.unitId===id&&handle,'UNIT_ORDER')
    const source=read.workspace.sources.find(s=>s.id===handle.sourceId)
    const version=read.workspace.sourceVersions.find(v=>v.id===handle.sourceVersionId)
    const run=read.workspace.recognitionRuns.find(r=>r.id===handle.recognitionRunId)
    const draft=read.workspace.extractionDrafts.find(d=>d.id===handle.draftId)
    check(source&&version&&run&&draft&&source.id===version.sourceId&&run.sourceVersionId===version.id&&draft.recognitionRunId===run.id
      &&['queued','running'].includes(run.status)&&draft.legacyData?.realInputPending?.execution==='live','SOURCE_FIRST_RUN')
    const pending=draft.legacyData.realInputPending
    verifyPreparedUnitIdentity({item,source,read,id,carrier:carriers.records[i%8],caseName:api.cases[i%8],notice:api.notices[api.cases[i%8]]})
    check(pending.operationId==='prepare-'+id&&source.currentVersionId===version.id,'PREPARED_CURRENT_VERSION')
    check(isDeepStrictEqual(item.reading,pending.reading)&&isDeepStrictEqual(item.reading.inputReceipt,
      api.readingOf(source.legacyData.realInput01).inputReceipt),'PENDING_READING_IDENTITY')
    for(const field of ['sourceId','sourceVersionId','recognitionRunId','draftId']){
      const key=field+':'+handle[field];check(!seenHandles.has(key),'DUPLICATE_HANDLE');seenHandles.add(key)}
    await api.validateSendSnapshot(item.reading.inputReceipt,item.reading.sendSnapshot)
    check(item.context.index.sourceId===source.id&&item.context.index.sourceVersionId===version.id
      &&item.context.index.sourceContent===version.rawText&&version.rawText===item.reading.sendSnapshot.text
      &&item.context.referenceTime===item.reading.sendSnapshot.consentAt&&item.context.timezone==='Asia/Shanghai','CONTEXT_SOURCE_BINDING')
    if(i<8)check(source.type==='text'&&version.rawText===api.notices[api.cases[i]],'A_ORIGINAL_NOTICE')
    else check(item.reading.inputReceipt.file&&source.type===(i<12?'image':'file'),'B_TRUE_FILE_IDENTITY')
    const request=await api.buildModelRequest(item.context)
    check(request.serialized===item.requestText,'REQUEST_RECONSTRUCTION')
    const inspected=inspectRequest(request.serialized)
    check(!seenRequests.has(inspected.requestSha),'DUPLICATE_REQUEST');seenRequests.add(inspected.requestSha)
    units.push({unitId:id,candidateSha:inspected.candidateSha,requestSha:inspected.requestSha,inputSha:inspected.inputSha,scorerSha,requestBytes:inspected.requestBytes})
    requests[id]=request.serialized
  }
  check(new Set(units.map(u=>u.candidateSha)).size===1,'SAME_CANDIDATE_AB')
  const output=resolve(outputFile),approved=resolve('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/STATE.json')
  check(output===approved&&realpathSync(dirname(output))===realpathSync(dirname(approved)),'OUTPUT_PATH')
  const artifact={version:'real-input-prepared-binding-1',head:protection.head,preparation:{path:preparationPath,sha256:hash(preparationBytes)},
    independentRepositoryRead:{path:repositoryPath,sha256:hash(repositoryBytes),workspaceSha256:read.sha256},
    carriers:{path:carrierPath,sha256:hash(carrierBytes)},dependencies,scorerSha,units,requests,
    modelRequests:0,paidDispatch:'NOT_ENABLED_PENDING_SAFETY_AND_BILLING_REVIEW',quality:'NOT_RUN'}
  writeFileSync(output,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'})
  return {output:join(dirname(output),'STATE.json'),units:16,scorerSha,modelRequests:0,paidDispatch:artifact.paidDispatch}
}
export function verifySendApproval({bindingBytes,binding,protection,review,billing}) {
  verifyReviewBinding({head:protection.head,expectedHead:binding.head,
    sources:protection.sources.map(s=>({path:s.path,sha256:s.workingSha256})),review})
  check(review.scope==='REAL_INPUT_FIRST_SEND'&&review.bindingSha===hash(bindingBytes)
    &&review.billingEvidenceSha===hash(JSON.stringify(billing)),'SEND_APPROVAL')
  check(binding.version==='real-input-prepared-binding-1'&&binding.units.length===16,'SEND_BINDING')
  check(isDeepStrictEqual(billing.policy,BILLING_POLICY),'CURRENT_BILLING_POLICY')
  check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)
    &&Date.parse(billing.validUntil)-Date.parse(billing.checkedAt)<=86400000,'CURRENT_BILLING_VALIDITY')
  for(const artifact of [binding.preparation,binding.independentRepositoryRead,binding.carriers])
    check(hash(readFileSync(artifact.path))===artifact.sha256,'BOUND_ARTIFACT_CHANGED')
  check(hash(JSON.stringify(binding.dependencies))===binding.scorerSha,'SCORER_LIST')
  for(const dep of binding.dependencies)check(hash(readFileSync(dep.path))===dep.sha256,'SCORER_DEPENDENCY_CHANGED')
  for(const unit of binding.units){const request=inspectRequest(binding.requests[unit.unitId])
    check(['candidateSha','inputSha','requestSha','requestBytes'].every(k=>request[k]===unit[k])&&unit.scorerSha===binding.scorerSha,'SEND_UNIT_BINDING')}
  return true
}

/** One expressly selected original unit per invocation. There is no transport
 * retry, auto-resume, candidate replacement or extra authentication request. */
export async function dispatchPaidUnit(unitId) {
  check(/^[AB]0[1-8]$/.test(unitId),'PAID_UNIT')
  const protection=inspectProtection(),bindingBytes=readFileSync(join(runDirectory,'STATE.json')),binding=JSON.parse(bindingBytes)
  const approval=JSON.parse(readFileSync(join(runDirectory,'REVIEW.json'))).sending
  const billing=JSON.parse(readFileSync(join(runDirectory,'ENGINEERING.json'))).billing
  verifySendApproval({bindingBytes,binding,protection,review:approval,billing})
  const manifestPath=join(runDirectory,'REQUEST_MANIFEST.json'),rawPath=join(runDirectory,'RAW_RESULTS.jsonl')
  const oldRaw=existsSync(rawPath)?readFileSync(rawPath,'utf8'):''
  if(!existsSync(manifestPath)) {
    check(unitId==='A01'&&oldRaw===''&&!existsSync(join(runDirectory,'CALL_LEDGER.jsonl')),'NO_NEW_LEDGER_TO_RESUME')
    await initializeBudget(runDirectory,{version:'real-input-request-manifest-2',packageId:'MAINLINE-REAL-INPUT-01',policy:BILLING_POLICY,
      billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))},
      lockRoot:billing.lockRoot,units:binding.units})
  }
  const manifestBytes=readFileSync(manifestPath),manifest=JSON.parse(manifestBytes)
  check(isDeepStrictEqual(manifest.units,binding.units)&&manifest.billingEvidence.evidenceSha===hash(JSON.stringify(billing))
    &&manifest.lockRoot===billing.lockRoot,'MANIFEST_RUN_IDENTITY')
  const budget=await openBudget(runDirectory,hash(manifestBytes)),before=await budget.snapshot()
  check(!before.halted&&before.reservations.every(r=>r.status==='settled')
    &&before.units[before.reservations.length]?.unitId===unitId,'NO_RETRY_OR_UNRESOLVED_REQUEST')
  const previous=oldRaw?oldRaw.trimEnd().split('\n').map(line=>JSON.parse(line)):[]
  check(previous.length===before.reservations.length,'RAW_LEDGER_COUNT')
  for(const [i,row] of previous.entries()){const r=before.reservations[i],u=binding.units[i]
    check(row.version==='real-input-raw-result-1'&&row.unitId===r.unitId&&row.requestSha===r.requestSha
      &&row.responseSha===r.responseSha&&hash(row.rawHttpText)===row.responseSha
      &&row.candidateSha===u.candidateSha&&row.inputSha===u.inputSha,'RAW_LEDGER_BINDING')}
  const compiled=await build({stdin:{contents:"export {scoreSeenResponse} from './src/experiments/realInput01/evaluation.ts';export {cases,seenWire} from './src/experiments/realInput01/seenInputs.ts'",
    resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node24',metafile:true})
  for(const path of Object.keys(compiled.metafile.inputs).filter(p=>p!=='<stdin>'))
    check(binding.dependencies.some(d=>d.path===path&&d.sha256===hash(readFileSync(path))),'SCORER_NEW_DEPENDENCY')
  const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
  const prepared=JSON.parse(readFileSync(binding.preparation.path)),results=[]
  const scoreRow=async row=>{const index=binding.units.findIndex(u=>u.unitId===row.unitId),item=prepared.preparations[index]
    const reference=await api.seenWire(api.cases[index%8],item.handle)
    const score=await api.scoreSeenResponse(row.rawHttpText,item.context,reference.original.rawResponse,reference.original.context)
    return {unitId:row.unitId,responseSha:row.responseSha,scorerSha:binding.scorerSha,score}}
  for(const row of previous){const scored=await scoreRow(row)
    check(scored.score.schemaParsed&&scored.score.forbidden===0&&scored.score.metricStatus==='EXACT_REFERENCE_DIAGNOSTIC','PREVIOUS_RESPONSE_STOP')
    results.push(scored)}
  // Re-check after all asynchronous preparation, before opening the only gateway.
  verifySendApproval({bindingBytes,binding,protection:inspectProtection(),review:approval,billing})
  const handle=await open(rawPath,existsSync(rawPath)?'a':'wx',0o600),origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex')
  let observedRaw
  try {
    const gateway=await createModelGateway({origin,capability,budget,requests:binding.requests,recordRaw:async row=>{
      await handle.writeFile(JSON.stringify(row)+'\n');await handle.sync();observedRaw=row}})
    const started=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',
      headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},
      bodyText:JSON.stringify({unitId,requestSha:binding.units.find(u=>u.unitId===unitId).requestSha})})
    let stopped=response.status!==200,scoreError=null
    if(response.status===200)try{const scored=await scoreRow(observedRaw);results.push(scored)
      if(scored.score.forbidden>0||scored.score.metricStatus!=='EXACT_REFERENCE_DIAGNOSTIC'){stopped=true;await budget.halt('CANDIDATE_REQUIRES_REVIEW')}}
    catch{stopped=true;scoreError='FIRST_RESPONSE_SCHEMA_OR_SCORER_REJECTED';await budget.halt('FIRST_RESPONSE_SCHEMA_OR_SCORER_REJECTED')}
    const after=await budget.snapshot(),report={version:'real-input-seen-live-result-1',bindingSha:hash(bindingBytes),scorerSha:binding.scorerSha,
      plannedUnits:binding.units.map(u=>u.unitId),attempted:after.reservations.length,rows:results,
      unscoredAttempt:scoreError?{unitId,reason:scoreError}:null,notRun:binding.units.slice(after.reservations.length).map(u=>u.unitId),
      stopped,halted:after.halted,lastHttpStatus:response.status,lastSafeCode:response.body.code??null,lastWaitingMs:Date.now()-started,
      lastDiagnostic:response.diagnostic??null,
      costUpperMicroCny:after.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0),providerBilledCny:'NOT_OBSERVABLE',
      automaticSelection:'NOT_ENABLED',humanTime:'NOT_RUN',independentSemanticSources:8,qualityClaim:'已见工程诊断，不是未见/真实材料准确率'}
    writeFileSync(join(runDirectory,'RESULT.json'),JSON.stringify(report,null,2)+'\n')
    return {unitId,attempted:report.attempted,stopped,halted:report.halted,lastHttpStatus:report.lastHttpStatus,
      costUpperMicroCny:report.costUpperMicroCny,completeCase:results.at(-1)?.unitId===unitId?results.at(-1).score.completeCase:null}
  }finally{await handle.close()}
}
const recoveryDirectory=resolve('docs/recognition-optimization/mainline-real-input-01/runs/recovery-a02-20260907a')
/** Current review is distinct from the immutable historical input identity. */
export function verifyRecoverySendApproval({bindingBytes,binding,protection,review,billing,planBytes,plan,baselineBytes,baseline,manifestBytes}) {
  verifyReviewBinding({head:protection.head,expectedHead:'afd81ee4e8bac9285287c85f9ea389139bea12f6',
    sources:protection.sources.map(s=>({path:s.path,sha256:s.workingSha256})),review})
  check(review.scope==='REAL_INPUT_A02_RECOVERY'&&review.bindingSha===hash(bindingBytes)
    &&review.planSha===hash(planBytes)&&review.baselineSha===hash(baselineBytes)
    &&review.billingEvidenceSha===hash(JSON.stringify(billing)),'RECOVERY_APPROVAL')
  check(plan.version==='real-input-a02-recovery-plan-1'&&plan.unitId==='A02'
    &&plan.originalRun===runDirectory&&binding.version==='real-input-prepared-binding-1'&&binding.units.length===16,'RECOVERY_PLAN')
  check(isDeepStrictEqual(billing.policy,BILLING_POLICY)&&billing.lockRoot===baseline.lockRoot,'RECOVERY_BILLING_POLICY')
  const checked=Date.parse(billing.checkedAt),until=Date.parse(billing.validUntil)
  check(Number.isFinite(checked)&&Date.now()>=checked&&Date.now()<=until&&until-checked<=86400000,'RECOVERY_BILLING_VALIDITY')
  for(const document of billing.documents)check(document.status===200
    &&['https://api-docs.deepseek.com/zh-cn/quick_start/pricing/','https://api-docs.deepseek.com/api/create-response/'].includes(document.url)
    &&hash(readFileSync(document.path))===document.sha256,'RECOVERY_PUBLIC_EVIDENCE')
  check(billing.documents.length===2&&new Set(billing.documents.map(d=>d.url)).size===2,'RECOVERY_PUBLIC_DOCUMENTS')
  const g=plan.grantBasis,manifest=JSON.parse(manifestBytes)
  check(g.head===protection.head&&g.sourcesSha===hash(JSON.stringify(review.sources))
    &&g.bindingSha===hash(bindingBytes)&&g.manifestSha===hash(manifestBytes)&&g.manifestSha===baseline.manifestSha
    &&g.parentTail===baseline.ledgerBoundary.tailHash&&g.parentSequence===3
    &&g.ledgerPrefixSha===baseline.ledgerBoundary.sha256&&g.ledgerPrefixBytes===baseline.ledgerBoundary.bytes
    &&isDeepStrictEqual(g.target,binding.units[1])&&isDeepStrictEqual(g.route,RECOVERY_ROUTE)
    &&isDeepStrictEqual(g.billingEvidence,{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))})
    &&isDeepStrictEqual(manifest.units,binding.units),'RECOVERY_GRANT_BINDING')
  const a01=JSON.parse(readFileSync(join(runDirectory,'CALL_LEDGER.jsonl'),'utf8').split('\n')[1]).event
  check(a01.kind==='reserve'&&a01.unitId==='A01'&&g.priorNonce===a01.nonce&&g.priorRequestSha===a01.requestSha,'RECOVERY_A01_BINDING')
  for(const artifact of [binding.preparation,binding.independentRepositoryRead,binding.carriers])
    check(hash(readFileSync(artifact.path))===artifact.sha256,'BOUND_ARTIFACT_CHANGED')
  check(hash(JSON.stringify(binding.dependencies))===binding.scorerSha,'SCORER_LIST')
  for(const dep of binding.dependencies)check(hash(readFileSync(dep.path))===dep.sha256,'SCORER_DEPENDENCY_CHANGED')
  for(const unit of binding.units){const request=inspectRequest(binding.requests[unit.unitId])
    check(['candidateSha','inputSha','requestSha','requestBytes'].every(k=>request[k]===unit[k])
      &&unit.scorerSha===binding.scorerSha,'SEND_UNIT_BINDING')}
  return {...g,reviewSha:hash(JSON.stringify(review))}
}
export async function dispatchRecoveredA02() {
  const bindingBytes=readFileSync(join(runDirectory,'STATE.json')),binding=JSON.parse(bindingBytes)
  const planBytes=readFileSync(join(recoveryDirectory,'STATE.json')),plan=JSON.parse(planBytes)
  const baselineBytes=readFileSync(join(recoveryDirectory,'BASELINE.json')),baseline=JSON.parse(baselineBytes)
  const billing=JSON.parse(readFileSync(join(recoveryDirectory,'ENGINEERING.json'))).billing
  const review=JSON.parse(readFileSync(join(recoveryDirectory,'REVIEW.json'))).sending
  const manifestBytes=readFileSync(join(runDirectory,'REQUEST_MANIFEST.json'))
  const validate=()=>verifyRecoverySendApproval({bindingBytes,binding,planBytes,plan,baselineBytes,baseline,billing,review,manifestBytes,
    protection:inspectProtection({stage:'recovery-a02'})})
  const grant=validate(),budget=await openBudget(runDirectory,hash(manifestBytes),{recoveryGrant:grant})
  const before=await budget.snapshot()
  check(!before.recovery&&before.reservations.length===1&&before.reservations[0].unitId==='A01','RECOVERY_ALREADY_USED')
  const output=join(recoveryDirectory,'RESULT.json'),rawPath=join(recoveryDirectory,'RAW_RESULTS.jsonl')
  check(!existsSync(output)&&!existsSync(rawPath),'RECOVERY_OUTPUT_EXISTS')
  const compiled=await build({stdin:{contents:"export {scoreSeenResponse} from './src/experiments/realInput01/evaluation.ts';export {cases,seenWire} from './src/experiments/realInput01/seenInputs.ts'",
    resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node24',metafile:true})
  for(const path of Object.keys(compiled.metafile.inputs).filter(p=>p!=='<stdin>'))
    check(binding.dependencies.some(d=>d.path===path&&d.sha256===hash(readFileSync(path))),'SCORER_NEW_DEPENDENCY')
  const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
  const prepared=JSON.parse(readFileSync(binding.preparation.path)),item=prepared.preparations[1]
  check(item.unitId==='A02','RECOVERY_PREPARED_UNIT')
  validate() // No credential access before all current/source/price checks.
  try{process.loadEnvFile(resolve('.env'))}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const recorder=await createRawRecorder(rawPath),origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex')
  let observedRaw
  try {
    const gateway=await createModelGateway({origin,capability,budget,requests:binding.requests,fetchImpl:createPinnedProxyFetch(),
      recordRaw:async row=>{check(row.unitId==='A02'&&row.requestSha===grant.target.requestSha,'RECOVERY_RAW_IDENTITY')
        await recorder.write(row);observedRaw=row}})
    const start=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',
      headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},
      bodyText:JSON.stringify({unitId:'A02',requestSha:grant.target.requestSha})})
    const rows=[];let scoreError=null
    if(response.status===200)try {
      check(observedRaw?.requestSha===grant.target.requestSha,'RECOVERY_RAW_MISSING')
      const reference=await api.seenWire(api.cases[1],item.handle)
      rows.push({unitId:'A02',responseSha:observedRaw.responseSha,scorerSha:binding.scorerSha,
        score:await api.scoreSeenResponse(observedRaw.rawHttpText,item.context,reference.original.rawResponse,reference.original.context)})
    }catch{scoreError='FIRST_RESPONSE_SCHEMA_OR_SCORER_REJECTED'}
    const after=await budget.snapshot()
    const report={version:'real-input-a02-recovery-result-1',unitId:'A02',bindingSha:hash(bindingBytes),grantSha:hash(JSON.stringify(grant)),
      totalAttempts:after.reservations.length,newAttempts:after.reservations.length-before.reservations.length,
      originalA01:{status:'TRANSPORT_OR_CRASH_UNKNOWN',attempts:1,unknownReservationMicroCny:3300000},
      rows,scoreError,stopped:true,automaticContinuation:false,notRun:binding.units.filter(u=>!after.reservations.some(r=>r.unitId===u.unitId)).map(u=>u.unitId),
      lastHttpStatus:response.status,lastDiagnostic:response.diagnostic??null,lastWaitingMs:Date.now()-start,
      costUpperMicroCny:after.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0),
      a02CostUpperMicroCny:after.reservations.find(r=>r.unitId==='A02')?.costUpperMicroCny??0,
      providerBilledCny:'NOT_OBSERVABLE',automaticSelection:'NOT_ENABLED',humanTime:'NOT_RUN',
      qualityClaim:'已见工程单例诊断，不是盲测或真实材料准确率'}
    writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
    return {unitId:'A02',newAttempts:report.newAttempts,totalAttempts:report.totalAttempts,lastHttpStatus:response.status,
      stopped:true,costUpperMicroCny:report.costUpperMicroCny,completeCase:rows[0]?.score.completeCase??null}
  }finally{await recorder.close()}
}
const batchDirectory=resolve('docs/recognition-optimization/mainline-real-input-01/runs/replay-a02-implementation-20260907a')
const scorerEntry="export {scoreSeenResponse} from './src/experiments/realInput01/evaluation.ts';export {cases,seenWire} from './src/experiments/realInput01/seenInputs.ts'"
/** Actual frozen scoring closure, not the larger historical preparation bundle. */
export async function compileBatchScorer(binding) {
  check(hash(JSON.stringify(binding.dependencies))===binding.scorerSha,'SCORER_LIST')
  const compiled=await build({stdin:{contents:scorerEntry,resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',target:'node24',metafile:true})
  const dependencies=Object.keys(compiled.metafile.inputs).filter(p=>p!=='<stdin>')
    .map(path=>({path,sha256:hash(readFileSync(path))}))
  const frozen=JSON.parse(readFileSync(join(batchDirectory,'BATCH_SCORER_CLOSURE.json')))
  check(dependencies.length===10&&isDeepStrictEqual(dependencies,frozen.usedDependencies.map(({path,sha256})=>({path,sha256})))
    &&dependencies.every(d=>binding.dependencies.some(old=>isDeepStrictEqual(old,d)))
    &&hash(compiled.outputFiles[0].contents)===frozen.bundleSha,'BATCH_FROZEN_SCORER')
  return {dependencies,bundleSha:frozen.bundleSha,
    api:await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))}
}
export function verifyBatchSendApproval({bindingBytes,binding,manifestBytes,baselineBytes,baseline,
  planBytes,plan,billing,review,protection,closure}) {
  check(hash(bindingBytes)==='d478c58f7f44e68a852bc7712c5d3e7994f2390750f5915d65204963dff9e73b'
    &&isDeepStrictEqual(JSON.parse(bindingBytes),binding),'BATCH_ORIGINAL_BINDING')
  check(hash(manifestBytes)==='7ed6c3c2054e0d101328f882e0efc5e4415d0db8d3cc1f2bc98157ce324d9a9c'
    &&isDeepStrictEqual(JSON.parse(manifestBytes).units,binding.units),'BATCH_MANIFEST')
  check(isDeepStrictEqual(JSON.parse(planBytes),plan)&&isDeepStrictEqual(JSON.parse(baselineBytes),baseline),'BATCH_OBJECT_BYTES')
  verifyReviewBinding({head:protection.head,expectedHead:'ae78dfef255eb5344868d1b4319e486537ac6681',
    sources:protection.sources.map(s=>({path:s.path,sha256:s.workingSha256})),review})
  check(review.scope==='REAL_INPUT_BATCH_14_SEND'&&review.bindingSha===hash(bindingBytes)
    &&review.planSha===hash(planBytes)&&review.baselineSha===hash(baselineBytes)
    &&review.billingEvidenceSha===hash(JSON.stringify(billing))&&review.scorerBundleSha===closure.bundleSha,'BATCH_APPROVAL')
  check(plan.version==='real-input-batch-authorization-1'&&plan.originalRun===runDirectory
    &&isDeepStrictEqual(billing.policy,BILLING_POLICY)&&billing.lockRoot===JSON.parse(manifestBytes).lockRoot,'BATCH_POLICY')
  const checked=Date.parse(billing.checkedAt),until=Date.parse(billing.validUntil)
  check(Number.isFinite(checked)&&Number.isFinite(until)&&Date.now()>=checked&&Date.now()<=until
    &&until>checked&&until-checked<=86400000,'BATCH_PRICE_VALIDITY')
  check(billing.documents?.length===2&&new Set(billing.documents.map(d=>d.url)).size===2,'BATCH_PUBLIC_DOCUMENTS')
  for(const d of billing.documents)check(d.status===200&&['https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    'https://api-docs.deepseek.com/api/create-response/'].includes(d.url)&&hash(readFileSync(d.path))===d.sha256,'BATCH_PUBLIC_EVIDENCE')
  for(const a of [binding.preparation,binding.independentRepositoryRead,binding.carriers])
    check(hash(readFileSync(a.path))===a.sha256,'BATCH_INPUT_ARTIFACT')
  check(hash(JSON.stringify(binding.dependencies))===binding.scorerSha&&closure.dependencies.length===10
    &&closure.dependencies.every(d=>binding.dependencies.some(old=>isDeepStrictEqual(old,d))
      &&hash(readFileSync(d.path))===d.sha256),'BATCH_SCORER_BINDING')
  for(const u of binding.units){const r=inspectRequest(binding.requests[u.unitId]);check(
    ['requestSha','requestBytes','candidateSha','inputSha'].every(k=>r[k]===u[k])&&u.scorerSha===binding.scorerSha,'BATCH_REQUEST_BINDING')}
  const g=plan.grantBasis,ledger=readFileSync(join(runDirectory,'CALL_LEDGER.jsonl'))
  const events=ledger.toString('utf8').trimEnd().split('\n').map(l=>JSON.parse(l).event)
  check(g.head===protection.head&&g.sourcesSha===hash(JSON.stringify(review.sources))&&g.bindingSha===hash(bindingBytes)
    &&g.manifestSha===hash(manifestBytes)&&g.parentSequence===5&&g.parentTail===baseline.ledgerBoundary.tail
    &&g.ledgerPrefixBytes===baseline.ledgerBoundary.bytes&&g.ledgerPrefixSha===baseline.ledgerBoundary.sha256
    &&hash(ledger.subarray(0,g.ledgerPrefixBytes))===g.ledgerPrefixSha&&g.priorNonce===events[1].nonce
    &&events[1].unitId==='A01'&&g.a02ResponseSha===events[4].responseSha&&events[4].unitId==='A02'
    &&g.maxTotalRequests===16&&isDeepStrictEqual(g.targets,binding.units.slice(2))&&isDeepStrictEqual(g.route,RECOVERY_ROUTE)
    &&isDeepStrictEqual(g.billingEvidence,{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))}),
  'BATCH_GRANT_BINDING')
  return {...g,reviewSha:hash(JSON.stringify(review))}
}
/** Explicit one-unit command. No .env access until every immutable and review gate passes. */
export async function dispatchBatchUnit(unitId) {
  check(/^(?:A0[3-8]|B0[1-8])$/.test(unitId),'BATCH_UNIT')
  const bindingBytes=readFileSync(join(runDirectory,'STATE.json')),binding=JSON.parse(bindingBytes)
  const manifestBytes=readFileSync(join(runDirectory,'REQUEST_MANIFEST.json'))
  const baselineBytes=readFileSync(join(batchDirectory,'BATCH_BASELINE.json')),baseline=JSON.parse(baselineBytes)
  const planBytes=readFileSync(join(batchDirectory,'BATCH_AUTHORIZATION.json')),plan=JSON.parse(planBytes)
  const billing=JSON.parse(readFileSync(join(batchDirectory,'BATCH_BILLING.json')))
  const review=JSON.parse(readFileSync(join(batchDirectory,'BATCH_REVIEW.json'))).sending
  const closure=await compileBatchScorer(binding)
  const validate=()=>verifyBatchSendApproval({bindingBytes,binding,manifestBytes,baselineBytes,baseline,planBytes,plan,billing,review,closure,
    protection:inspectProtection({stage:'batch-14'})})
  const grant=validate(),budget=await openBudget(runDirectory,hash(manifestBytes),{batchGrant:grant}),before=await budget.snapshot()
  check(!before.batch?.stopped&&before.reservations.slice(1).every(r=>r.status==='settled')
    &&binding.units[before.reservations.length]?.unitId===unitId,'BATCH_NEXT_UNIT')
  const output=join(batchDirectory,'BATCH_'+unitId+'_RESULT.json'),rawPath=join(batchDirectory,'BATCH_'+unitId+'_RAW.jsonl')
  check(!existsSync(output)&&!existsSync(rawPath),'BATCH_OUTPUT_EXISTS')
  const index=binding.units.findIndex(u=>u.unitId===unitId),item=JSON.parse(readFileSync(binding.preparation.path)).preparations[index]
  check(item.unitId===unitId&&item.requestText===binding.requests[unitId],'BATCH_PREPARED_UNIT')
  validate()
  try{process.loadEnvFile(resolve('.env'))}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const recorder=await createRawRecorder(rawPath),origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex')
  let observedRaw
  try {
    const gateway=await createModelGateway({origin,capability,budget,requests:binding.requests,fetchImpl:createPinnedProxyFetch(),
      recordRaw:async row=>{check(row.unitId===unitId&&row.requestSha===binding.units[index].requestSha,'BATCH_RAW_IDENTITY')
        await recorder.write(row);observedRaw=row}})
    const start=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',
      headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},
      bodyText:JSON.stringify({unitId,requestSha:binding.units[index].requestSha})})
    let score=null,scoreError=null
    if(response.status===200)try{const ref=await closure.api.seenWire(closure.api.cases[index%8],item.handle)
      score=await closure.api.scoreSeenResponse(observedRaw.rawHttpText,item.context,ref.original.rawResponse,ref.original.context)
    }catch{scoreError='SCHEMA_OR_SCORER_REJECTED'}
    const after=await budget.snapshot(),reservation=after.reservations.find(r=>r.unitId===unitId)
    const report={version:'real-input-batch-unit-result-1',unitId,bindingSha:hash(bindingBytes),grantSha:hash(JSON.stringify(grant)),
      scorerSha:binding.scorerSha,actualScorerBundleSha:closure.bundleSha,responseSha:observedRaw?.responseSha??null,
      newAttempts:after.reservations.length-before.reservations.length,totalAttempts:after.reservations.length,
      lastHttpStatus:response.status,lastDiagnostic:response.diagnostic??null,lastWaitingMs:Date.now()-start,score,scoreError,
      unitCostUpperMicroCny:reservation?.costUpperMicroCny??0,costUpperMicroCny:after.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0),
      stopDispatch:response.status!==200||Boolean(after.batch?.stopped)||reservation?.status!=='settled',
      originalA01UnknownMicroCny:3300000,providerBilledCny:'NOT_OBSERVABLE',automaticSelection:'NOT_ENABLED',humanTime:'NOT_RUN',
      qualityClaim:'已见同源工程验证；首次建议原评分，不是盲测准确率。语义质量失败不伪装为安全事故。'}
    writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
    return {unitId,http:response.status,totalAttempts:report.totalAttempts,stopDispatch:report.stopDispatch,
      costUpperMicroCny:report.costUpperMicroCny,completeCase:score?.completeCase??null,scoreError}
  }finally{await recorder.close()}
}
/** New candidate text is fixed once. Original A contexts and original scorer stay read-only. */
export async function prepareCandidate02() {
  const oldBytes=readFileSync(join(runDirectory,'STATE.json')),old=JSON.parse(oldBytes)
  check(hash(oldBytes)==='d478c58f7f44e68a852bc7712c5d3e7994f2390750f5915d65204963dff9e73b','C02_ORIGINAL_BINDING')
  const closure=await compileBatchScorer(old),protection=inspectProtection({stage:'candidate02'})
  const prepared=JSON.parse(readFileSync(old.preparation.path)).preparations
  check(hash(readFileSync(old.preparation.path))===old.preparation.sha256,'C02_PREPARATION')
  const bundle=await build({stdin:{contents:"export {buildCandidate02Request,CANDIDATE02_VERSION} from './src/experiments/realInput01/candidate02.ts'",resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',target:'node24',metafile:true})
  const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
  const dependencies=Object.keys(bundle.metafile.inputs).filter(p=>p!=='<stdin>').map(path=>({path,sha256:hash(readFileSync(path))}))
  check(!dependencies.some(d=>/seenInputs|evaluation|fixture|expected/i.test(d.path)),'C02_ANSWER_DEPENDENCY')
  const requests={},units=[],items=[]
  for(let i=0;i<8;i++){
    const item=prepared[i],id=`C${String(i+1).padStart(2,'0')}`,built=await api.buildCandidate02Request(item.context),u=inspectRequest(built.serialized)
    check(item.unitId===`A${String(i+1).padStart(2,'0')}`&&item.requestText===old.requests[item.unitId]
      &&u.inputSha===old.units[i].inputSha,'C02_INPUT_DRIFT')
    requests[id]=built.serialized;units.push({unitId:id,candidateSha:u.candidateSha,inputSha:u.inputSha,requestSha:u.requestSha,requestBytes:u.requestBytes,scorerSha:old.scorerSha})
    items.push({unitId:id,originalUnitId:item.unitId,context:item.context,handle:item.handle})
  }
  check(new Set(units.map(u=>u.candidateSha)).size===1&&units[0].candidateSha!==old.units[0].candidateSha,'C02_CANDIDATE')
  const binding={version:'real-input-candidate02-binding-1',head:protection.head,promptVersion:api.CANDIDATE02_VERSION,
    originalBindingSha:hash(oldBytes),scorerSha:old.scorerSha,scorerBundleSha:closure.bundleSha,dependencies,requests,units,items}
  writeFileSync(join(CANDIDATE02_DIRECTORY,'BINDING.json'),JSON.stringify(binding,null,2)+'\n',{flag:'wx'})
  return {units:units.length,candidateSha:units[0].candidateSha,modelCalls:0}
}

export function verifyCandidate02Send({bindingBytes,binding,old,baseline,manifestBytes,billing,review,protection}) {
  check(isDeepStrictEqual(JSON.parse(bindingBytes),binding)&&binding.version==='real-input-candidate02-binding-1'
    &&binding.promptVersion==='real-input-source-semantics-2'&&binding.units.length===8,'C02_BINDING')
  check(binding.head===baseline.head&&protection.head===binding.head,'C02_HEAD')
  const sources=protection.sources.map(s=>({path:s.path,sha256:s.workingSha256}))
  verifyReviewBinding({head:protection.head,expectedHead:baseline.head,sources,review})
  check(review.scope==='CANDIDATE02_SEND'&&review.bindingSha===hash(bindingBytes)
    &&review.billingSha===hash(JSON.stringify(billing)),'C02_REVIEW_BINDING')
  check(binding.originalBindingSha===hash(readFileSync(join(runDirectory,'STATE.json')))
    &&binding.scorerSha===old.scorerSha&&binding.scorerBundleSha===JSON.parse(readFileSync(join(batchDirectory,'BATCH_SCORER_CLOSURE.json'))).bundleSha,'C02_SCORER')
  for(const d of binding.dependencies)check(hash(readFileSync(d.path))===d.sha256,'C02_CANDIDATE_CHANGED')
  for(const [i,u] of binding.units.entries()){
    const item=binding.items[i],parsed=inspectRequest(binding.requests[u.unitId])
    check(u.unitId===`C${String(i+1).padStart(2,'0')}`&&item.unitId===u.unitId
      &&u.inputSha===old.units[i].inputSha&&u.scorerSha===old.scorerSha
      &&['candidateSha','requestSha','inputSha','requestBytes'].every(k=>parsed[k]===u[k]),'C02_REQUEST')
    const original=JSON.parse(old.requests[old.units[i].unitId])
    check(isDeepStrictEqual(original.input[1],parsed.body.input[1])&&isDeepStrictEqual(original.text,parsed.body.text),'C02_TEXT_OR_SCHEMA')
  }
  check(isDeepStrictEqual(billing.policy,BILLING_POLICY)&&billing.verified===true&&billing.documents.length===2,'C02_BILLING')
  check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)
    &&Date.parse(billing.validUntil)-Date.parse(billing.checkedAt)<=86400000,'C02_BILLING_EXPIRED')
  for(const [i,d] of billing.documents.entries())check(d.url===[
    'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/','https://api-docs.deepseek.com/api/create-response/'][i]
    &&d.status===200&&hash(readFileSync(d.path))===d.sha256,'C02_PUBLIC_EVIDENCE')
  const originalLedger=readFileSync(baseline.ledger.path)
  check(hash(originalLedger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256&&baseline.ledger.sequence===34,'C02_LEDGER')
  const records=originalLedger.toString().trimEnd().split('\n').map(JSON.parse)
  return {version:'real-input-candidate02-grant-1',grantId:review.grantId,parentTail:baseline.ledger.tail,parentSequence:34,
    ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,manifestSha:hash(manifestBytes),
    bindingSha:hash(bindingBytes),head:protection.head,sourcesSha:hash(JSON.stringify(sources)),reviewSha:hash(JSON.stringify(review)),
    targets:binding.units,billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))},
    route:RECOVERY_ROUTE,priorNonce:records[1].event.nonce,a02ResponseSha:records[4].event.responseSha,maxTotalRequests:24}
}

export async function dispatchCandidate02(unitId) {
  check(/^C0[1-8]$/.test(unitId),'C02_UNIT')
  const read=name=>JSON.parse(readFileSync(join(CANDIDATE02_DIRECTORY,name)))
  const bindingBytes=readFileSync(join(CANDIDATE02_DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes)
  const baseline=read('BASELINE.json'),billing=read('BILLING.json'),review=read('SEND_REVIEW.json')
  const old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),manifestBytes=readFileSync(join(runDirectory,'REQUEST_MANIFEST.json'))
  const closure=await compileBatchScorer(old)
  const grant=verifyCandidate02Send({bindingBytes,binding,old,baseline,manifestBytes,billing,review,protection:inspectProtection({stage:'candidate02'})})
  const budget=await openBudget(runDirectory,hash(manifestBytes),{batchGrant:grant}),before=await budget.snapshot()
  check(binding.units[before.reservations.length-16]?.unitId===unitId&&!before.candidate02?.stopped
    &&before.reservations.slice(1).every(r=>r.status==='settled'),'C02_NEXT_UNIT')
  check(before.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+3300000<=10000000,'C02_BUDGET')
  const out=join(CANDIDATE02_DIRECTORY,unitId+'_RESULT.json'),rawPath=join(CANDIDATE02_DIRECTORY,unitId+'_RAW.jsonl')
  check(!existsSync(out)&&!existsSync(rawPath),'C02_OUTPUT_EXISTS')
  const index=binding.units.findIndex(u=>u.unitId===unitId),item=binding.items[index]
  // Only this explicit, reviewed one-unit dispatch reads the already authorized server configuration.
  try{process.loadEnvFile(resolve('.env'))}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const recorder=await createRawRecorder(rawPath),origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex')
  let observedRaw
  try{
    const gateway=await createModelGateway({origin,capability,budget,requests:{...old.requests,...binding.requests},fetchImpl:createPinnedProxyFetch(),
      recordRaw:async row=>{check(row.unitId===unitId&&row.requestSha===binding.units[index].requestSha,'C02_RAW');await recorder.write(row);observedRaw=row}})
    const start=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',
      headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},
      bodyText:JSON.stringify({unitId,requestSha:binding.units[index].requestSha})})
    let score=null,scoreError=null
    if(response.status===200)try{const reference=await closure.api.seenWire(closure.api.cases[index],item.handle)
      score=await closure.api.scoreSeenResponse(observedRaw.rawHttpText,item.context,reference.original.rawResponse,reference.original.context)
    }catch{scoreError='SCHEMA_OR_SCORER_REJECTED'}
    const after=await budget.snapshot(),reservation=after.reservations.find(r=>r.unitId===unitId)
    const result={version:'real-input-candidate02-result-1',unitId,promptVersion:binding.promptVersion,bindingSha:hash(bindingBytes),
      requestSha:binding.units[index].requestSha,responseSha:observedRaw?.responseSha??null,scorerSha:binding.scorerSha,
      lastHttpStatus:response.status,lastDiagnostic:response.diagnostic??null,lastWaitingMs:Date.now()-start,score,scoreError,
      totalAttempts:after.reservations.length,newAttempts:after.reservations.length-before.reservations.length,
      unitCostUpperMicroCny:reservation?.costUpperMicroCny??0,costUpperMicroCny:after.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0),
      stopDispatch:response.status!==200||Boolean(after.candidate02?.stopped)||reservation?.status!=='settled',
      providerBilledCny:'NOT_OBSERVABLE',automaticSelection:'NOT_ENABLED',humanTime:'NOT_RUN',qualityClaim:'8份已见开发通知；非盲测'}
    writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
    return {unitId,http:response.status,stopDispatch:result.stopDispatch,totalAttempts:result.totalAttempts,completeCase:score?.completeCase??null,scoreError,upper:result.costUpperMicroCny}
  }finally{await recorder.close()}
}

/** New candidate text is fixed once. Original A contexts and original scorer stay read-only. */
export async function prepareCandidate03() {
  const oldBytes=readFileSync(join(runDirectory,'STATE.json')),old=JSON.parse(oldBytes)
  check(hash(oldBytes)==='d478c58f7f44e68a852bc7712c5d3e7994f2390750f5915d65204963dff9e73b','C03_ORIGINAL_BINDING')
  const closure=await compileBatchScorer(old),protection=inspectProtection({stage:'candidate03'})
  const prepared=JSON.parse(readFileSync(old.preparation.path)).preparations
  check(hash(readFileSync(old.preparation.path))===old.preparation.sha256,'C03_PREPARATION')
  const bundle=await build({stdin:{contents:"export {buildCandidate03Request,CANDIDATE03_VERSION} from './src/experiments/realInput01/candidate03.ts'",resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',target:'node24',metafile:true})
  const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
  const dependencies=Object.keys(bundle.metafile.inputs).filter(p=>p!=='<stdin>').map(path=>({path,sha256:hash(readFileSync(path))}))
  check(!dependencies.some(d=>/seenInputs|evaluation|fixture|expected/i.test(d.path)),'C03_ANSWER_DEPENDENCY')
  const requests={},units=[],items=[]
  for(let i=0;i<8;i++){
    const item=prepared[i],id=`D${String(i+1).padStart(2,'0')}`,built=await api.buildCandidate03Request(item.context),u=inspectRequest(built.serialized)
    check(item.unitId===`A${String(i+1).padStart(2,'0')}`&&item.requestText===old.requests[item.unitId]
      &&u.inputSha===old.units[i].inputSha,'C03_INPUT_DRIFT')
    requests[id]=built.serialized;units.push({unitId:id,candidateSha:u.candidateSha,inputSha:u.inputSha,requestSha:u.requestSha,requestBytes:u.requestBytes,scorerSha:old.scorerSha})
    items.push({unitId:id,originalUnitId:item.unitId,context:item.context,handle:item.handle})
  }
  check(new Set(units.map(u=>u.candidateSha)).size===1&&units[0].candidateSha!==old.units[0].candidateSha
    &&units[0].candidateSha!==JSON.parse(readFileSync(join(CANDIDATE02_DIRECTORY,'BINDING.json'))).units[0].candidateSha,'C03_CANDIDATE')
  const binding={version:'real-input-candidate03-binding-1',head:protection.head,promptVersion:api.CANDIDATE03_VERSION,
    originalBindingSha:hash(oldBytes),scorerSha:old.scorerSha,scorerBundleSha:closure.bundleSha,dependencies,requests,units,items}
  writeFileSync(join(CANDIDATE03_DIRECTORY,'BINDING.json'),JSON.stringify(binding,null,2)+'\n',{flag:'wx'})
  return {units:units.length,candidateSha:units[0].candidateSha,modelCalls:0}
}

export function verifyCandidate03Send({bindingBytes,binding,old,baseline,manifestBytes,billing,review,protection}) {
  check(isDeepStrictEqual(JSON.parse(bindingBytes),binding)&&binding.version==='real-input-candidate03-binding-1'
    &&binding.promptVersion==='real-input-source-semantics-3'&&binding.units.length===8,'C03_BINDING')
  check(binding.head===baseline.head&&protection.head===binding.head,'C03_HEAD')
  const sources=protection.sources.map(s=>({path:s.path,sha256:s.workingSha256}))
  verifyReviewBinding({head:protection.head,expectedHead:baseline.head,sources,review})
  check(review.scope==='CANDIDATE03_SEND'&&review.bindingSha===hash(bindingBytes)
    &&review.billingSha===hash(JSON.stringify(billing)),'C03_REVIEW_BINDING')
  check(binding.originalBindingSha===hash(readFileSync(join(runDirectory,'STATE.json')))
    &&binding.scorerSha===old.scorerSha&&binding.scorerBundleSha===JSON.parse(readFileSync(join(batchDirectory,'BATCH_SCORER_CLOSURE.json'))).bundleSha,'C03_SCORER')
  for(const d of binding.dependencies)check(hash(readFileSync(d.path))===d.sha256,'C03_CANDIDATE_CHANGED')
  for(const [i,u] of binding.units.entries()){
    const item=binding.items[i],parsed=inspectRequest(binding.requests[u.unitId])
    check(u.unitId===`D${String(i+1).padStart(2,'0')}`&&item.unitId===u.unitId
      &&u.inputSha===old.units[i].inputSha&&u.scorerSha===old.scorerSha
      &&['candidateSha','requestSha','inputSha','requestBytes'].every(k=>parsed[k]===u[k]),'C03_REQUEST')
    const original=JSON.parse(old.requests[old.units[i].unitId])
    check(isDeepStrictEqual(original.input[1],parsed.body.input[1])&&isDeepStrictEqual(original.text,parsed.body.text),'C03_TEXT_OR_SCHEMA')
  }
  check(isDeepStrictEqual(billing.policy,BILLING_POLICY)&&billing.verified===true&&billing.documents.length===2,'C03_BILLING')
  check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)
    &&Date.parse(billing.validUntil)-Date.parse(billing.checkedAt)<=86400000,'C03_BILLING_EXPIRED')
  for(const [i,d] of billing.documents.entries())check(d.url===[
    'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/','https://api-docs.deepseek.com/api/create-response/'][i]
    &&d.status===200&&hash(readFileSync(d.path))===d.sha256,'C03_PUBLIC_EVIDENCE')
  const originalLedger=readFileSync(baseline.ledger.path)
  check(hash(originalLedger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256&&baseline.ledger.sequence===51,'C03_LEDGER')
  const records=originalLedger.toString().trimEnd().split('\n').map(JSON.parse)
  return {version:'real-input-candidate03-grant-1',grantId:review.grantId,parentTail:baseline.ledger.tail,parentSequence:51,
    ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,manifestSha:hash(manifestBytes),
    bindingSha:hash(bindingBytes),head:protection.head,sourcesSha:hash(JSON.stringify(sources)),reviewSha:hash(JSON.stringify(review)),
    targets:binding.units,billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))},
    route:RECOVERY_ROUTE,priorNonce:records[1].event.nonce,a02ResponseSha:records[4].event.responseSha,maxTotalRequests:32}
}

export async function dispatchCandidate03(unitId) {
  check(/^D0[1-8]$/.test(unitId),'C03_UNIT')
  const read=name=>JSON.parse(readFileSync(join(CANDIDATE03_DIRECTORY,name)))
  const bindingBytes=readFileSync(join(CANDIDATE03_DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes)
  const baseline=read('BASELINE.json'),billing=read('BILLING.json'),review=read('SEND_REVIEW_2.json')
  const old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),manifestBytes=readFileSync(join(runDirectory,'REQUEST_MANIFEST.json'))
  const closure=await compileBatchScorer(old)
  const grant=verifyCandidate03Send({bindingBytes,binding,old,baseline,manifestBytes,billing,review,protection:inspectProtection({stage:'candidate03'})})
  const budget=await openBudget(runDirectory,hash(manifestBytes),{batchGrant:grant}),before=await budget.snapshot()
  check(binding.units[before.reservations.length-24]?.unitId===unitId&&!before.candidate03?.stopped
    &&before.reservations.slice(1).every(r=>r.status==='settled'),'C03_NEXT_UNIT')
  check(before.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+3300000<=10000000,'C03_BUDGET')
  // Keep the local pre-reservation D01 rejection verbatim; actual dispatch uses new artifacts.
  const out=join(CANDIDATE03_DIRECTORY,unitId+'_DISPATCH_RESULT.json'),rawPath=join(CANDIDATE03_DIRECTORY,unitId+'_DISPATCH_RAW.jsonl')
  check(!existsSync(out)&&!existsSync(rawPath),'C03_OUTPUT_EXISTS')
  const index=binding.units.findIndex(u=>u.unitId===unitId),item=binding.items[index]
  // Only this explicit, reviewed one-unit dispatch reads the already authorized server configuration.
  try{process.loadEnvFile(resolve('.env'))}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const recorder=await createRawRecorder(rawPath),origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex')
  let observedRaw
  try{
    const gateway=await createModelGateway({origin,capability,budget,requests:{...old.requests,...JSON.parse(readFileSync(join(CANDIDATE02_DIRECTORY,'BINDING.json'))).requests,...binding.requests},fetchImpl:createPinnedProxyFetch(),
      recordRaw:async row=>{check(row.unitId===unitId&&row.requestSha===binding.units[index].requestSha,'C03_RAW');await recorder.write(row);observedRaw=row}})
    const start=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',
      headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},
      bodyText:JSON.stringify({unitId,requestSha:binding.units[index].requestSha})})
    let score=null,scoreError=null
    if(response.status===200)try{const reference=await closure.api.seenWire(closure.api.cases[index],item.handle)
      score=await closure.api.scoreSeenResponse(observedRaw.rawHttpText,item.context,reference.original.rawResponse,reference.original.context)
    }catch{scoreError='SCHEMA_OR_SCORER_REJECTED'}
    const after=await budget.snapshot(),reservation=after.reservations.find(r=>r.unitId===unitId)
    const result={version:'real-input-candidate03-result-1',unitId,promptVersion:binding.promptVersion,bindingSha:hash(bindingBytes),
      requestSha:binding.units[index].requestSha,responseSha:observedRaw?.responseSha??null,scorerSha:binding.scorerSha,
      lastHttpStatus:response.status,lastDiagnostic:response.diagnostic??null,lastWaitingMs:Date.now()-start,score,scoreError,
      totalAttempts:after.reservations.length,newAttempts:after.reservations.length-before.reservations.length,
      unitCostUpperMicroCny:reservation?.costUpperMicroCny??0,costUpperMicroCny:after.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0),
      stopDispatch:response.status!==200||Boolean(after.candidate03?.stopped)||reservation?.status!=='settled',
      providerBilledCny:'NOT_OBSERVABLE',automaticSelection:'NOT_ENABLED',humanTime:'NOT_RUN',qualityClaim:'8份已见开发通知；非盲测'}
    writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
    return {unitId,http:response.status,stopDispatch:result.stopDispatch,totalAttempts:result.totalAttempts,completeCase:score?.completeCase??null,scoreError,upper:result.costUpperMicroCny}
  }finally{await recorder.close()}
}

const pairedRead=name=>JSON.parse(readFileSync(join(PAIRED04_DIRECTORY,name)))
async function pairedApi(){
  const bundle=await build({stdin:{contents:`export {buildCandidate03Request} from './src/experiments/realInput01/candidate03.ts';
    export {buildCandidate04Request} from './src/experiments/realInput01/candidate04.ts';
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
    export {adaptModelWire, WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';
    export {workspaceSnapshotHash} from './src/domain/v2/migration.ts';`,resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',metafile:true})
  const dependencies=Object.keys(bundle.metafile.inputs).filter(p=>p!=='<stdin>').map(path=>({path,sha256:hash(readFileSync(path))}))
  check(!dependencies.some(d=>/seenInputs|evaluation|fixture|expected/i.test(d.path)),'P04_ANSWER_IN_REQUEST_DEPENDENCIES')
  return {dependencies,api:await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'))}
}
/** Reference-only expansion. This function is not imported into a product or request builder. */
function pairedReference(spec,context,api){
  const all=context.index.scopes,used=new Set()
  const scopes=quotes=>[...new Set(quotes.map(q=>{const matches=all.filter(s=>s.text.includes(q));check(matches.length===1,'P04_REFERENCE_SCOPE:'+q);used.add(matches[0].id);return matches[0].id}))]
  const surface=(value,task)=>{const candidates=all.filter(s=>task.scopes.some(q=>s.text.includes(q))&&s.text.includes(value));check(candidates.length>0,'P04_REFERENCE_SURFACE:'+value);used.add(candidates[0].id);return{surface:value,scopeId:candidates[0].id}}
  const actionTypes={上传:'upload',交还:'other',检查:'review',保存:'save',领取:'collect',阅读:'review',提交:'submit',确认:'review',报名:'register',递交:'submit',填写:'fill',制作:'prepare',整理:'complete',参加:'attend',发送:'send',寄送:'send',寄:'send'}
  const effects={upload:'external_transfer',submit:'external_transfer',send:'external_transfer',collect:'physical_action',attend:'physical_action',register:'external_interaction',review:'local_change',save:'local_change',fill:'local_change',prepare:'local_change',complete:'local_change',other:'unknown'}
  const materials=(spec.materials??[]).map(m=>({tempId:m.id,name:m.name,required:m.required!==false,formatRequirements:m.format??[],namingRequirements:m.naming??[],quantity:m.quantity??null,submissionChannel:m.channel??null,relatedTaskTempIds:m.tasks,scopeIds:scopes(m.scopes),confidence:1}))
  const timePoints=(spec.times??[]).map(t=>({tempId:t.id,type:t.type,rawText:t.raw,relatedTaskTempIds:t.tasks,relatedMaterialTempIds:t.materials??[],scopeIds:scopes([t.raw]),confidence:1}))
  const events=(spec.events??[]).map(e=>({tempId:e.id,title:e.title,description:'',startTimePointTempId:e.start??null,endTimePointTempId:e.end??null,location:e.location??null,scopeIds:scopes(e.scopes),confidence:1,inferenceLevel:'explicit',relatedTaskTempIds:e.tasks}))
  const tasks=spec.tasks.map(t=>{const time=timePoints.filter(x=>x.relatedTaskTempIds.includes(t.id)).map(x=>x.tempId),mat=materials.filter(x=>x.relatedTaskTempIds.includes(t.id)).map(x=>x.tempId),ev=events.filter(x=>x.relatedTaskTempIds.includes(t.id)).map(x=>x.tempId),at=t.actionType??actionTypes[t.action];check(at,'P04_REFERENCE_ACTION')
    return{id:t.id,propositionScopeIds:scopes(t.scopes),action:surface(t.action,t),object:surface(t.object,t),actionType:at,effect:t.effect??effects[at],inferenceLevel:'explicit',
      semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:'future',status:t.status??'pending',validity:t.validity??'active',modality:'required'},
      detail:{parentTempId:null,hierarchyType:'task',title:t.action+t.object,description:'',completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:mat,timePointTempIds:time,confidence:1,userConfirmationRequired:true},
      condition:t.condition?{value:t.condition.value,conditionScopeIds:scopes(t.condition.condition),factScopeIds:scopes(t.condition.facts)}:{value:'not_applicable',conditionScopeIds:[],factScopeIds:[]},
      coverage:{time:time.length?'present':'not_stated',material:mat.length?'present':'not_stated',event:ev.length?'present':'not_stated'},eventTempIds:ev}})
  const revisions=(spec.revisions??[]).map(r=>({type:r.type,targetDirectiveId:r.target,fromDirectiveId:r.from,effective:'true',scopeIds:scopes(r.scopes)}))
  const wire={schemaVersion:api.WIRE_VERSION,tasks,materials,timePoints,events,revisions,conflicts:[],informationScopeIds:all.filter(s=>!used.has(s.id)).map(s=>s.id),unresolvedScopeIds:[]}
  return api.adaptModelWire(wire,context).adapted
}
export async function preparePaired04(){
  const protection=inspectProtection({stage:'paired04'}),freeze=pairedRead('CANDIDATE_FREEZE.json'),inputs=pairedRead('INPUTS.json'),reference=pairedRead('REFERENCE_SPEC.json')
  check(hash(readFileSync('src/experiments/realInput01/candidate04.ts'))===freeze.sourceSha256&&inputs.createdAfterCandidateFreeze===freeze.sourceSha256,'P04_CANDIDATE_FIXED')
  check(inputs.items.length===12&&reference.items.length===12&&new Set(inputs.items.map(i=>i.text)).size===12,'P04_INPUT_COUNT')
  for(const f of freeze.dependencies)check(hash(readFileSync(f.path))===f.sha256,'P04_FROZEN_DEPENDENCY')
  const {api,dependencies}=await pairedApi(),old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),closure=await compileBatchScorer(old)
  const requests={},units=[],items=[],references=[]
  for(const [i,item]of inputs.items.entries()){
    check(item.id===`N${String(i+1).padStart(2,'0')}`&&reference.items[i].id===item.id,'P04_INPUT_ID')
    const operationId='paired04-source-'+item.id,sourceId='source:'+api.workspaceSnapshotHash(operationId).slice('fnv1a32:'.length),sourceVersionId=sourceId+':version:1'
    const context={index:await api.indexImmutableScopesV11(sourceId,sourceVersionId,item.text),referenceTime:inputs.referenceTime,timezone:inputs.timezone}
    // Balanced order: each notification is a block; odd/even blocks reverse the two arms.
    for(const arm of i%2?['04','03']:['03','04']){
      const id=item.id+'-'+arm,built=await api[arm==='03'?'buildCandidate03Request':'buildCandidate04Request'](context),u=inspectRequest(built.serialized)
      requests[id]=built.serialized;units.push({unitId:id,candidateSha:u.candidateSha,inputSha:u.inputSha,requestSha:u.requestSha,requestBytes:u.requestBytes,scorerSha:old.scorerSha})
    }
    items.push({id:item.id,operationId,context,title:item.text.split('\n')[0]})
    references.push({id:item.id,context,response:pairedReference(reference.items[i],context,api)})
  }
  const referenceText=JSON.stringify({label:'人工参考，仅评分，不进入发送及产品',items:references},null,2)+'\n'
  const bindings=['INPUTS.json','REFERENCE_SPEC.json','CANDIDATE_FREEZE.json'].map(name=>({path:join(PAIRED04_DIRECTORY,name),sha256:hash(readFileSync(join(PAIRED04_DIRECTORY,name)))}))
  const binding={version:'real-input-paired04-binding-1',head:protection.head,dependencies,files:bindings,referenceSha:hash(referenceText),scorerSha:old.scorerSha,scorerBundleSha:closure.bundleSha,requests,units,items,
    label:'12新合成通知首次开发配对验证，非独立盲测；24输出不是24独立通知',order:'N01..N12; odd 03/04, even 04/03',createdAt:new Date().toISOString()}
  writeFileSync(join(PAIRED04_DIRECTORY,'REFERENCES.json'),referenceText,{flag:'wx'})
  writeFileSync(join(PAIRED04_DIRECTORY,'BINDING.json'),JSON.stringify(binding,null,2)+'\n',{flag:'wx'})
  return{inputs:12,units:24,referenceTasks:references.reduce((n,r)=>n+r.response.tasks.length,0),bindingSha:hash(JSON.stringify(binding,null,2)+'\n'),modelCalls:0}
}
export function verifyPaired04Send({bindingBytes,binding,baseline,billing,review,protection}){
  check(isDeepStrictEqual(JSON.parse(bindingBytes),binding)&&binding.version==='real-input-paired04-binding-1'&&binding.units.length===24&&binding.items.length===12,'P04_BINDING')
  check(binding.head===baseline.head&&protection.head===binding.head,'P04_HEAD')
  const sources=protection.sources.map(s=>({path:s.path,sha256:s.workingSha256}))
  verifyReviewBinding({head:protection.head,expectedHead:baseline.head,sources,review})
  check(review.scope==='PAIRED04_SEND'&&review.bindingSha===hash(bindingBytes)&&review.billingSha===hash(JSON.stringify(billing)),'P04_REVIEW')
  for(const d of [...binding.dependencies,...binding.files])check(hash(readFileSync(d.path))===d.sha256,'P04_DEPENDENCY_CHANGED')
  check(hash(readFileSync(join(PAIRED04_DIRECTORY,'REFERENCES.json')))===binding.referenceSha,'P04_REFERENCE_CHANGED')
  const old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),oldD=JSON.parse(readFileSync(join(CANDIDATE03_DIRECTORY,'BINDING.json')))
  check(binding.scorerSha===old.scorerSha&&binding.scorerBundleSha===oldD.scorerBundleSha,'P04_SCORER')
  for(const [i,item]of binding.items.entries()){
    const pair=binding.units.slice(i*2,i*2+2),expected=(i%2?['04','03']:['03','04']).map(a=>item.id+'-'+a)
    check(isDeepStrictEqual(pair.map(u=>u.unitId),expected),'P04_ORDER')
    for(const u of pair){const p=inspectRequest(binding.requests[u.unitId]);check(['candidateSha','requestSha','inputSha','requestBytes'].every(k=>p[k]===u[k])&&u.scorerSha===binding.scorerSha,'P04_REQUEST')
      check(isDeepStrictEqual(JSON.parse(p.body.input[1].content[0].text),{source:item.context.index.sourceContent,referenceTime:item.context.referenceTime,timezone:item.context.timezone,scopes:item.context.index.scopes.map(s=>({id:s.id,text:s.text}))}),'P04_SOURCE')
      if(u.unitId.endsWith('-03'))check(u.candidateSha===oldD.units[0].candidateSha,'P04_OLD_CANDIDATE')
    }
    const a=JSON.parse(binding.requests[pair[0].unitId]),b=JSON.parse(binding.requests[pair[1].unitId])
    check(isDeepStrictEqual({...a,input:[a.input[1]]},{...b,input:[b.input[1]]}),'P04_PAIR_PARAMETERS')
  }
  check(billing.verified===true&&isDeepStrictEqual(billing.policy,BILLING_POLICY)&&billing.documents.length===2,'P04_BILLING')
  check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)&&Date.parse(billing.validUntil)-Date.parse(billing.checkedAt)<=86400000,'P04_PRICE_EXPIRED')
  for(const [i,d]of billing.documents.entries())check(d.status===200&&d.url===['https://api-docs.deepseek.com/zh-cn/quick_start/pricing/','https://api-docs.deepseek.com/api/create-response/'][i]&&hash(readFileSync(d.path))===d.sha256,'P04_PRICE_DOCUMENT')
  const ledger=readFileSync(baseline.ledger.path),rows=ledger.toString().trimEnd().split('\n').map(JSON.parse)
  check(baseline.ledger.sequence===68&&hash(ledger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256,'P04_LEDGER')
  const grant={version:'real-input-paired04-grant-1',grantId:review.grantId,parentTail:baseline.ledger.tail,parentSequence:68,ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,
    manifestSha:hash(readFileSync(join(runDirectory,'REQUEST_MANIFEST.json'))),bindingSha:hash(bindingBytes),head:binding.head,sourcesSha:hash(JSON.stringify(sources)),reviewSha:hash(JSON.stringify(review)),
    targets:binding.units,billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))},route:RECOVERY_ROUTE,priorNonce:rows[1].event.nonce,a02ResponseSha:rows[4].event.responseSha,maxTotalRequests:56}
  const existing=rows.find(r=>r.event.kind==='paired04Grant')?.event.grant
  if(existing){
    // A read-only-checker correction does not rewrite the durable grant or its
    // original code review. The new code review must explicitly bind that grant.
    const identity=g=>Object.fromEntries(Object.entries(g).filter(([k])=>!['sourcesSha','reviewSha'].includes(k)))
    check(isDeepStrictEqual(identity(existing),identity(grant)),'P04_DURABLE_GRANT_CHANGED')
    check(review.previousGrantSha===hash(JSON.stringify(existing))||existing.reviewSha===hash(JSON.stringify(review)),'P04_CONTINUATION_REVIEW')
    return existing
  }
  return grant
}
export async function dispatchPaired04(unitId){
  check(/^N(?:0[1-9]|1[0-2])-(03|04)$/.test(unitId),'P04_UNIT')
  const bytes=readFileSync(join(PAIRED04_DIRECTORY,'BINDING.json')),binding=JSON.parse(bytes),baseline=pairedRead('BASELINE.json'),billing=pairedRead('BILLING.json'),review=pairedRead(existsSync(join(PAIRED04_DIRECTORY,'SEND_CONTINUATION_REVIEW.json'))?'SEND_CONTINUATION_REVIEW.json':'SEND_REVIEW.json')
  const grant=verifyPaired04Send({bindingBytes:bytes,binding,baseline,billing,review,protection:inspectProtection({stage:'paired04'})})
  const old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),closure=await compileBatchScorer(old)
  const budget=await openBudget(runDirectory,grant.manifestSha,{batchGrant:grant}),before=await budget.snapshot(),index=before.reservations.length-32
  check(binding.units[index]?.unitId===unitId&&!before.paired04?.stopped&&before.reservations.slice(1).every(r=>r.status==='settled'),'P04_NEXT')
  check(before.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+3300000<=10000000,'P04_BUDGET')
  const rawPath=join(PAIRED04_DIRECTORY,unitId+'_RAW.jsonl'),resultPath=join(PAIRED04_DIRECTORY,unitId+'_RESULT.json')
  check(!existsSync(rawPath)&&!existsSync(resultPath),'P04_ALREADY_ATTEMPTED')
  // Only this explicit dispatch reads the server credential. No probe or retry.
  try{process.loadEnvFile(resolve('.env'))}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const recorder=await createRawRecorder(rawPath),origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex');let observed
  try{
    const requests={...old.requests,...JSON.parse(readFileSync(join(CANDIDATE02_DIRECTORY,'BINDING.json'))).requests,...JSON.parse(readFileSync(join(CANDIDATE03_DIRECTORY,'BINDING.json'))).requests,...binding.requests}
    const gateway=await createModelGateway({origin,capability,budget,requests,fetchImpl:createPinnedProxyFetch(),recordRaw:async row=>{check(row.unitId===unitId&&row.requestSha===binding.units[index].requestSha,'P04_RAW_IDENTITY');await recorder.write(row);observed=row}})
    const start=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},bodyText:JSON.stringify({unitId,requestSha:binding.units[index].requestSha})})
    let score=null,scoreError=null
    const item=binding.items.find(i=>i.id===unitId.slice(0,3)),reference=pairedRead('REFERENCES.json').items.find(i=>i.id===item.id)
    if(response.status===200)try{score=await closure.api.scoreSeenResponse(observed.rawHttpText,item.context,reference.response,reference.context)}catch{scoreError='SCHEMA_OR_SCORER_REJECTED'}
    const after=await budget.snapshot(),r=after.reservations.find(r=>r.unitId===unitId)
    const result={unitId,arm:unitId.slice(-2),bindingSha:hash(bytes),requestSha:binding.units[index].requestSha,responseSha:observed?.responseSha??null,scorerSha:binding.scorerSha,referenceSha:binding.referenceSha,
      http:response.status,diagnostic:response.diagnostic??null,waitingMs:Date.now()-start,score,scoreError,totalAttempts:after.reservations.length,newAttempts:after.reservations.length-before.reservations.length,
      costUpperMicroCny:r?.costUpperMicroCny??0,totalCostUpperMicroCny:after.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0),
      stopDispatch:response.status!==200||Boolean(after.paired04?.stopped)||r?.status!=='settled',providerBilledCny:'NOT_OBSERVABLE',automaticSelection:'NOT_ENABLED',qualityClaim:binding.label}
    writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
    return{unitId,http:result.http,stopDispatch:result.stopDispatch,scoreError,totalAttempts:result.totalAttempts,waitingMs:result.waitingMs,costUpperMicroCny:result.costUpperMicroCny}
  }finally{await recorder.close()}
}

const read05=name=>JSON.parse(readFileSync(join(PAIRED05_DIRECTORY,name)))
export async function paired05Api(){
  const compiled=await build({stdin:{contents:`export {buildFlash41ComparisonRequest} from './src/experiments/realInput01/candidate05.ts';
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
    export {adaptModelWire,parseModelEnvelope,projectSemantic,WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';
    export {workspaceSnapshotHash} from './src/domain/v2/migration.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',metafile:true})
  const dependencies=Object.keys(compiled.metafile.inputs).filter(p=>p!=='<stdin>').map(path=>({path,sha256:hash(readFileSync(path))}))
  check(!dependencies.some(d=>/seenInputs|evaluation|fixture|expected/i.test(d.path)),'P05_ANSWER_IN_REQUEST')
  return {dependencies,api:await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))}
}
/** Original scorer in a byte-verified, in-memory historical closure; never overwrites its files. */
export async function compileOriginalScorer05(){
  const baseline=read05('BASELINE.json'),frozen=JSON.parse(readFileSync(join(batchDirectory,'BATCH_SCORER_CLOSURE.json'))),files=new Map()
  for(const d of frozen.usedDependencies){
    let bytes=readFileSync(d.path)
    if(hash(bytes)!==d.sha256){
      const blob=execFileSync('git',['show',baseline.head+':'+d.path],{windowsHide:true})
      bytes=[blob,Buffer.from(blob.toString().replace(/\r?\n/g,'\r\n'))].find(b=>hash(b)===d.sha256)
    }
    check(bytes&&hash(bytes)===d.sha256,'P05_HISTORICAL_SCORER_SHA');files.set(resolve(d.path),bytes)
  }
  const compiled=await build({stdin:{contents:scorerEntry,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node24',metafile:true,
    plugins:[{name:'exact-historical-scorer',setup(b){b.onLoad({filter:/\.ts$/},args=>{const bytes=files.get(args.path);check(bytes,'P05_UNFROZEN_SCORER_IMPORT');return{contents:bytes.toString(),loader:'ts',resolveDir:dirname(args.path)}})}}]})
  check(hash(compiled.outputFiles[0].contents)===frozen.bundleSha,'P05_SCORER_BUNDLE_CHANGED')
  return {bundleSha:frozen.bundleSha,dependencies:frozen.usedDependencies,api:await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))}
}
export function paired05Order(seed=20260912){
  let n=seed>>>0;const order=Array.from({length:12},(_,i)=>i<6?['03','05']:['05','03'])
  for(let i=order.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[order[i],order[j]]=[order[j],order[i]]}
  return order
}
export async function preparePaired05(){
  const protection=inspectProtection({stage:'paired05'}),freeze=read05('CANDIDATE_FREEZE.json'),inputs=read05('INPUTS.json'),reference=read05('REFERENCE_SPEC.json')
  for(const d of freeze.dependencies)check(hash(readFileSync(d.path))===d.sha256,'P05_CANDIDATE_FIXED')
  check(inputs.createdAfterCandidateFreeze===hash(JSON.stringify(freeze))&&inputs.items.length===12&&reference.items.length===12&&new Set(inputs.items.map(i=>i.text)).size===12,'P05_INPUTS')
  const {api,dependencies}=await paired05Api(),closure=await compileOriginalScorer05(),old=JSON.parse(readFileSync(join(runDirectory,'STATE.json')))
  const requests={},units=[],items=[],references=[],order=paired05Order(inputs.seed)
  for(const [i,item]of inputs.items.entries()){
    check(item.id===`P${String(i+1).padStart(2,'0')}`&&reference.items[i].id===item.id,'P05_ID')
    const operationId='paired05-source-'+item.id,sourceId='source:'+api.workspaceSnapshotHash(operationId).slice('fnv1a32:'.length),sourceVersionId=sourceId+':version:1'
    const context={index:await api.indexImmutableScopesV11(sourceId,sourceVersionId,item.text),referenceTime:inputs.referenceTime,timezone:inputs.timezone}
    for(const arm of order[i]){const id=item.id+'-'+arm,built=await api.buildFlash41ComparisonRequest(context,arm),u=inspectRequest(built.serialized,FLASH41_POLICY)
      requests[id]=built.serialized;units.push({unitId:id,candidateSha:u.candidateSha,inputSha:u.inputSha,requestSha:u.requestSha,requestBytes:u.requestBytes,scorerSha:old.scorerSha})}
    items.push({id:item.id,operationId,context,title:item.text.split('\n')[0]})
    try{references.push({id:item.id,context,response:pairedReference(reference.items[i],context,api)})}
    catch(e){throw Error('P05_REFERENCE_'+item.id+': '+e.message)}
  }
  const refText=JSON.stringify({label:'人工参考仅评分，不进入请求或产品',items:references},null,2)+'\n'
  const files=['INPUTS.json','REFERENCE_SPEC.json','CANDIDATE_FREEZE.json','COMPARISON_RULES.md'].map(name=>({path:join(PAIRED05_DIRECTORY,name),sha256:hash(readFileSync(join(PAIRED05_DIRECTORY,name)))}))
  const binding={version:'real-input-paired05-binding-1',head:protection.head,dependencies,files,referenceSha:hash(refText),scorerSha:old.scorerSha,scorerBundleSha:closure.bundleSha,requests,units,items,seed:inputs.seed,order,
    label:'12新合成通知首次开发配对验证，非独立盲测；24请求不是24独立通知',createdAt:new Date().toISOString()}
  writeFileSync(join(PAIRED05_DIRECTORY,'REFERENCES.json'),refText,{flag:'wx'});writeFileSync(join(PAIRED05_DIRECTORY,'BINDING.json'),JSON.stringify(binding,null,2)+'\n',{flag:'wx'})
  return {notices:12,requests:24,bindingSha:hash(JSON.stringify(binding,null,2)+'\n'),modelCalls:0}
}
export function verifyPaired05Send({bindingBytes,binding,baseline,billing,review,protection}){
  check(isDeepStrictEqual(JSON.parse(bindingBytes),binding)&&binding.version==='real-input-paired05-binding-1'&&binding.items.length===12&&binding.units.length===24,'P05_BINDING')
  const sources=protection.sources.map(s=>({path:s.path,sha256:s.workingSha256}))
  verifyReviewBinding({head:protection.head,expectedHead:baseline.head,sources,review})
  check(binding.head===baseline.head&&review.scope==='PAIRED05_SEND'&&review.bindingSha===hash(bindingBytes)&&review.billingSha===hash(JSON.stringify(billing)),'P05_REVIEW')
  for(const d of [...binding.dependencies,...binding.files])check(hash(readFileSync(d.path))===d.sha256,'P05_DEPENDENCY')
  check(hash(readFileSync(join(PAIRED05_DIRECTORY,'REFERENCES.json')))===binding.referenceSha,'P05_REFERENCE')
  const old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),old04=pairedRead('BINDING.json')
  check(binding.scorerSha===old.scorerSha&&binding.scorerBundleSha===old04.scorerBundleSha&&isDeepStrictEqual(binding.order,paired05Order(binding.seed)),'P05_SCORER_ORDER')
  for(const [i,item]of binding.items.entries()){
    const pair=binding.units.slice(i*2,i*2+2);check(isDeepStrictEqual(pair.map(u=>u.unitId),binding.order[i].map(a=>item.id+'-'+a)),'P05_ORDER')
    for(const u of pair){const p=inspectRequest(binding.requests[u.unitId],FLASH41_POLICY)
      check(['candidateSha','requestSha','inputSha','requestBytes'].every(k=>p[k]===u[k])&&u.scorerSha===binding.scorerSha,'P05_REQUEST')
      check(isDeepStrictEqual(JSON.parse(p.body.input[1].content[0].text),{source:item.context.index.sourceContent,referenceTime:item.context.referenceTime,timezone:item.context.timezone,scopes:item.context.index.scopes.map(s=>({id:s.id,text:s.text}))}),'P05_SOURCE')}
    const comparable=t=>{const x=JSON.parse(t);return {...x,input:[x.input[1]],text:undefined}}
    check(isDeepStrictEqual(comparable(binding.requests[pair[0].unitId]),comparable(binding.requests[pair[1].unitId])),'P05_PARAMETERS')
  }
  check(billing.verified===true&&isDeepStrictEqual(billing.policy,FLASH41_POLICY)&&billing.method==='official-public-document-review','P05_BILLING')
  check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)&&Date.parse(billing.validUntil)-Date.parse(billing.checkedAt)<=86400000,'P05_PRICE_EXPIRED')
  check(billing.documents.length===1&&hash(readFileSync(billing.documents[0].path))===billing.documents[0].sha256,'P05_PRICE_EVIDENCE')
  const ledger=readFileSync(baseline.ledger.path),rows=ledger.toString().trimEnd().split('\n').map(JSON.parse)
  check(baseline.ledger.sequence===117&&hash(ledger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256,'P05_LEDGER_PREFIX')
  const grant={version:'real-input-paired05-grant-1',grantId:review.grantId,parentTail:rows[116].hash,parentSequence:117,ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,
    manifestSha:hash(readFileSync(join(runDirectory,'REQUEST_MANIFEST.json'))),bindingSha:hash(bindingBytes),head:binding.head,sourcesSha:hash(JSON.stringify(sources)),reviewSha:hash(JSON.stringify(review)),
    targets:binding.units,billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))},route:RECOVERY_ROUTE,priorNonce:rows[1].event.nonce,a02ResponseSha:rows[4].event.responseSha,maxTotalRequests:80,policy:FLASH41_POLICY}
  const existing=rows.find(r=>r.event.kind==='paired05Grant')?.event.grant
  if(existing)check(isDeepStrictEqual(existing,grant),'P05_GRANT_CHANGED')
  return grant
}
export async function dispatchPaired05(unitId){
  check(/^P(?:0[1-9]|1[0-2])-(03|05)$/.test(unitId),'P05_UNIT')
  const bytes=readFileSync(join(PAIRED05_DIRECTORY,'BINDING.json')),binding=JSON.parse(bytes),baseline=read05('BASELINE.json')
  const grant=verifyPaired05Send({bindingBytes:bytes,binding,baseline,billing:read05('BILLING.json'),review:read05('SEND_REVIEW.json'),protection:inspectProtection({stage:'paired05'})})
  const closure=await compileOriginalScorer05(),{api}=await paired05Api(),budget=await openBudget(runDirectory,grant.manifestSha,{batchGrant:grant}),before=await budget.snapshot(),index=before.reservations.length-56
  check(binding.units[index]?.unitId===unitId&&!before.paired05?.stopped&&before.reservations.slice(1).every(r=>r.status==='settled'),'P05_NEXT')
  check(before.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+3300000<=10000000,'P05_BUDGET')
  const rawPath=join(PAIRED05_DIRECTORY,unitId+'_RAW.jsonl'),resultPath=join(PAIRED05_DIRECTORY,unitId+'_RESULT.json')
  check(!existsSync(rawPath)&&!existsSync(resultPath),'P05_ALREADY_ATTEMPTED')
  // Sole credential-reading path: explicit authorized paid unit, no probe/retry.
  try{process.loadEnvFile(resolve('.env'))}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),recorder=await createRawRecorder(rawPath),origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex');let observed
  try{
    const requests={...old.requests,...JSON.parse(readFileSync(join(CANDIDATE02_DIRECTORY,'BINDING.json'))).requests,...JSON.parse(readFileSync(join(CANDIDATE03_DIRECTORY,'BINDING.json'))).requests,...pairedRead('BINDING.json').requests,...binding.requests}
    const gateway=await createModelGateway({origin,capability,budget,requests,policy:FLASH41_POLICY,fetchImpl:createPinnedProxyFetch(),recordRaw:async row=>{check(row.unitId===unitId&&row.requestSha===binding.units[index].requestSha,'P05_RAW_ID');await recorder.write(row);observed=row}})
    const start=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},bodyText:JSON.stringify({unitId,requestSha:binding.units[index].requestSha})})
    let score=null,scoreError=null,assembled=null,returnedModel=null
    const item=binding.items.find(i=>i.id===unitId.slice(0,3)),reference=read05('REFERENCES.json').items.find(i=>i.id===item.id)
    if(response.status===200)try{
      const parsed=api.parseModelEnvelope(observed.rawHttpText,item.context,'deepseek-flash');assembled=parsed.adaptedResponse;returnedModel=parsed.envelope.model
      // Explicit derived scorer input, NOT a provider response. Original raw bytes stay in RAW.jsonl.
      const projection=structuredClone(parsed.envelope);projection.model=BILLING_POLICY.model;projection.output[0].content[0].text=JSON.stringify(api.projectSemantic(assembled))
      score=await closure.api.scoreSeenResponse(JSON.stringify(projection),item.context,reference.response,reference.context)
    }catch{scoreError='SCHEMA_OR_SCORER_REJECTED'}
    const after=await budget.snapshot(),r=after.reservations.find(r=>r.unitId===unitId)
    const result={unitId,arm:unitId.slice(-2),bindingSha:hash(bytes),requestSha:binding.units[index].requestSha,responseSha:observed?.responseSha??null,requestModel:'deepseek-flash',returnedModel,scorerSha:binding.scorerSha,scorerBundleSha:closure.bundleSha,referenceSha:binding.referenceSha,
      scoreInput:'explicit semantic projection into byte-identical historical scorer; raw response unmodified',assembled,http:response.status,diagnostic:response.diagnostic??null,waitingMs:Date.now()-start,score,scoreError,totalAttempts:after.reservations.length,
      costUpperMicroCny:r?.costUpperMicroCny??0,totalCostUpperMicroCny:after.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0),stopDispatch:response.status!==200||Boolean(after.paired05?.stopped)||r?.status!=='settled',providerBilledCny:'NOT_OBSERVABLE',automaticSelection:'NOT_ENABLED',qualityClaim:binding.label}
    writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
    return {unitId,http:result.http,stopDispatch:result.stopDispatch,scoreError,totalAttempts:result.totalAttempts,waitingMs:result.waitingMs,costUpperMicroCny:result.costUpperMicroCny}
  }finally{await recorder.close()}
}

const read06=name=>JSON.parse(readFileSync(join(PAIRED06_DIRECTORY,name)))
export async function paired06Api(){
  const compiled=await build({stdin:{contents:`export {buildFlash41Candidate06ComparisonRequest} from './src/experiments/realInput01/candidate06.ts';
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
    export {adaptModelWire,parseModelEnvelope,projectSemantic,WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';
    export {workspaceSnapshotHash} from './src/domain/v2/migration.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',metafile:true})
  const dependencies=Object.keys(compiled.metafile.inputs).filter(p=>p!=='<stdin>').map(path=>({path,sha256:hash(readFileSync(path))}))
  check(!dependencies.some(d=>/seenInputs|evaluation|fixture|expected/i.test(d.path)),'P06_ANSWER_IN_REQUEST')
  return {dependencies,api:await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))}
}
export function paired06Order(seed=20260913){
  let n=seed>>>0;const order=Array.from({length:12},(_,i)=>i<6?['03','06']:['06','03'])
  for(let i=order.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[order[i],order[j]]=[order[j],order[i]]}
  return order
}
export async function preparePaired06(){
  const protection=inspectProtection({stage:'paired06'}),freeze=read06('CANDIDATE_FREEZE.json'),inputs=read05('INPUTS.json'),reference=read05('REFERENCE_SPEC.json')
  for(const d of freeze.dependencies)check(hash(readFileSync(d.path))===d.sha256,'P06_CANDIDATE_FIXED')
  check(inputs.items.length===12&&reference.items.length===12&&new Set(inputs.items.map(i=>i.text)).size===12,'P06_INPUTS')
  const {api,dependencies}=await paired06Api(),closure=await compileOriginalScorer05(),old=JSON.parse(readFileSync(join(runDirectory,'STATE.json')))
  const requests={},units=[],items=[],references=[],seed=20260913,order=paired06Order(seed)
  for(const [i,item]of inputs.items.entries()){
    check(item.id===`P${String(i+1).padStart(2,'0')}`&&reference.items[i].id===item.id,'P06_ID')
    const id='Q'+item.id.slice(1),operationId='paired06-source-'+id,sourceId='source:'+api.workspaceSnapshotHash(operationId).slice('fnv1a32:'.length),sourceVersionId=sourceId+':version:1'
    const context={index:await api.indexImmutableScopesV11(sourceId,sourceVersionId,item.text),referenceTime:inputs.referenceTime,timezone:inputs.timezone}
    for(const arm of order[i]){const unitId=id+'-'+arm,built=await api.buildFlash41Candidate06ComparisonRequest(context,arm),u=inspectRequest(built.serialized,FLASH41_PAIRED06_POLICY)
      requests[unitId]=built.serialized;units.push({unitId,candidateSha:u.candidateSha,inputSha:u.inputSha,requestSha:u.requestSha,requestBytes:u.requestBytes,scorerSha:old.scorerSha})}
    items.push({id,originalId:item.id,operationId,context,title:item.text.split('\n')[0]})
    try{references.push({id,context,response:pairedReference(reference.items[i],context,api)})}
    catch(e){throw Error('P06_REFERENCE_'+item.id+': '+e.message)}
  }
  const refText=JSON.stringify({label:'人工参考仅评分，不进入请求或产品',items:references},null,2)+'\n'
  const files=['INPUTS.json','REFERENCE_SPEC.json','COMPARISON_RULES.md'].map(name=>({path:join(PAIRED05_DIRECTORY,name),sha256:hash(readFileSync(join(PAIRED05_DIRECTORY,name)))}));files.push({path:join(PAIRED06_DIRECTORY,'CANDIDATE_FREEZE.json'),sha256:hash(readFileSync(join(PAIRED06_DIRECTORY,'CANDIDATE_FREEZE.json')))})
  const binding={version:'real-input-paired06-binding-1',head:protection.head,dependencies,files,referenceSha:hash(refText),scorerSha:old.scorerSha,scorerBundleSha:closure.bundleSha,requests,units,items,seed,order,
    label:'12份已见材料开发回归；授权同期重复测量，非盲测；24请求不是24份独立材料',createdAt:new Date().toISOString()}
  writeFileSync(join(PAIRED06_DIRECTORY,'REFERENCES.json'),refText,{flag:'wx'});writeFileSync(join(PAIRED06_DIRECTORY,'BINDING.json'),JSON.stringify(binding,null,2)+'\n',{flag:'wx'})
  return {notices:12,requests:24,bindingSha:hash(JSON.stringify(binding,null,2)+'\n'),modelCalls:0}
}
export function verifyPaired06Send({bindingBytes,binding,baseline,billing,review,protection}){
  check(isDeepStrictEqual(JSON.parse(bindingBytes),binding)&&binding.version==='real-input-paired06-binding-1'&&binding.items.length===12&&binding.units.length===24,'P06_BINDING')
  const sources=protection.sources.map(s=>({path:s.path,sha256:s.workingSha256}))
  verifyReviewBinding({head:protection.head,expectedHead:baseline.head,sources,review})
  check(binding.head===baseline.head&&review.scope==='PAIRED06_SEND'&&review.bindingSha===hash(bindingBytes)&&review.billingSha===hash(JSON.stringify(billing)),'P06_REVIEW')
  for(const d of [...binding.dependencies,...binding.files])check(hash(readFileSync(d.path))===d.sha256,'P06_DEPENDENCY')
  check(hash(readFileSync(join(PAIRED06_DIRECTORY,'REFERENCES.json')))===binding.referenceSha,'P06_REFERENCE')
  const old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),old04=pairedRead('BINDING.json')
  check(binding.scorerSha===old.scorerSha&&binding.scorerBundleSha===old04.scorerBundleSha&&isDeepStrictEqual(binding.order,paired06Order(binding.seed)),'P06_SCORER_ORDER')
  const originalInputs=read05('INPUTS.json')
  for(const [i,item]of binding.items.entries()){
    check(item.originalId===originalInputs.items[i].id&&item.context.index.sourceContent===originalInputs.items[i].text&&item.context.referenceTime===originalInputs.referenceTime&&item.context.timezone===originalInputs.timezone,'P06_ORIGINAL_TEXT')
    const pair=binding.units.slice(i*2,i*2+2);check(isDeepStrictEqual(pair.map(u=>u.unitId),binding.order[i].map(a=>item.id+'-'+a)),'P06_ORDER')
    for(const u of pair){const p=inspectRequest(binding.requests[u.unitId],FLASH41_PAIRED06_POLICY)
      check(['candidateSha','requestSha','inputSha','requestBytes'].every(k=>p[k]===u[k])&&u.scorerSha===binding.scorerSha,'P06_REQUEST')
      check(isDeepStrictEqual(JSON.parse(p.body.input[1].content[0].text),{source:item.context.index.sourceContent,referenceTime:item.context.referenceTime,timezone:item.context.timezone,scopes:item.context.index.scopes.map(s=>({id:s.id,text:s.text}))}),'P06_SOURCE')}
    const comparable=t=>{const x=JSON.parse(t);return {...x,input:[x.input[1]]}}
    check(isDeepStrictEqual(comparable(binding.requests[pair[0].unitId]),comparable(binding.requests[pair[1].unitId])),'P06_PARAMETERS')
  }
  check(billing.verified===true&&isDeepStrictEqual(billing.policy,FLASH41_PAIRED06_POLICY)&&billing.method==='official-public-document-review','P06_BILLING')
  check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)&&Date.parse(billing.validUntil)-Date.parse(billing.checkedAt)<=86400000,'P06_PRICE_EXPIRED')
  check(billing.documents.length===1&&hash(readFileSync(billing.documents[0].path))===billing.documents[0].sha256,'P06_PRICE_EVIDENCE')
  const ledger=readFileSync(baseline.ledger.path),rows=ledger.toString().trimEnd().split('\n').map(JSON.parse)
  check(baseline.ledger.sequence===166&&hash(ledger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256,'P06_LEDGER_PREFIX')
  const grant={version:'real-input-paired06-grant-1',grantId:review.grantId,parentTail:rows[165].hash,parentSequence:166,ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,
    manifestSha:hash(readFileSync(join(runDirectory,'REQUEST_MANIFEST.json'))),bindingSha:hash(bindingBytes),head:binding.head,sourcesSha:hash(JSON.stringify(sources)),reviewSha:hash(JSON.stringify(review)),
    targets:binding.units,billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))},route:RECOVERY_ROUTE,priorNonce:rows[1].event.nonce,a02ResponseSha:rows[4].event.responseSha,maxTotalRequests:104,policy:FLASH41_PAIRED06_POLICY}
  const existing=rows.find(r=>r.event.kind==='paired06Grant')?.event.grant
  if(existing)check(isDeepStrictEqual(existing,grant),'P06_GRANT_CHANGED')
  return grant
}
export async function dispatchPaired06(unitId){
  check(/^Q(?:0[1-9]|1[0-2])-(03|06)$/.test(unitId),'P06_UNIT')
  const bytes=readFileSync(join(PAIRED06_DIRECTORY,'BINDING.json')),binding=JSON.parse(bytes),baseline=read06('BASELINE.json')
  const grant=verifyPaired06Send({bindingBytes:bytes,binding,baseline,billing:read06('BILLING.json'),review:read06('SEND_REVIEW.json'),protection:inspectProtection({stage:'paired06'})})
  const closure=await compileOriginalScorer05(),{api}=await paired06Api(),budget=await openBudget(runDirectory,grant.manifestSha,{batchGrant:grant}),before=await budget.snapshot(),index=before.reservations.length-80
  check(binding.units[index]?.unitId===unitId&&!before.paired06?.stopped&&before.reservations.slice(1).every(r=>r.status==='settled'),'P06_NEXT')
  check(before.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0)+3300000<=10000000,'P06_BUDGET')
  const rawPath=join(PAIRED06_DIRECTORY,unitId+'_RAW.jsonl'),resultPath=join(PAIRED06_DIRECTORY,unitId+'_RESULT.json')
  check(!existsSync(rawPath)&&!existsSync(resultPath),'P06_ALREADY_ATTEMPTED')
  // Sole credential-reading path: explicit authorized paid unit, no probe/retry.
  try{process.loadEnvFile(resolve('.env'))}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const old=JSON.parse(readFileSync(join(runDirectory,'STATE.json'))),recorder=await createRawRecorder(rawPath),origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex');let observed
  try{
    const requests={...old.requests,...JSON.parse(readFileSync(join(CANDIDATE02_DIRECTORY,'BINDING.json'))).requests,...JSON.parse(readFileSync(join(CANDIDATE03_DIRECTORY,'BINDING.json'))).requests,...pairedRead('BINDING.json').requests,...read05('BINDING.json').requests,...binding.requests}
    const gateway=await createModelGateway({origin,capability,budget,requests,policy:FLASH41_PAIRED06_POLICY,fetchImpl:createPinnedProxyFetch(),recordRaw:async row=>{check(row.unitId===unitId&&row.requestSha===binding.units[index].requestSha,'P06_RAW_ID');await recorder.write(row);observed=row}})
    const start=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},bodyText:JSON.stringify({unitId,requestSha:binding.units[index].requestSha})})
    let score=null,scoreError=null,assembled=null,returnedModel=observed?JSON.parse(observed.rawHttpText).model:null
    const item=binding.items.find(i=>i.id===unitId.slice(0,3)),reference=read06('REFERENCES.json').items.find(i=>i.id===item.id)
    if(response.status===200)try{
      const parsed=api.parseModelEnvelope(observed.rawHttpText,item.context,'deepseek-flash');assembled=parsed.adaptedResponse;returnedModel=parsed.envelope.model
      // Explicit derived scorer input, NOT a provider response. Original raw bytes stay in RAW.jsonl.
      const projection=structuredClone(parsed.envelope);projection.model=BILLING_POLICY.model;projection.output[0].content[0].text=JSON.stringify(api.projectSemantic(assembled))
      score=await closure.api.scoreSeenResponse(JSON.stringify(projection),item.context,reference.response,reference.context)
    }catch{scoreError='SCHEMA_OR_SCORER_REJECTED'}
    const after=await budget.snapshot(),r=after.reservations.find(r=>r.unitId===unitId)
    const result={unitId,arm:unitId.slice(-2),bindingSha:hash(bytes),requestSha:binding.units[index].requestSha,responseSha:observed?.responseSha??null,requestModel:'deepseek-flash',returnedModel,scorerSha:binding.scorerSha,scorerBundleSha:closure.bundleSha,referenceSha:binding.referenceSha,
      scoreInput:'explicit semantic projection into byte-identical historical scorer; raw response unmodified',assembled,http:response.status,diagnostic:response.diagnostic??null,waitingMs:Date.now()-start,score,scoreError,totalAttempts:after.reservations.length,
      costUpperMicroCny:r?.costUpperMicroCny??0,totalCostUpperMicroCny:after.reservations.reduce((n,r)=>n+r.costUpperMicroCny,0),stopDispatch:response.status!==200||Boolean(after.paired06?.stopped)||r?.status!=='settled',providerBilledCny:'NOT_OBSERVABLE',automaticSelection:'NOT_ENABLED',qualityClaim:binding.label}
    writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
    return {unitId,http:result.http,stopDispatch:result.stopDispatch,scoreError,totalAttempts:result.totalAttempts,waitingMs:result.waitingMs,costUpperMicroCny:result.costUpperMicroCny}
  }finally{await recorder.close()}
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const args=process.argv.slice(2),pick=key=>args.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)
  if(args.length===1&&args[0]==='--prepare-paired06')console.log(JSON.stringify(await preparePaired06()))
  else if(args.length===1&&/^--paired06=Q(?:0[1-9]|1[0-2])-(03|06)$/.test(args[0]))console.log(JSON.stringify(await dispatchPaired06(pick('paired06'))))
  else if(args.length===1&&args[0]==='--prepare-paired05')console.log(JSON.stringify(await preparePaired05()))
  else if(args.length===1&&/^--paired05=P(?:0[1-9]|1[0-2])-(03|05)$/.test(args[0]))console.log(JSON.stringify(await dispatchPaired05(pick('paired05'))))
  else if(args.length===1&&args[0]==='--prepare-paired04')console.log(JSON.stringify(await preparePaired04()))
  else if(args.length===1&&/^--paired04=N(?:0[1-9]|1[0-2])-(03|04)$/.test(args[0]))console.log(JSON.stringify(await dispatchPaired04(pick('paired04'))))
  else if(args.length===1&&args[0]==='--prepare-candidate03')console.log(JSON.stringify(await prepareCandidate03()))
  else if(args.length===1&&/^--candidate03=D0[1-8]$/.test(args[0]))console.log(JSON.stringify(await dispatchCandidate03(pick('candidate03'))))
  else if(args.length===1&&args[0]==='--prepare-candidate02')console.log(JSON.stringify(await prepareCandidate02()))
  else if(args.length===1&&/^--candidate02=C0[1-8]$/.test(args[0]))console.log(JSON.stringify(await dispatchCandidate02(pick('candidate02'))))
  else if(args.length===1&&/^--batch=(?:A0[3-8]|B0[1-8])$/.test(args[0]))console.log(JSON.stringify(await dispatchBatchUnit(pick('batch'))))
  else if(args.length===1&&args[0]==='--recover-a02')console.log(JSON.stringify(await dispatchRecoveredA02()))
  else if(args.length===1&&/^--paid=[AB]0[1-8]$/.test(args[0]))console.log(JSON.stringify(await dispatchPaidUnit(pick('paid'))))
  else {
  check(args.length===4&&args.every(a=>/^--(?:preparation|repository-read|output|carriers)=/.test(a))
    &&new Set(args.map(a=>a.split('=')[0])).size===4,'BIND_ONLY_ARGUMENTS')
  console.log(JSON.stringify(await bindPreparedInputs(pick('preparation'),pick('repository-read'),pick('output'),pick('carriers'))))
  }
}
