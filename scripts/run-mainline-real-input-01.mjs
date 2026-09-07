import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { resolve, dirname, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { build } from 'esbuild'
import { inspectProtection, verifyReviewBinding } from './check-mainline-real-input-01.mjs'
import { inspectRequest, createModelGateway, createPinnedProxyFetch, createRawRecorder } from './real-input-model-gateway.mjs'
import { BILLING_POLICY, RECOVERY_ROUTE, initializeBudget, openBudget } from './real-input-budget.mjs'

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
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const args=process.argv.slice(2),pick=key=>args.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)
  if(args.length===1&&/^--batch=(?:A0[3-8]|B0[1-8])$/.test(args[0]))console.log(JSON.stringify(await dispatchBatchUnit(pick('batch'))))
  else if(args.length===1&&args[0]==='--recover-a02')console.log(JSON.stringify(await dispatchRecoveredA02()))
  else if(args.length===1&&/^--paid=[AB]0[1-8]$/.test(args[0]))console.log(JSON.stringify(await dispatchPaidUnit(pick('paid'))))
  else {
  check(args.length===4&&args.every(a=>/^--(?:preparation|repository-read|output|carriers)=/.test(a))
    &&new Set(args.map(a=>a.split('=')[0])).size===4,'BIND_ONLY_ARGUMENTS')
  console.log(JSON.stringify(await bindPreparedInputs(pick('preparation'),pick('repository-read'),pick('output'),pick('carriers'))))
  }
}
