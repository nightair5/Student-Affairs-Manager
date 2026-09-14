import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'

const sourceDirectory='docs/recognition-optimization/mainline-real-input-01/runs/reasoning-low16-compare-20260914a'
const candidate09Directory='docs/recognition-optimization/mainline-real-input-01/runs/candidate09-20260913a'
const outputDirectory='docs/recognition-optimization/mainline-real-input-01/runs/baseline-hard-corrections-20260915a'
const read=name=>JSON.parse(readFileSync(join(sourceDirectory,name),'utf8'))
const compiled=await build({stdin:{contents:`
  export { MemoryWorkspaceRecordStore, CanonicalWorkspaceRepository } from './src/domain/v2/repository.ts'
  export { SemanticRepository } from './src/experiments/mainline05/semanticRepository.ts'
  export { acquireText } from './src/experiments/realInput01/inputAcquisition.ts'
  export { makeSendSnapshot } from './src/experiments/realInput01/inputReceipt.ts'
  export { completeInputRun } from './src/experiments/mainline05/semanticCapture.ts'
  export { enableMaterialReview, reviewSemanticMaterial, reviewSemanticFact, acceptSemanticPendingDate, correctSemanticFact, disposeSemantic, confirmSemantic } from './src/experiments/mainline05/semanticConfirmation.ts'
  export { emptyRealInputWorkspace, recordedA02Identity } from './src/experiments/realInput01/runtime.ts'
  export { REAL_STATE_VERSION, effectiveStateFacts, stateOfRuntime, semanticRevision, life, pendingDateEligible, hasPendingDateConsent, materialDecision } from './src/experiments/mainline05/semanticState.ts'
  export { indexImmutableScopesV11 } from './src/recognition/scopeIndexV11.ts'
  export { materialEdit } from './src/experiments/realInput01/factCorrections.ts'
  export { CANDIDATE03_VERSION } from './src/experiments/realInput01/candidate03.ts'
  export { FLASH41_MODEL_NAME } from './src/experiments/realInput01/modelWire.ts'
  export { validateSemanticWorkspace } from './src/experiments/mainline05/semanticState.ts'
`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm'})
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
const binding=read('BINDING_FINAL.json'),adjudication=read('BUSINESS_ADJUDICATION.json')
const references=read('REFERENCES_FINAL.json')
const candidate09Binding=JSON.parse(readFileSync(join(candidate09Directory,'BINDING_FINAL.json'),'utf8'))
const sha256=value=>createHash('sha256').update(value).digest('hex')
const referenceBytes=readFileSync(join(sourceDirectory,'REFERENCES_FINAL.json'))
const adjudicationBytes=readFileSync(join(sourceDirectory,'BUSINESS_ADJUDICATION.json'))
if(sha256(referenceBytes)!==binding.referenceSha)throw Error('FROZEN_REFERENCE_SHA')
const cases=adjudication.cases.map(item=>({
  ...binding.items.find(bound=>bound.id===item.id),
  source:item.source,
  business:item.A,
  reference:references.items.find(reference=>reference.id===item.id)?.response,
}))
if(cases.length!==adjudication.comparison.completedSources||cases.some(item=>!item.context||!item.reference))throw Error('FROZEN_REFERENCE_BINDING')
if(cases.some(item=>item.context.index.sourceFingerprint!==references.items.find(reference=>reference.id===item.id)?.context.index.sourceFingerprint))throw Error('FROZEN_SOURCE_BINDING')

const taskKey=task=>task.action.surface.trim()+'\u0000'+task.object.surface.trim()
function referenceTask(item,task){return item.reference.tasks.find(reference=>taskKey(reference)===taskKey(task))??null}
function adjudicatedIssueTitles(item){return new Set(item.business.corrections.map(correction=>correction.match(/“([^”]+)”/)?.[1]).filter(Boolean))}

function errorText(error){return error instanceof Error?error.message:String(error)}
async function stage(item,phase){
  const name=api.recordedA02Identity.name,store=Object.assign(new api.MemoryWorkspaceRecordStore(),{name})
  const repo=await api.SemanticRepository.open(name,store,api.emptyRealInputWorkspace(name,item.context.referenceTime),'real-input-01')
  const prior=candidate09Binding.items.find(bound=>bound.operationId===item.operationId)
  if(!prior)throw Error('CURRENT_REPLAY_BINDING_'+item.id)
  const receipt=await api.acquireText(`paired09-${prior.id}`,item.context.index.sourceContent)
  const source=await repo.saveReading(receipt,item.title,item.operationId,item.context.referenceTime)
  const actual=await api.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,item.context.index.sourceContent)
  if(JSON.stringify(actual)!==JSON.stringify(item.context.index))throw Error('CURRENT_REPLAY_SOURCE_IDENTITY_'+item.id)
  const reading={version:api.REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await api.makeSendSnapshot(receipt,[1],[1],item.context.referenceTime)}
  const handle=await repo.beginInputRun(source.sourceId,reading,'live',`baseline-run-${item.id}-${phase}`,
    api.semanticRevision(await repo.load()),item.context.referenceTime,api.CANDIDATE03_VERSION,api.FLASH41_MODEL_NAME)
  const raw=read(item.id+'-A_RAW.jsonl')
  await api.completeInputRun(repo,handle,raw.rawHttpText)
  await api.enableMaterialReview(repo,handle.draftId,item.context.referenceTime)
  return {repo,store,draftId:handle.draftId}
}

async function applyKnownCorrections(repo,draftId,item){
  const operations=[]
  if(item.id==='L02'){
    let workspace=await repo.load(),state=api.stateOfRuntime(workspace,draftId),facts=api.effectiveStateFacts(state).facts
    const submit=facts.tasks.find(task=>task.id==='task-submit-samples'),extra=facts.tasks.find(task=>task.id==='task-prepare-sample-bags')
    const bags=facts.materials.find(material=>material.tempId==='material-sample-bags')
    if(!submit||!extra||!bags)throw Error('W11_CORRECTION_SHAPE')
    const conditionScopes=[...new Set([...submit.condition.conditionScopeIds,...submit.propositionScopeIds])]
    await api.correctSemanticFact(repo,{draftId,revision:api.semanticRevision(workspace),operationId:'W11-condition-unknown',change:{
      kind:'condition',taskId:submit.id,value:{...submit.condition,value:'unknown',factScopeIds:[]},scopeIds:conditionScopes,
      note:'完整原文只说明填写登记单后再送样，没有说明登记单已经填写完成，因此条件保持尚不确定。'}})
    operations.push({kind:'condition',taskId:submit.id,before:'true',after:'unknown'})
    workspace=await repo.load();state=api.stateOfRuntime(workspace,draftId);facts=api.effectiveStateFacts(state).facts
    const currentBags=facts.materials.find(material=>material.tempId===bags.tempId)
    await api.correctSemanticFact(repo,{draftId,revision:api.semanticRevision(workspace),operationId:'W11-material-owner',change:{
      kind:'material',materialId:bags.tempId,value:{...api.materialEdit(currentBags),relatedTaskTempIds:[submit.id]}}})
    operations.push({kind:'material',materialId:bags.tempId,before:[submit.id,extra.id],after:[submit.id]})
    await api.disposeSemantic(repo,{draftId,taskTempIds:[extra.id],kind:'reject',revision:api.semanticRevision(await repo.load()),operationId:'W11-reject-extra'})
    operations.push({kind:'reject_extra_task',taskId:extra.id})
  }
  if(item.id==='L04'){
    const workspace=await repo.load(),state=api.stateOfRuntime(workspace,draftId),facts=api.effectiveStateFacts(state).facts
    const task=facts.tasks.find(row=>row.id==='task-save-final-labels')
    if(!task)throw Error('W12_CORRECTION_SHAPE')
    await api.correctSemanticFact(repo,{draftId,revision:api.semanticRevision(workspace),operationId:'W12-remove-ungrounded-dependency',change:{
      kind:'dependency',taskId:task.id,value:[],scopeIds:[...task.propositionScopeIds],
      note:'完整原文将制作展签与保存最终版展签并列要求，没有说明保存动作必须等待制作任务完成。'}})
    operations.push({kind:'dependency',taskId:task.id,before:['task-make-labels'],after:[]})
  }
  return operations
}

async function saveEligible(item,phase){
  const {repo,store,draftId}=await stage(item,phase)
  const correctionOperations=phase==='after'?await applyKnownCorrections(repo,draftId,item):[]
  let workspace=await repo.load(),state=api.stateOfRuntime(workspace,draftId),facts=api.effectiveStateFacts(state).facts
  const rawFacts=structuredClone(state.rawResponse),first=structuredClone(state.first)
  const candidates=facts.tasks.filter(task=>task.semantics.status==='pending'&&task.semantics.validity==='active'
    &&!['false','unknown'].includes(task.condition.value)&&referenceTask(item,task)
    &&!(phase==='before'&&adjudicatedIssueTitles(item).has(task.detail.title))&&api.life(state).dispositions[task.id]==='pending')
  const materialIds=new Set(facts.materials.filter(material=>material.relatedTaskTempIds.some(id=>candidates.some(task=>task.id===id))).map(material=>material.tempId))
  const materialReviews=[]
  for(const materialId of materialIds){
    const material=facts.materials.find(row=>row.tempId===materialId)
    workspace=await repo.load()
    await api.reviewSemanticMaterial(repo,{draftId,materialId,revision:api.semanticRevision(workspace),operationId:`${item.id}-${phase}-material-${materialReviews.length+1}`,
      value:{required:material.required,status:'unverified'}})
    materialReviews.push(materialId)
  }
  const results=candidates.map(task=>({taskId:task.id,title:task.detail.title,review:'NOT_RUN',confirm:'NOT_RUN',pendingDateAccepted:false}))
  for(let pass=0;pass<=results.length;pass++){
    let progressed=false
    for(const result of results.filter(row=>!['SAVED','IDEMPOTENT'].includes(row.confirm))){
      try{
        workspace=await repo.load();state=api.stateOfRuntime(workspace,draftId)
        if(api.pendingDateEligible(state,result.taskId)&&!api.hasPendingDateConsent(state,result.taskId)){
          await api.acceptSemanticPendingDate(repo,{draftId,taskId:result.taskId,revision:api.semanticRevision(workspace),operationId:`${item.id}-${phase}-pending-${result.taskId}`.slice(0,100)})
          result.pendingDateAccepted=true;workspace=await repo.load()
        }
        await api.reviewSemanticFact(repo,{draftId,taskId:result.taskId,revision:api.semanticRevision(workspace),operationId:`${item.id}-${phase}-review-${result.taskId}`.slice(0,100)})
        result.review='SAVED';workspace=await repo.load()
        const before=workspace.tasks.length,saved=await api.confirmSemantic(repo,{draftId,taskTempIds:[result.taskId],revision:api.semanticRevision(workspace)})
        result.confirm=saved.tasks.length>before?'SAVED':'IDEMPOTENT';progressed=true
      }catch(error){result.confirm=errorText(error)}
    }
    if(!progressed)break
  }
  workspace=await repo.load();state=api.stateOfRuntime(workspace,draftId);facts=api.effectiveStateFacts(state).facts
  await api.validateSemanticWorkspace(workspace,'real-input-01')
  const independent=await new api.CanonicalWorkspaceRepository(store).load()
  const taskRows=facts.tasks.map(task=>{
    const saved=results.find(result=>result.taskId===task.id)?.confirm
    const disposition=api.life(state).dispositions[task.id]
    const reference=referenceTask(item,task),adjudicatedIssue=phase==='before'&&adjudicatedIssueTitles(item).has(task.detail.title)
    let outcome='UNEXPECTED_PROGRAM_BLOCKER'
    if(saved==='SAVED'||saved==='IDEMPOTENT')outcome='CORRECTLY_SAVED'
    else if(item.id==='L02'&&task.id==='task-prepare-sample-bags'&&phase==='after'&&disposition==='rejected')outcome='REJECTED_MODEL_EXTRA'
    else if(adjudicatedIssue||!reference)outcome='MODEL_CORRECTION_REQUIRED'
    else if(task.condition.value==='unknown')outcome='REASONABLE_PENDING'
    else if(task.condition.value==='false'||task.semantics.status==='cancelled'||task.semantics.validity==='superseded')outcome='CORRECTLY_NOT_ACTIONABLE'
    return {taskId:task.id,title:task.detail.title,condition:task.condition.value,status:task.semantics.status,
      dependencyTempIds:task.detail.dependencyTempIds,referenceTaskKey:reference?taskKey(reference):null,
      referenceIdentityMatched:Boolean(reference),adjudicatedIssue,
      disposition,confirm:saved??'NOT_ATTEMPTED',outcome}
  })
  return {sourceId:item.id,originalSource:item.source,title:item.title,suggestedTasks:facts.tasks.length,materialReviews,
    correctionOperations,taskRows,savedTasks:workspace.tasks.map(task=>({id:task.id,title:task.title})),
    independentReadEqual:JSON.stringify(independent)===JSON.stringify(workspace),rawResponsePreserved:JSON.stringify(state.rawResponse)===JSON.stringify(rawFacts),
    firstSuggestionPreserved:JSON.stringify(state.first)===JSON.stringify(first),corrections:state.corrections}
}

let forbiddenNetworkCalls=0
const originalFetch=globalThis.fetch
globalThis.fetch=async()=>{forbiddenNetworkCalls++;throw Error('ZERO_CALL_REPLAY_FORBIDS_NETWORK')}
try{
  const before=[],after=[]
  for(const item of cases){before.push(await saveEligible(item,'before'));after.push(await saveEligible(item,'after'))}
  const count=(rows,outcome)=>rows.flatMap(row=>row.taskRows).filter(task=>task.outcome===outcome).length
  const referenceTaskFacts=cases.reduce((total,item)=>total+item.reference.tasks.length,0)
  const adjudicationCorrectionOperations=cases.reduce((total,item)=>total+item.business.corrections.length,0)
  const result={version:'baseline-hard-corrections-replay-1',generatedAt:new Date().toISOString(),
    claim:'12份L01-A至L12-A的candidate03真实历史回答零调用工程回放；不是新模型调用、真人操作或真实浏览器转化率。',
    evidenceBinding:{referencePath:join(sourceDirectory,'REFERENCES_FINAL.json'),referenceSha256:sha256(referenceBytes),
      adjudicationPath:join(sourceDirectory,'BUSINESS_ADJUDICATION.json'),adjudicationSha256:sha256(adjudicationBytes),
      bindingReferenceSha256:binding.referenceSha,completedSourcesFromAdjudication:adjudication.comparison.completedSources,
      correctionOperationsFromCaseAdjudication:adjudicationCorrectionOperations,
      historicalSummaryCorrectionOperations:adjudication.comparison.arms.A.minimumUserCorrectionOperations,
      historicalSummaryMismatchAcknowledged:adjudicationCorrectionOperations!==adjudication.comparison.arms.A.minimumUserCorrectionOperations},
    denominators:{sources:cases.length,referenceTaskFacts,modelSuggestedTasksBefore:before.reduce((n,row)=>n+row.suggestedTasks,0)},
    before:{correctlySavedTasks:count(before,'CORRECTLY_SAVED'),modelCorrectionRequiredTasks:count(before,'MODEL_CORRECTION_REQUIRED'),
      reasonablePendingTasks:count(before,'REASONABLE_PENDING'),correctlyNotActionableTasks:count(before,'CORRECTLY_NOT_ACTIONABLE'),
      unexpectedProgramBlockers:count(before,'UNEXPECTED_PROGRAM_BLOCKER'),materialReviews:before.reduce((n,row)=>n+row.materialReviews.length,0),cases:before},
    after:{correctlySavedTasks:count(after,'CORRECTLY_SAVED'),correctedThenSavedTasks:1,rejectedModelExtraTasks:count(after,'REJECTED_MODEL_EXTRA'),
      reasonablePendingTasks:count(after,'REASONABLE_PENDING'),correctlyNotActionableTasks:count(after,'CORRECTLY_NOT_ACTIONABLE'),
      unexpectedProgramBlockers:count(after,'UNEXPECTED_PROGRAM_BLOCKER'),materialReviews:after.reduce((n,row)=>n+row.materialReviews.length,0),
      correctionOperations:after.reduce((n,row)=>n+row.correctionOperations.length,0),cases:after},
    invariants:{independentReadsEqual:before.concat(after).every(row=>row.independentReadEqual),rawAndFirstSuggestionsPreserved:before.concat(after).every(row=>row.rawResponsePreserved&&row.firstSuggestionPreserved),
      forbiddenNetworkCalls},
  }
  writeFileSync(join(outputDirectory,'REPLAY.json'),JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify({denominators:result.denominators,before:{...result.before,cases:undefined},after:{...result.after,cases:undefined},invariants:result.invariants},null,2))
}catch(error){
  console.error('RUN_FAILURE '+errorText(error))
  process.exitCode=1
}finally{globalThis.fetch=originalFetch}
