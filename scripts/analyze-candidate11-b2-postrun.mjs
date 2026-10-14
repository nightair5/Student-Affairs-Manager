import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {loadCandidate11Api} from './verify-candidate11-analysis.mjs'
import {scoreCandidate11,fieldPass,taskFacts,normalize} from './score-candidate11-recognition.mjs'

const DIRECTORY='docs/recognition-optimization/candidate11/b2-development-20260921a'
const B1='docs/recognition-optimization/candidate11/b1-preparation'
const LEDGER='C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
const hash=value=>createHash('sha256').update(value).digest('hex')
const check=(value,code)=>{if(!value)throw Error('CANDIDATE11_B2_POSTRUN_'+code)}
const read=path=>JSON.parse(readFileSync(path,'utf8'))
const write=(name,value)=>writeFileSync(join(DIRECTORY,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const CATEGORY={timeRaw:'time',times:'time',materials:'material',condition:'condition',dependencies:'dependency',revision:'revision',completionCriteria:'completion',semantics:'semantics',actionable:'condition'}
const categoryFor=path=>Object.entries(CATEGORY).find(([fragment])=>path.includes(fragment))?.[1]??'other'
const at=(value,path)=>path.split('.').reduce((node,key)=>node?.[key],value)

function validateLedger(binding){
  const bytes=readFileSync(LEDGER),lines=bytes.toString('utf8').trimEnd().split('\n'),rows=lines.map(JSON.parse);let prior='0'.repeat(64)
  rows.forEach((row,sequence)=>{check(row.sequence===sequence&&row.previous===prior&&row.hash===hash(JSON.stringify({sequence,previous:prior,event:row.event})),'LEDGER_CHAIN');prior=row.hash})
  const events=rows.slice(644).map(row=>row.event)
  check(rows.length===693&&events.filter(event=>event.kind==='candidate11Grant').length===1&&events.filter(event=>event.kind==='candidate11Reserve').length===24
    &&events.filter(event=>event.kind==='candidate11Settle').length===24&&!events.some(event=>['candidate11Uncertain','candidate11Halt'].includes(event.kind)),'LEDGER_EVENTS')
  check(isDeepStrictEqual(events.filter(event=>event.kind==='candidate11Reserve').map(event=>event.unitId),binding.units.map(unit=>unit.unitId)),'LEDGER_ORDER')
  return {summary:{rows:rows.length,bytes:bytes.length,sha256:hash(bytes),tail:rows.at(-1).hash,nextSequence:rows.length},events:rows.slice(644)}
}

function referencesValid(result,context){
  const scopes=new Set(context.index.scopes.map(scope=>scope.id)),tasks=new Set(result.tasks.map(task=>task.id)),materials=new Set(result.materials.map(item=>item.tempId)),times=new Set(result.timePoints.map(item=>item.tempId)),scopeArrays=[]
  for(const task of result.tasks){scopeArrays.push(task.propositionScopeIds,task.condition.conditionScopeIds,task.condition.factScopeIds);if(task.detail.dependencyTempIds.some(id=>!tasks.has(id))||task.detail.materialTempIds.some(id=>!materials.has(id))||task.detail.timePointTempIds.some(id=>!times.has(id)))return false}
  for(const item of [...result.materials,...result.timePoints]){scopeArrays.push(item.scopeIds);if(item.relatedTaskTempIds.some(id=>!tasks.has(id)))return false}
  for(const revision of result.revisions){scopeArrays.push(revision.scopeIds);if(!tasks.has(revision.targetDirectiveId)||(revision.fromDirectiveId!==null&&!tasks.has(revision.fromDirectiveId)))return false}
  return scopeArrays.flat().every(id=>scopes.has(id))
}

function adjudicateD06(score,result){
  if(!['SCORED','ADJUDICATED_D06'].includes(score.status))return {status:'FAIL',reason:'schema_or_score_failure'}
  const map=Object.fromEntries(score.alignment.map(row=>[row.goldId,row.predictedId]));if(Object.values(map).some(value=>!value))return {status:'FAIL',reason:'missing_task_endpoint',mapping:map}
  const expected=[['D06-T01','D06-OLD01'],['D06-T02','D06-OLD02']],revisions=result.revisions
  const matched=expected.every(([from,target])=>revisions.some(item=>item.type==='supersedes'&&item.effective==='true'&&item.fromDirectiveId===map[from]&&item.targetDirectiveId===map[target]))
  return {status:matched&&revisions.length===2?'PASS':'FAIL',reason:matched&&revisions.length===2?'new_to_old_pairs_verified':'direction_or_pair_mismatch',mapping:map}
}

// B1 freezes this post-result adjudication: current and historical endpoints
// are separated by action/object plus active/pending versus superseded/cancelled.
// A combined historical object is neither of the two required old endpoints.
function scoreD06(reference,result){
  const candidates=result.tasks.map(task=>taskFacts(result,task)),used=new Set(),alignment=[]
  for(const gold of reference.tasks){
    const historical=gold.id.includes('OLD'),matches=[]
    for(const [index,item] of candidates.entries())if(!used.has(index)&&gold.actions.some(value=>normalize(value)===normalize(item.action.surface))
      &&gold.objects.some(value=>normalize(value)===normalize(item.object.surface))
      &&(historical?(item.semantics.status==='cancelled'&&item.semantics.validity==='superseded'):(item.semantics.status==='pending'&&item.semantics.validity==='active')))matches.push(index)
    const prediction=matches.length===1?matches[0]:-1;if(prediction>=0)used.add(prediction)
    const item=candidates[prediction],fields=Object.entries(gold.fields??{}).map(([path,rule])=>({path,pass:prediction>=0&&fieldPass(at(item,path),rule)}))
    alignment.push({goldId:gold.id,predictedId:prediction>=0?item.id:null,aligned:prediction>=0,correct:prediction>=0&&fields.every(field=>field.pass),fields})
  }
  const expected=reference.tasks.length,predicted=candidates.length,aligned=alignment.filter(row=>row.aligned).length,correct=alignment.filter(row=>row.correct).length
  const metric=tp=>({tp,fp:predicted-tp,fn:expected-tp,precision:predicted?tp/predicted:null,recall:expected?tp/expected:null})
  const checks=(reference.checks??[]).map(check=>({name:check.name,pass:fieldPass(at(result,check.path),check.rule)}))
  return {scorerVersion:'candidate11-scoring-2.0.0',status:'ADJUDICATED_D06',plannedSources:1,expectedTasks:expected,complete:false,knownChecksPass:false,
    taskMetrics:{expected,predicted,alignedPairs:aligned,correctPairs:correct,alignment:metric(aligned),correctness:metric(correct)},alignment,checks,issues:[],
    adjudicationRule:'frozen action/object plus active-pending versus superseded-cancelled; combined old object is not a legal merge'}
}

function teachingLeak(result,context){
  const serialized=JSON.stringify(result),source=context.index.sourceContent,findings=[]
  for(const value of ['展务台','昨日'])if(serialized.includes(value)&&!source.includes(value))findings.push(value)
  const current=new Set(context.index.scopes.map(scope=>scope.id))
  for(const id of serialized.match(/scope-[0-9]{4}-[a-f0-9]{64}/gu)??[])if(!current.has(id))findings.push(id)
  return [...new Set(findings)]
}

function evaluate(reference,assembled,context){
  const referenceValid=referencesValid(assembled,context),score=reference.sourceId.endsWith('D06')?scoreD06(reference.scorerReference,assembled):scoreCandidate11(reference.scorerReference,assembled,{schemaValid:true})
  const fieldFailures=score.alignment.flatMap(row=>row.fields.filter(field=>!field.pass).map(field=>({goldId:row.goldId,path:field.path,category:categoryFor(field.path)})))
  for(const item of score.checks??[])if(!item.pass)fieldFailures.push({goldId:null,path:'checks.'+item.name,category:categoryFor(item.name)})
  const revisionAdjudication=reference.sourceId.endsWith('D06')?adjudicateD06(score,assembled):{status:'NOT_APPLICABLE'}
  const leaks=teachingLeak(assembled,context),task=score.taskMetrics.alignment,precision=task.precision,recall=task.recall
  const metrics={...task,f1:precision===null||recall===null||precision+recall===0?0:2*precision*recall/(precision+recall)}
  const forbidden=task.fp+leaks.length,severe=(referenceValid&&['SCORED','ADJUDICATED_D06'].includes(score.status)?0:1)+(revisionAdjudication.status==='FAIL'?1:0)
  const major=fieldFailures.length+task.fn+task.fp+(revisionAdjudication.status==='FAIL'?1:0)
  const complete=score.complete===true&&referenceValid&&revisionAdjudication.status!=='FAIL'&&leaks.length===0
  return {schemaValid:true,referenceValid,score:{...score,complete},task:metrics,fieldFailures,
    fieldCategories:Object.fromEntries(['time','material','condition','completion','dependency','revision','semantics','other'].map(category=>[category,fieldFailures.filter(item=>item.category===category).length])),
    complete,major,severe,forbidden,teachingLeak:leaks,revisionAdjudication,ambiguity:score.issues?.includes('ADJUDICATION_REQUIRED')?score.issues:[]}
}

function summarize(cases){
  const tp=cases.reduce((n,row)=>n+row.evaluation.task.tp,0),fp=cases.reduce((n,row)=>n+row.evaluation.task.fp,0),fn=cases.reduce((n,row)=>n+row.evaluation.task.fn,0),precision=tp+fp?tp/(tp+fp):null,recall=tp+fn?tp/(tp+fn):null
  return {sources:cases.length,schemaAndReferenceValid:cases.filter(row=>row.evaluation.schemaValid&&row.evaluation.referenceValid).length,completeSources:cases.filter(row=>row.evaluation.complete).length,
    major:cases.reduce((n,row)=>n+row.evaluation.major,0),severe:cases.reduce((n,row)=>n+row.evaluation.severe,0),forbidden:cases.reduce((n,row)=>n+row.evaluation.forbidden,0),teachingLeak:cases.reduce((n,row)=>n+row.evaluation.teachingLeak.length,0),
    task:{tp,fp,fn,precision,recall,f1:precision===null||recall===null||precision+recall===0?0:2*precision*recall/(precision+recall)},promptBytes:cases.reduce((n,row)=>n+row.requestBytes,0),
    fieldCategories:Object.fromEntries(['time','material','condition','completion','dependency','revision','semantics','other'].map(category=>[category,cases.reduce((n,row)=>n+row.evaluation.fieldCategories[category],0)]))}
}

export async function analyzePostrun(){
  const bindingBytes=readFileSync(join(DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes),packets=read(join(B1,'PREPARED_REQUESTS.json')).requests,references=read(join(B1,'REFERENCES.json')).references,api=await loadCandidate11Api()
  check(binding.units.length===24&&hash(readFileSync('scripts/run-candidate11-b2.mjs'))===binding.dependencies.find(file=>file.path==='scripts/run-candidate11-b2.mjs').sha256,'FROZEN_RUNNER')
  const ledgerData=validateLedger(binding),ledger=ledgerData.summary,cases=[],adapterReplay=[]
  for(const unit of binding.units){
    const packet=packets.find(item=>item.unitId===unit.unitId),reference=references.find(item=>item.sourceId===unit.sourceId),result=read(join(DIRECTORY,'results',unit.unitId+'.json'))
    const rawLines=readFileSync(join(DIRECTORY,'raw',unit.unitId+'.jsonl'),'utf8').trimEnd().split('\n').map(JSON.parse)
    check(rawLines.length===1&&rawLines[0].responseSha===hash(rawLines[0].rawHttpText)&&result.responseSha===rawLines[0].responseSha&&result.ledgerStatus==='settled','RAW_BINDING')
    const envelope=JSON.parse(rawLines[0].rawHttpText),message=envelope.output.at(-1),wire=JSON.parse(message.content[0].text),assembled=api.adaptModelWire(wire,packet.prepared.context).adapted
    const evaluation=evaluate(reference,assembled,packet.prepared.context)
    adapterReplay.push({unitId:unit.unitId,rawResponseSha:result.responseSha,originalRunnerParseError:result.parseError,originalContextPath:'packet.context',frozenContextPath:'packet.prepared.context',frozenAdapterStatus:'PASS',assembledSha:hash(JSON.stringify(assembled))})
    cases.push({unitId:unit.unitId,ordinal:unit.ordinal,sourceId:unit.sourceId,variant:unit.variant,requestBytes:unit.requestBytes,responseSha:result.responseSha,usage:result.usage,costUpperMicroCny:result.costUpperMicroCny,waitingMs:result.waitingMs,evaluation})
  }
  const variants=['V00','V10','V01','V11'],arms=Object.fromEntries(variants.map(variant=>[variant,summarize(cases.filter(row=>row.variant===variant))])),baseline=arms.V00
  const validRun=cases.length===24&&cases.every(row=>row.evaluation.ambiguity.length===0),eligible=[]
  for(const variant of variants.slice(1)){const arm=arms[variant];if(arm.schemaAndReferenceValid===6&&arm.severe===0&&arm.forbidden===0&&arm.teachingLeak===0&&arm.task.fn<=baseline.task.fn
    &&['time','material','condition','revision','completion'].every(category=>arm.fieldCategories[category]<=baseline.fieldCategories[category])&&arm.completeSources>=baseline.completeSources+1&&arm.major<=baseline.major&&arm.task.recall>=baseline.task.recall)eligible.push(variant)}
  eligible.sort((a,b)=>arms[b].completeSources-arms[a].completeSources||arms[a].major-arms[b].major||arms[b].task.f1-arms[a].task.f1||arms[a].promptBytes-arms[b].promptBytes||variants.indexOf(a)-variants.indexOf(b))
  let decision='NO_ADDITIVE_COMPONENT_SELECTED',selected=null
  if(!validRun)decision='INVALID_RUN'
  else if(baseline.severe>0||baseline.forbidden>0||baseline.task.fn>0||cases.filter(row=>row.variant==='V00').some(row=>row.sourceId.endsWith('D01')&&row.evaluation.fieldCategories.completion>0))decision='REJECT_CANDIDATE11'
  else if(eligible.length){selected=eligible[0];decision='SELECT_'+selected}
  const pairs=[...new Set(cases.map(row=>row.sourceId))].map(sourceId=>({sourceId,...Object.fromEntries(variants.map(variant=>[variant,cases.find(row=>row.sourceId===sourceId&&row.variant===variant).evaluation.complete]))}))
  const factorial={M:{withoutExamples:arms.V10.completeSources-arms.V00.completeSources,withExamples:arms.V11.completeSources-arms.V01.completeSources},E:{withoutMethod:arms.V01.completeSources-arms.V00.completeSources,withMethod:arms.V11.completeSources-arms.V10.completeSources},interaction:arms.V11.completeSources-arms.V10.completeSources-arms.V01.completeSources+arms.V00.completeSources,metric:'complete source count; descriptive only'}
  const output={version:'candidate11-b2-postrun-analysis-1',status:'B2_DEVELOPMENT_RESULTS_READY_FOR_REVIEW',evaluationType:'seen-development-ablation',validRun,bindingSha:hash(bindingBytes),requests:24,sources:6,variants,arms,pairs,factorial,decision,selected,cases,
    executionFinding:{code:'RUNNER_CONTEXT_PATH_ERROR',affectedResults:24,originalPath:'packet.context',correctFrozenPath:'packet.prepared.context',rawResponsesChanged:false,modelOutputsChanged:false,additionalModelCalls:0,automaticRepair:false,
      note:'The live result diagnostic was a local adapter invocation error. Canonical scoring replays each unchanged raw output through the same frozen adapter and its frozen request context.'},
    operational:{actualCalls:24,providerBilledCny:'NOT_OBSERVABLE',localAuditableCostUpperMicroCny:cases.reduce((n,row)=>n+row.costUpperMicroCny,0),authorizedWorstMicroCny:51904512,usage:{inputTokens:cases.reduce((n,row)=>n+row.usage.input_tokens,0),outputTokens:cases.reduce((n,row)=>n+row.usage.output_tokens,0)}},
    ledger,boundaries:['Development only','single engineering author/model-assisted reference','no significance or generalization claim','not a real accept-and-save conversion rate','no Holdout, human trial, deployment or production authorization'],generatedAt:new Date().toISOString()}
  const executionUnits=binding.units.map(unit=>{const reserve=ledgerData.events.find(row=>row.event.kind==='candidate11Reserve'&&row.event.unitId===unit.unitId),settle=ledgerData.events.find(row=>row.event.kind==='candidate11Settle'&&row.event.unitId===unit.unitId),result=read(join(DIRECTORY,'results',unit.unitId+'.json'))
    return {unitId:unit.unitId,ordinal:unit.ordinal,sourceId:unit.sourceId,variant:unit.variant,requestSha:unit.requestSha,reserve:{sequence:reserve.sequence,nonce:reserve.event.nonce,reservedMicroCny:reserve.event.reservedMicroCny,ledgerHash:reserve.hash},
      raw:{path:`raw/${unit.unitId}.jsonl`,responseSha:result.responseSha,httpStatus:result.httpStatus},providerRequestId:settle.event.responseId,usage:settle.event.usage,
      settlement:{sequence:settle.sequence,status:'settled',costUpperMicroCny:settle.event.costUpperMicroCny,ledgerHash:settle.hash},providerBilledCny:'NOT_OBSERVABLE'}})
  write('EXECUTION_LEDGER.json',{version:'candidate11-b2-execution-ledger-1',grantSequence:ledgerData.events[0].sequence,grantId:ledgerData.events[0].event.grant.grantId,units:executionUnits,ledgerBefore:read(join(DIRECTORY,'BASELINE.json')).ledger,ledgerAfter:ledger})
  write('ADAPTER_REPLAY.json',{version:'candidate11-b2-adapter-replay-1',finding:output.executionFinding,units:adapterReplay})
  write('ANALYSIS.json',output)
  const pct=value=>value===null?'NA':(value*100).toFixed(2)+'%',lines=['# Candidate11 B2 Development 消融评测','',`状态：\`${output.status}\`。`,'','本批严格执行 24 个冻结请求；结果仅用于已见 Development 工程筛选，不是独立 Holdout、真人试用或识别转化率。','',
    '实时结果记录中的 24 个适配失败来自执行器上下文路径错误；冻结 raw、冻结适配器和冻结请求上下文的只读重放为 24/24 PASS。原始响应未改写，未做 JSON 修复，也未新增模型调用。','',`候选决定：\`${decision}\`${selected?`（${selected}）`:''}。`,'',
    '| 变体 | 完整来源 | TP / FP / FN | P / R / F1 | Major | Severe | Forbidden | 教学例越界 |','|---|---:|---:|---:|---:|---:|---:|---:|',...variants.map(variant=>{const arm=arms[variant];return `| ${variant} | ${arm.completeSources}/6 | ${arm.task.tp} / ${arm.task.fp} / ${arm.task.fn} | ${pct(arm.task.precision)} / ${pct(arm.task.recall)} / ${pct(arm.task.f1)} | ${arm.major} | ${arm.severe} | ${arm.forbidden} | ${arm.teachingLeak} |`}),
    '',`描述性效应：M（无 E / 有 E）=${factorial.M.withoutExamples} / ${factorial.M.withExamples}；E（无 M / 有 M）=${factorial.E.withoutMethod} / ${factorial.E.withMethod}；M×E=${factorial.interaction}。`,
    '',`实际调用：24；本地可审计费用上界：CNY ${(output.operational.localAuditableCostUpperMicroCny/1e6).toFixed(6)}；provider 实际扣费：NOT_OBSERVABLE。`,
    '',`账本：${ledger.rows} 行，SHA-256 \`${ledger.sha256}\`，tail \`${ledger.tail}\`。`,'','历史 RCO-5-007 保留：`FREEZE_HASH_MISMATCH:package-lock.json`。','']
  write('REPORT.md',lines.join('\n'))
  return output
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){check(process.argv.slice(2).length===0,'ARGUMENT');console.log(JSON.stringify(await analyzePostrun()))}
